import express, { Request, Response } from 'express';
import cors from 'cors';
import axios, { AxiosResponse } from './axiosConfig';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import crypto from 'crypto';
import { vitalSignsDb } from './database';
import { vitalSignsService } from './vitalSignsService';
import { startVitalSignsJob, stopVitalSignsJob } from './jobProcessor';
import {
  LoginRequest,
  LoginResponse,
  EncountersRequest,
  EncountersResponse,
  LogoutRequest,
  ErrorResponse,
  HealthResponse,
  EZDermLoginRequest,
  EZDermLoginResponse,
  EZDermEncounterFilter,
  EZDermEncounter,
  Encounter,
  EncounterStatus,
  StoredTokens,
  TokenStore
} from './types';

// Load environment variables
config();

const app = express();
const PORT: number = parseInt(process.env.PORT || '5001', 10);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 150 requests per windowMs (allows ~10s refresh + buffer)
  message: { error: 'Too many requests from this IP, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/', limiter);

// Store tokens in memory (in production, use Redis or a database)
const tokenStore: TokenStore = new Map<string, StoredTokens>();

// Session configuration
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

// Generate secure session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Session validation middleware
async function validateSession(req: Request, res: Response, next: any): Promise<void> {
  try {
    console.log(`🔐 validateSession middleware called for ${req.method} ${req.path}`);
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    
    console.log('🔑 Session token in request:', sessionToken ? sessionToken.substring(0, 20) + '...' : 'NONE');
    
    if (!sessionToken) {
      console.log('❌ No session token provided in Authorization header');
      res.status(401).json({ error: 'No session token provided' });
      return;
    }

    const session = await vitalSignsDb.validateSession(sessionToken);
    
    if (!session) {
      console.log('❌ Session validation failed - session not found or expired');
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    console.log('✅ Session validation successful for user:', session.username);
    // Add user info to request
    (req as any).user = { username: session.username };
    next();
  } catch (error) {
    console.error('💥 Session validation middleware error:', error);
    res.status(500).json({ error: 'Session validation failed' });
  }
}

// EZDerm API endpoints
const EZDERM_LOGIN_URL = 'https://login.ezinfra.net/api/login';
const EZDERM_REFRESH_URL = 'https://login.ezinfra.net/api/refresh';
const EZDERM_API_BASE = 'https://srvprod.ezinfra.net';

// Constants
const TOKEN_EXPIRY_MS = 600000; // 10 minutes
const DEFAULT_CLINIC_ID = '44b62760-50a1-488c-92ed-e0c7aa3cde92';
const DEFAULT_PRACTICE_ID = '4cc96922-4d83-4183-863b-748d69de621f';
const ACTIVE_STATUSES: EncounterStatus[] = [
  'CHECKED_IN', 
  'IN_ROOM', 
  'WITH_PROVIDER',
  'WITH_STAFF',
  'READY_FOR_STAFF'
];

// Utility functions
const formatDateStartOfDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00-0400`;
};

const formatDateEndOfDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T23:59:59-0400`;
};

const isTokenExpired = (tokens: StoredTokens): boolean => {
  return Date.now() - tokens.timestamp > TOKEN_EXPIRY_MS;
};

const transformEZDermEncounter = (encounter: EZDermEncounter): Encounter => {
  return {
    id: encounter.id,
    patientName: `${encounter.patientInfo.firstName} ${encounter.patientInfo.lastName}`,
    patientInfo: {
      id: encounter.patientInfo.id,
      firstName: encounter.patientInfo.firstName,
      lastName: encounter.patientInfo.lastName,
      dateOfBirth: encounter.patientInfo.dateOfBirth,
      gender: encounter.patientInfo.gender,
      medicalRecordNumber: encounter.patientInfo.medicalRecordNumber,
      ...(encounter.patientInfo.phoneNumber && { phoneNumber: encounter.patientInfo.phoneNumber }),
      ...(encounter.patientInfo.emailAddress && { emailAddress: encounter.patientInfo.emailAddress })
    },
    appointmentTime: encounter.dateOfService,
    ...(encounter.dateOfArrival && { arrivalTime: encounter.dateOfArrival }),
    chiefComplaint: encounter.chiefComplaintName,
    status: encounter.status,
    room: encounter.room || 'N/A',
    providers: encounter.encounterRoleInfoList.map(role => ({
      id: role.providerId,
      name: `${role.firstName} ${role.lastName}`,
      role: role.encounterRoleType,
      title: role.title || ''
    })),
    clinicName: encounter.clinicName,
    appointmentType: encounter.appointmentType.name,
    appointmentColor: encounter.appointmentType.color,
    establishedPatient: encounter.establishedPatient
  };
};

// Login endpoint
app.post('/api/login', async (req: Request<{}, LoginResponse | ErrorResponse, LoginRequest>, res: Response<LoginResponse | ErrorResponse>) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Prepare EZDerm login request
    const loginData: EZDermLoginRequest = {
      username,
      password,
      application: 'EZDERM',
      timeZoneId: 'America/Detroit',
      clientVersion: '4.28.0'
    };

    // Make request to EZDerm login API
    const loginResponse: AxiosResponse<EZDermLoginResponse> = await axios.post(EZDERM_LOGIN_URL, loginData, {
      headers: {
        'Host': 'login.ezinfra.net',
        'accept': 'application/json',
        'content-type': 'application/json',
        'user-agent': 'ezDerm/4.28.0 (com.ezderm.ezderm; build:132.19; macOS(Catalyst) 15.5.0) Alamofire/5.10.2',
        'accept-language': 'en-US;q=1.0'
      }
    });

    const { accessToken, refreshToken, servers } = loginResponse.data;

    // Store user credentials in database for job system
    await vitalSignsDb.storeUserCredentials(username, password);
    await vitalSignsDb.storeTokens(username, accessToken, refreshToken, servers.app);

    // Store tokens with username as key (for backwards compatibility with existing endpoints)
    const tokenData: StoredTokens = {
      accessToken,
      refreshToken,
      serverUrl: servers.app,
      timestamp: Date.now()
    };
    
    tokenStore.set(username, tokenData);

    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    console.log('💾 Creating session in database:', {
      username,
      sessionToken: sessionToken.substring(0, 20) + '...',
      expiresAt: expiresAt.toISOString()
    });

    await vitalSignsDb.createSession(sessionToken, username, expiresAt, userAgent, ipAddress);
    console.log('✅ Session created successfully');

    // Return success response with session token
    res.json({
      success: true,
      username,
      serverUrl: servers.app,
      sessionToken,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error: any) {
    console.error('Login error:', error.response?.data || error.message);
    res.status(401).json({ 
      error: 'Invalid credentials or login failed',
      details: error.response?.data?.message || error.message 
    });
    return;
  }
});

// Get encounters endpoint
app.post('/api/encounters', validateSession, async (req: Request<{}, EncountersResponse | ErrorResponse, EncountersRequest>, res: Response<EncountersResponse | ErrorResponse>) => {
  try {
    const username = (req as any).user.username; // From session validation middleware
    const { dateRangeStart, dateRangeEnd, clinicId, providerIds } = req.body;

    // Get valid tokens (with automatic refresh if needed)
    const userTokens = await getValidTokens(username);
    if (!userTokens) {
      res.status(401).json({ error: 'Unable to obtain valid tokens. Please login again.' });
      return;
    }

    // Get today's date for default range (start of day to end of day)
    const today = new Date();

    // Prepare request data exactly like the curl command
    const encounterData: EZDermEncounterFilter = {
      dateOfServiceRangeHigh: dateRangeEnd || formatDateEndOfDay(today),
      clinicId: clinicId || DEFAULT_CLINIC_ID,
      providerIds: providerIds || [],
      practiceId: DEFAULT_PRACTICE_ID,
      dateOfServiceRangeLow: dateRangeStart || formatDateStartOfDay(today),
      lightBean: true,
      dateSelection: 'SPECIFY_RANGE'
    };


    // Make request to EZDerm encounters API
    const encountersResponse: AxiosResponse<EZDermEncounter[]> = await axios.post(
      `${userTokens.serverUrl}ezderm-webservice/rest/encounter/getByFilter`,
      encounterData,
      {
        headers: {
          'Host': 'srvprod.ezinfra.net',
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': `Bearer ${userTokens.accessToken}`,
          'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
          'accept-language': 'en-US;q=1.0'
        }
      }
    );

    // Process and format the encounters data
    const allEncounters: Encounter[] = encountersResponse.data.map(transformEZDermEncounter);

    // Filter to only show patients currently in clinic (not checked out)
    const activeEncounters = allEncounters.filter(encounter => {
      return ACTIVE_STATUSES.includes(encounter.status);
    });

    // Sort by appointment time in ascending order
    const sortedEncounters = activeEncounters.sort((a, b) => {
      const timeA = new Date(a.appointmentTime).getTime();
      const timeB = new Date(b.appointmentTime).getTime();
      return timeA - timeB;
    });

    console.log(`Found ${sortedEncounters.length} active patients out of ${allEncounters.length} total`);

    res.json({ encounters: sortedEncounters });

  } catch (error: any) {
    console.error('Encounters error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      const { username } = req.body;
      if (username) {
        tokenStore.delete(username);
      }
      res.status(401).json({ error: 'Authentication failed. Please login again.' });
      return;
    }

    res.status(500).json({ 
      error: 'Failed to fetch encounters',
      details: error.response?.data?.message || error.message 
    });
    return;
  }
});

// Session validation endpoint
app.post('/api/validate-session', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    
    console.log('🔍 Session validation request received');
    console.log('🔑 Session token (first 20 chars):', sessionToken ? sessionToken.substring(0, 20) + '...' : 'NONE');
    
    if (!sessionToken) {
      console.log('❌ No session token provided');
      res.status(401).json({ valid: false, error: 'No session token provided' });
      return;
    }

    console.log('📊 Checking session in database...');
    const session = await vitalSignsDb.validateSession(sessionToken);
    
    if (!session) {
      console.log('❌ Session not found or expired in database');
      res.status(401).json({ valid: false, error: 'Invalid or expired session' });
      return;
    }

    console.log('✅ Session found:', {
      username: session.username,
      expiresAt: session.expiresAt
    });

    res.json({ 
      valid: true, 
      username: session.username,
      expiresAt: session.expiresAt.toISOString()
    });
  } catch (error) {
    console.error('💥 Session validation error:', error);
    res.status(500).json({ valid: false, error: 'Session validation failed' });
  }
});

// Debug endpoint to check sessions in database (development only)
app.get('/api/debug/sessions', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const sessions = await vitalSignsDb.getAllSessions();
    res.json({ sessions });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Logout endpoint
app.post('/api/logout', async (req: Request<{}, { success: boolean }, LogoutRequest>, res: Response<{ success: boolean }>) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    const { username } = req.body;
    
    if (sessionToken) {
      // Delete specific session
      await vitalSignsDb.deleteSession(sessionToken);
    } else if (username) {
      // Fallback: delete all sessions for user
      await vitalSignsDb.deleteAllUserSessions(username);
    }
    
    // Also clean up memory store for backwards compatibility
    if (username) {
      tokenStore.delete(username);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ success: true }); // Still return success to avoid client issues
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response<HealthResponse>) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

// Vital signs management endpoints

// Process vital signs carryforward for specific encounter
app.post('/api/vital-signs/process/:encounterId', validateSession, async (req: Request, res: Response) => {
  try {
    const encounterId = req.params.encounterId;
    const username = (req as any).user.username; // From session validation middleware
    
    if (!encounterId) {
      return res.status(400).json({ error: 'Encounter ID is required' });
    }
    
    // Get valid tokens (with automatic refresh if needed)
    const userTokens = await getValidTokens(username);
    if (!userTokens) {
      return res.status(401).json({ error: 'Unable to obtain valid tokens. Please login again.' });
    }
    
    // Get today's encounters to find the specific encounter
    const today = new Date();
    const encounterData: EZDermEncounterFilter = {
      dateOfServiceRangeHigh: formatDateEndOfDay(today),
      clinicId: DEFAULT_CLINIC_ID,
      providerIds: [],
      practiceId: DEFAULT_PRACTICE_ID,
      dateOfServiceRangeLow: formatDateStartOfDay(today),
      lightBean: true,
      dateSelection: 'SPECIFY_RANGE'
    };

    // Make request to EZDerm encounters API
    const encountersResponse: AxiosResponse<EZDermEncounter[]> = await axios.post(
      `${userTokens.serverUrl}ezderm-webservice/rest/encounter/getByFilter`,
      encounterData,
      {
        headers: {
          'Host': 'srvprod.ezinfra.net',
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': `Bearer ${userTokens.accessToken}`,
          'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
          'accept-language': 'en-US;q=1.0'
        }
      }
    );

    // Transform encounters and find the specific one
    const allEncounters: Encounter[] = encountersResponse.data.map(transformEZDermEncounter);
    const encounter = allEncounters.find(enc => enc.id === encounterId);

    if (!encounter) {
      return res.status(404).json({ error: 'Encounter not found' });
    }
    
    const result = await vitalSignsService.processVitalSignsCarryforward(encounter, userTokens.accessToken);
    
    if (result) {
      res.json({ 
        success: true, 
        message: `Vital signs carryforward processed for encounter ${encounterId}`,
        encounterId 
      });
      return;
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Encounter not eligible for vital signs carryforward or already processed',
        encounterId 
      });
      return;
    }
  } catch (error) {
    console.error('Error processing vital signs for encounter:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Process vital signs carryforward for all eligible encounters
app.post('/api/vital-signs/process-all', validateSession, async (req: Request, res: Response) => {
  try {
    const username = (req as any).user.username; // From session validation middleware
    
    // Get valid tokens (with automatic refresh if needed)
    const userTokens = await getValidTokens(username);
    if (!userTokens) {
      return res.status(401).json({ error: 'Unable to obtain valid tokens. Please login again.' });
    }
    
    // Get today's encounters for vital signs processing
    const today = new Date();
    const encounterData: EZDermEncounterFilter = {
      dateOfServiceRangeHigh: formatDateEndOfDay(today),
      clinicId: DEFAULT_CLINIC_ID,
      providerIds: [],
      practiceId: DEFAULT_PRACTICE_ID,
      dateOfServiceRangeLow: formatDateStartOfDay(today),
      lightBean: true,
      dateSelection: 'SPECIFY_RANGE'
    };

    // Make request to EZDerm encounters API
    const encountersResponse: AxiosResponse<EZDermEncounter[]> = await axios.post(
      `${userTokens.serverUrl}ezderm-webservice/rest/encounter/getByFilter`,
      encounterData,
      {
        headers: {
          'Host': 'srvprod.ezinfra.net',
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': `Bearer ${userTokens.accessToken}`,
          'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
          'accept-language': 'en-US;q=1.0'
        }
      }
    );

    // Transform encounters
    const allEncounters: Encounter[] = encountersResponse.data.map(transformEZDermEncounter);
    
    const result = await vitalSignsService.processMultipleEncounters(allEncounters, userTokens.accessToken);
    
    res.json({ 
      success: true, 
      message: 'Vital signs carryforward processing completed',
      ...result
    });
    return;
  } catch (error) {
    console.error('Error processing vital signs for all encounters:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Get vital signs processing statistics
app.get('/api/vital-signs/stats', async (req: Request, res: Response) => {
  try {
    const stats = await vitalSignsService.getProcessingStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching vital signs statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Token refresh function
async function refreshEZDermToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    console.log('🔄 Attempting to refresh EZDerm token...');
    
    const response: AxiosResponse<EZDermLoginResponse> = await axios.post(EZDERM_REFRESH_URL, {
      refreshToken,
      application: 'EZDERM',
      clientVersion: '4.28.0'
    }, {
      headers: {
        'Host': 'login.ezinfra.net',
        'accept': 'application/json',
        'content-type': 'application/json',
        'user-agent': 'ezDerm/4.28.0 (com.ezderm.ezderm; build:132.19; macOS(Catalyst) 15.5.0) Alamofire/5.10.2',
        'accept-language': 'en-US;q=1.0'
      }
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data;
    console.log('✅ Token refresh successful');
    
    return {
      accessToken,
      refreshToken: newRefreshToken
    };
  } catch (error: any) {
    console.error('❌ Token refresh failed:', error.response?.data || error.message);
    return null;
  }
}

// Enhanced function to get valid tokens (with refresh logic)
async function getValidTokens(username: string): Promise<{ accessToken: string; refreshToken: string; serverUrl: string } | null> {
  try {
    // First, try to get stored tokens
    let tokens = await vitalSignsDb.getStoredTokens(username);
    
    if (tokens) {
      // Tokens are valid and not expired
      return tokens;
    }
    
    // Tokens are expired or don't exist, try to refresh
    console.log(`🔄 Tokens expired for user ${username}, attempting refresh...`);
    
    // Get the refresh token even if access token is expired
    const expiredTokenData = await vitalSignsDb.getStoredTokensIgnoreExpiry(username);
    
    if (expiredTokenData?.refreshToken) {
      const refreshedTokens = await refreshEZDermToken(expiredTokenData.refreshToken);
      
      if (refreshedTokens) {
        // Store the new tokens
        await vitalSignsDb.storeTokens(username, refreshedTokens.accessToken, refreshedTokens.refreshToken, expiredTokenData.serverUrl);
        
        return {
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken,
          serverUrl: expiredTokenData.serverUrl
        };
      }
    }
    
    // Refresh failed, try re-login with stored credentials
    console.log(`🔑 Token refresh failed for user ${username}, attempting re-login...`);
    const credentials = await vitalSignsDb.getUserCredentials(username);
    
    if (credentials) {
      const loginData: EZDermLoginRequest = {
        username: credentials.username,
        password: credentials.password,
        application: 'EZDERM',
        timeZoneId: 'America/Detroit',
        clientVersion: '4.28.0'
      };

      const loginResponse: AxiosResponse<EZDermLoginResponse> = await axios.post(EZDERM_LOGIN_URL, loginData, {
        headers: {
          'Host': 'login.ezinfra.net',
          'accept': 'application/json',
          'content-type': 'application/json',
          'user-agent': 'ezDerm/4.28.0 (com.ezderm.ezderm; build:132.19; macOS(Catalyst) 15.5.0) Alamofire/5.10.2',
          'accept-language': 'en-US;q=1.0'
        }
      });

      const { accessToken, refreshToken, servers } = loginResponse.data;
      
      // Store the new tokens
      await vitalSignsDb.storeTokens(username, accessToken, refreshToken, servers.app);
      
      console.log(`✅ Re-login successful for user ${username}`);
      
      return {
        accessToken,
        refreshToken,
        serverUrl: servers.app
      };
    }
    
    console.log(`❌ No valid credentials found for user ${username}`);
    return null;
    
  } catch (error: any) {
    console.error(`💥 Error getting valid tokens for user ${username}:`, error.message);
    return null;
  }
}

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server with database initialization
async function startServer() {
  try {
    // Initialize database
    await vitalSignsDb.initialize();
    console.log('💾 Database initialized successfully');

    // Start vital signs job processor
    await startVitalSignsJob();
    console.log('🔄 Vital signs job processor started');

    // Set up periodic session cleanup (every hour)
    setInterval(async () => {
      try {
        await vitalSignsDb.cleanupExpiredSessions();
      } catch (error) {
        console.error('Session cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    console.log('🔧 Session cleanup scheduled');

    // Clean up sessions on startup
    await vitalSignsDb.cleanupExpiredSessions();

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 EZDerm API Base: ${EZDERM_API_BASE}`);
      console.log(`🩺 Vital signs carryforward enabled (server-side jobs)`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully shutting down...');
  await stopVitalSignsJob();
  await vitalSignsDb.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Gracefully shutting down...');
  await stopVitalSignsJob();
  await vitalSignsDb.close();
  process.exit(0);
});

startServer(); 