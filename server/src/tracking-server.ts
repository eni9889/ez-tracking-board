import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from './axiosConfig';
import { AxiosResponse } from 'axios';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import crypto from 'crypto';
import { vitalSignsDb } from './database';
import { vitalSignsService } from './vitalSignsService';
import { 
  triggerAINoteScan, 
  getAINoteJobStats 
} from './jobProcessor';
import { aiNoteChecker } from './aiNoteChecker';
import { appConfig } from './config';
import {
  LoginRequest,
  EZDermLoginRequest as EZDermLoginRequestType,
  EMALoginRequest,
  LoginResponse,
  EncountersRequest,
  EncountersResponse,
  LogoutRequest,
  ErrorResponse,
  HealthResponse,
  EZDermAPILoginRequest,
  EZDermLoginResponse,
  EZDermEncounterFilter,
  EZDermEncounter,
  Encounter,
  EncounterStatus,
  StoredTokens,
  TokenStore,
  RefreshTokenRequest,
  RefreshTokenResponse,
  EMATokenRequest,
  EMATokenResponse,
  EMRProvider
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
app.use(cors({
  origin: appConfig.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use('/', limiter);

// Store tokens in memory (in production, use Redis or a database)
const tokenStore: TokenStore = new Map<string, StoredTokens>();

// Session configuration
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const REFRESH_TOKEN_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Generate secure session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate secure refresh token
function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
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
const EZDERM_REFRESH_URL = 'https://login.ezinfra.net/api/refreshToken/getAccessToken';
const EZDERM_API_BASE = 'https://srvprod.ezinfra.net';

// ModMed EMA API endpoints
const EMA_API_KEY = appConfig.ema.apiKey;
const EMA_BASE_URL = appConfig.ema.baseUrl;
const EMA_OAUTH_PATH = appConfig.ema.oauthPath;
const EMA_FHIR_PATH = appConfig.ema.fhirPath;

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

// EMA Authentication Helper Functions
async function authenticateEMAUser(loginRequest: EMALoginRequest): Promise<{ accessToken: string; refreshToken: string; serverUrl: string }> {
  try {
    const { firmName, username, password } = loginRequest;
    console.log(`🔐 Attempting EMA login for user: ${username} at firm: ${firmName}`);

    // Prepare EMA OAuth2 request
    const tokenData: EMATokenRequest = {
      username,
      password,
      grant_type: 'password'
    };

    // Build the OAuth URL with firm name
    const oauthUrl = `${EMA_BASE_URL}/firm/${firmName}${EMA_OAUTH_PATH}`;
    console.log(`🌐 Making OAuth request to EMA API: ${oauthUrl}`);

    // Make request to EMA OAuth2 API
    const response: AxiosResponse<EMATokenResponse> = await axios.post(oauthUrl, 
      // Send as URL-encoded form data
      `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&grant_type=password`,
      {
        headers: {
          'accept': 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
          'x-api-key': EMA_API_KEY
        }
      }
    );

    console.log(`✅ EMA OAuth successful for user: ${username}`);
    
    const { access_token, refresh_token } = response.data;
    
    // Build server URL for FHIR API
    const serverUrl = `${EMA_BASE_URL}/firm/${firmName}${EMA_FHIR_PATH}`;

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      serverUrl
    };
  } catch (error: any) {
    console.error('💥 EMA authentication error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

// EZDerm Authentication Helper Function
async function authenticateEZDermUser(loginRequest: EZDermLoginRequestType): Promise<{ accessToken: string; refreshToken: string; serverUrl: string }> {
  try {
    const { username, password } = loginRequest;
    console.log(`🔐 Attempting EZDerm login for user: ${username}`);

    // Prepare EZDerm login request
    const loginData: EZDermAPILoginRequest = {
      username,
      password,
      application: 'EZDERM',
      timeZoneId: 'America/Detroit',
      clientVersion: '4.28.0'
    };

    // Make request to EZDerm login API
    console.log(`🌐 Making login request to EZDerm API for user: ${username}`);
    const loginResponse: AxiosResponse<EZDermLoginResponse> = await axios.post(EZDERM_LOGIN_URL, loginData, {
      headers: {
        'Host': 'login.ezinfra.net',
        'accept': 'application/json',
        'content-type': 'application/json',
        'user-agent': 'ezDerm/4.28.0 (com.ezderm.ezderm; build:132.19; macOS(Catalyst) 15.5.0) Alamofire/5.10.2',
        'accept-language': 'en-US;q=1.0'
      }
    });

    console.log(`✅ EZDerm API login successful for user: ${username}`);

    const { accessToken, refreshToken, servers } = loginResponse.data;

    return {
      accessToken,
      refreshToken,
      serverUrl: servers.app
    };
  } catch (error: any) {
    console.error('💥 EZDerm authentication error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

// Login endpoint
app.post('/login', async (req: Request<{}, LoginResponse | ErrorResponse, LoginRequest>, res: Response<LoginResponse | ErrorResponse>) => {
  try {
    console.log('🔐 Login attempt received');
    const loginRequest = req.body;
    const { emrProvider, username, password } = loginRequest;

    if (!emrProvider || !username || !password) {
      console.log('❌ Login failed: Missing required fields');
      res.status(400).json({ error: 'EMR provider, username and password are required' });
      return;
    }

    // Validate EMR provider specific fields
    if (emrProvider === 'EMA' && !('firmName' in loginRequest)) {
      console.log('❌ Login failed: Missing firm name for EMA');
      res.status(400).json({ error: 'Firm name is required for ModMed EMA' });
      return;
    }

    console.log(`🔐 Attempting ${emrProvider} login for user: ${username}`);

    let authResult: { accessToken: string; refreshToken: string; serverUrl: string };

    // Route to appropriate authentication method
    try {
      if (emrProvider === 'EMA') {
        authResult = await authenticateEMAUser(loginRequest as EMALoginRequest);
      } else if (emrProvider === 'EZDERM') {
        authResult = await authenticateEZDermUser(loginRequest as EZDermLoginRequestType);
      } else {
        console.log('❌ Login failed: Unsupported EMR provider');
        res.status(400).json({ error: 'Unsupported EMR provider' });
        return;
      }
    } catch (authError: any) {
      console.error(`💥 ${emrProvider} authentication failed:`, authError.message);
      const statusCode = authError.response?.status || 500;
      res.status(statusCode === 200 ? 401 : statusCode).json({ 
        error: `${emrProvider} authentication failed`,
        details: authError.response?.data?.message || authError.message
      });
      return;
    }

    const { accessToken, refreshToken: emrRefreshToken, serverUrl } = authResult;

    // Store user credentials and tokens in database
    console.log('💾 Storing user credentials and tokens in database');
    await vitalSignsDb.storeUserCredentials(username, password, emrProvider);
    await vitalSignsDb.storeTokens(username, accessToken, emrRefreshToken, serverUrl, emrProvider);

    // Store tokens with username as key (for backwards compatibility with existing endpoints)
    const tokenData: StoredTokens = {
      accessToken,
      refreshToken: emrRefreshToken,
      serverUrl,
      timestamp: Date.now()
    };
    
    tokenStore.set(username, tokenData);

    // Create session and refresh token
    const sessionToken = generateSessionToken();
    const userRefreshToken = generateRefreshToken();
    const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DURATION);
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    console.log('💾 Creating session and refresh token in database:', {
      username,
      emrProvider,
      sessionToken: sessionToken.substring(0, 20) + '...',
      refreshToken: userRefreshToken.substring(0, 20) + '...',
      sessionExpiresAt: sessionExpiresAt.toISOString(),
      refreshExpiresAt: refreshExpiresAt.toISOString()
    });

    await vitalSignsDb.createSession(sessionToken, username, sessionExpiresAt, userAgent, ipAddress);
    await vitalSignsDb.createRefreshToken(userRefreshToken, sessionToken, username, refreshExpiresAt);
    console.log('✅ Session and refresh token created successfully');

    // Return success response with session and refresh tokens
    res.json({
      success: true,
      username,
      serverUrl,
      emrProvider,
      sessionToken,
      refreshToken: userRefreshToken,
      expiresAt: sessionExpiresAt.toISOString()
    });

  } catch (error: any) {
    console.error('💥 Login error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url
    });
    
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    const statusCode = error.response?.status || 500;
    
    res.status(statusCode === 200 ? 401 : statusCode).json({ 
      error: 'Login failed',
      details: errorMessage,
      status: statusCode
    });
    return;
  }
});

// Get encounters endpoint
app.post('/encounters', validateSession, async (req: Request<{}, EncountersResponse | ErrorResponse, EncountersRequest>, res: Response<EncountersResponse | ErrorResponse>) => {
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
app.post('/validate-session', async (req: Request, res: Response): Promise<void> => {
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

// Refresh token endpoint
app.post('/refresh-token', async (req: Request<{}, RefreshTokenResponse | ErrorResponse, RefreshTokenRequest>, res: Response<RefreshTokenResponse | ErrorResponse>): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    console.log('🔄 Refresh token request received');
    console.log('🔑 Refresh token (first 20 chars):', refreshToken ? refreshToken.substring(0, 20) + '...' : 'NONE');
    
    if (!refreshToken) {
      console.log('❌ No refresh token provided');
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    console.log('📊 Validating refresh token in database...');
    const tokenData = await vitalSignsDb.validateRefreshToken(refreshToken);
    
    if (!tokenData) {
      console.log('❌ Refresh token not found or expired in database');
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    console.log('✅ Refresh token is valid for user:', tokenData.username);
    
    // Generate new session and refresh tokens
    const newSessionToken = generateSessionToken();
    const newRefreshToken = generateRefreshToken();
    const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DURATION);
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    console.log('🔄 Creating new session and refresh token pair');
    
    // Invalidate old refresh token
    await vitalSignsDb.invalidateRefreshToken(refreshToken);
    
    // Invalidate old session
    await vitalSignsDb.deleteSession(tokenData.sessionToken);
    
    // Create new session and refresh token
    await vitalSignsDb.createSession(newSessionToken, tokenData.username, sessionExpiresAt, userAgent, ipAddress);
    await vitalSignsDb.createRefreshToken(newRefreshToken, newSessionToken, tokenData.username, refreshExpiresAt);
    
    console.log('✅ Token refresh successful for user:', tokenData.username);
    
    res.json({
      success: true,
      sessionToken: newSessionToken,
      refreshToken: newRefreshToken,
      expiresAt: sessionExpiresAt.toISOString()
    });
  } catch (error) {
    console.error('💥 Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Debug endpoint to check sessions in database (development only)
app.get('/debug/sessions', async (req: Request, res: Response) => {
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
app.post('/logout', async (req: Request<{}, { success: boolean }, LogoutRequest>, res: Response<{ success: boolean }>) => {
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
app.get('/health', (req: Request, res: Response<HealthResponse>) => {
  console.log('🏥 Health check requested');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Vital signs management endpoints

// Process vital signs carryforward for specific encounter
app.post('/vital-signs/process/:encounterId', validateSession, async (req: Request, res: Response) => {
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
app.post('/vital-signs/process-all', validateSession, async (req: Request, res: Response) => {
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
app.get('/vital-signs/stats', async (req: Request, res: Response) => {
  try {
    const stats = await vitalSignsService.getProcessingStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching vital signs statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Note Checking Job System Endpoints

// Start AI note checking job system
app.post('/ai-notes/jobs/start', validateSession, async (req: Request, res: Response) => {
  res.status(501).json({ 
    error: 'Job control is managed by the dedicated worker service. Use docker-compose restart worker to restart job processing.' 
  });
});

// Stop AI note checking job system
app.post('/ai-notes/jobs/stop', validateSession, async (req: Request, res: Response) => {
  res.status(501).json({ 
    error: 'Job control is managed by the dedicated worker service. Use docker-compose stop worker to stop job processing.' 
  });
});

// Trigger manual AI note scan
app.post('/ai-notes/jobs/scan', validateSession, async (req: Request, res: Response) => {
  try {
    const scanId = await triggerAINoteScan();
    
    res.json({ 
      success: true, 
      message: 'AI note scan triggered successfully',
      scanId 
    });
  } catch (error: any) {
    console.error('Error triggering AI note scan:', error);
    res.status(500).json({ 
      error: 'Failed to trigger AI note scan', 
      details: error.message 
    });
  }
});

// Get AI note checking job statistics
app.get('/ai-notes/jobs/stats', validateSession, async (req: Request, res: Response) => {
  try {
    const stats = await getAINoteJobStats();
    res.json({ 
      success: true, 
      stats 
    });
  } catch (error: any) {
    console.error('Error getting AI note job stats:', error);
    res.status(500).json({ 
      error: 'Failed to get AI note job stats', 
      details: error.message 
    });
  }
});

// AI Note Checker Endpoints

// Get incomplete notes from EZDerm
app.post('/notes/incomplete', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const username = (req as any).user.username;
    const { fetchFrom, size, group } = req.body;
    
    // Get valid tokens
    const userTokens = await getValidTokens(username);
    if (!userTokens) {
      res.status(401).json({ error: 'Unable to obtain valid tokens. Please login again.' });
      return;
    }
    
    const incompleteNotesData = await aiNoteChecker.fetchIncompleteNotes(userTokens.accessToken, {
      fetchFrom,
      size,
      group
    });
    
    // Transform the EZDerm response to the format expected by frontend
    const encounters: any[] = [];
    const encounterIds = new Set<string>(); // Track encounter IDs to prevent duplicates
    
    incompleteNotesData.forEach(batch => {
      if (batch.incompletePatientEncounters) {
        batch.incompletePatientEncounters.forEach(patientData => {
          patientData.incompleteEncounters.forEach(encounter => {
            // Skip if we've already seen this encounter ID
            if (encounterIds.has(encounter.id)) {
              console.debug(`⚠️ Skipping duplicate encounter ID: ${encounter.id}`);
              return;
            }
            
            // Apply eligibility filter: only show encounters with appropriate status and > 2 hours old
            const eligibleStatuses = ['PENDING_COSIGN', 'CHECKED_OUT', 'WITH_PROVIDER'];
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const serviceDate = new Date(encounter.dateOfService);
            
            const isEligible = eligibleStatuses.includes(encounter.status) && serviceDate < twoHoursAgo;
            
            if (!isEligible) {
              console.debug(`⏰ Skipping encounter ${encounter.id}: status=${encounter.status}, dateOfService=${encounter.dateOfService} (not eligible - either wrong status or too recent)`);
              return;
            }
            
            encounterIds.add(encounter.id);
            encounters.push({
              encounterId: encounter.id,
              patientId: patientData.id,
              patientName: `${patientData.firstName} ${patientData.lastName}`,
              chiefComplaint: encounter.chiefComplaintName || 'No chief complaint',
              dateOfService: encounter.dateOfService,
              status: encounter.status
            });
          });
        });
      }
    });
    
    console.log(`📊 Processed ${encounters.length} eligible encounters from ${incompleteNotesData.length} batches (filtered by status and 2+ hour age requirement)`);
    res.json({ success: true, encounters });
  } catch (error: any) {
    console.error('Error fetching incomplete notes:', error);
    res.status(500).json({ error: 'Failed to fetch incomplete notes', details: error.message });
  }
});

// Get all eligible encounters for AI checking
app.get('/notes/eligible', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const username = (req as any).user.username;
    
    // Get valid tokens
    const userTokens = await getValidTokens(username);
    if (!userTokens) {
      res.status(401).json({ error: 'Unable to obtain valid tokens. Please login again.' });
      return;
    }
    
    const allPatients = await aiNoteChecker.getAllIncompleteNotes(userTokens.accessToken);
    const eligibleEncounters = aiNoteChecker.filterEligibleEncounters(allPatients);
    
    res.json({ 
      success: true, 
      count: eligibleEncounters.length,
      encounters: eligibleEncounters.map(({ patient, encounter }) => ({
        encounterId: encounter.id,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        chiefComplaint: encounter.chiefComplaintName,
        dateOfService: encounter.dateOfService,
        status: encounter.status
      }))
    });
  } catch (error: any) {
    console.error('Error fetching eligible encounters:', error);
    res.status(500).json({ error: 'Failed to fetch eligible encounters', details: error.message });
  }
});

// Get progress note for specific encounter
app.get('/notes/progress/:encounterId', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const username = (req as any).user.username;
    const { encounterId } = req.params;
    let { patientId } = req.query;
    
    // Get valid tokens
    const userTokens = await getValidTokens(username);
    if (!userTokens) {
      res.status(401).json({ error: 'Unable to obtain valid tokens. Please login again.' });
      return;
    }
    
    if (!encounterId) {
      res.status(400).json({ error: 'Encounter ID is required' });
      return;
    }

    // Always try to fetch care team info from incomplete notes (needed for ToDo creation and care team display)
    console.log('🔍 Fetching encounter details from incomplete notes...');
    let encounterRoleInfoList: any[] = [];
    
    try {
      const incompleteNotesData = await aiNoteChecker.fetchIncompleteNotes(userTokens.accessToken, {
        fetchFrom: 0,
        size: 200  // Get more notes to increase chance of finding the encounter
      });
      
      // Search for the encounter in incomplete notes to get patientId (care team fetched separately)
      let foundPatientId: string | null = null;
      incompleteNotesData.forEach(batch => {
        if (batch.incompletePatientEncounters && !foundPatientId) {
          batch.incompletePatientEncounters.forEach(patientData => {
            const foundEncounter = patientData.incompleteEncounters.find(enc => enc.id === encounterId);
            if (foundEncounter) {
              foundPatientId = patientData.id;
              // Note: NOT getting care team from here - will fetch full encounter details below
            }
          });
        }
      });
      
      // If patientId wasn't provided, use the one we found
      if (!patientId) {
        if (foundPatientId) {
          patientId = foundPatientId;
          console.log(`✅ Found patient ID: ${patientId} for encounter: ${encounterId}`);
        } else {
          res.status(404).json({ error: 'Encounter not found in incomplete notes. The encounter may have been completed or signed.' });
          return;
        }
      } else {
        console.log(`✅ Found care team info for encounter: ${encounterId}`);
      }
    } catch (searchError) {
      console.error('Error searching incomplete notes:', searchError);
      res.status(500).json({ error: 'Could not fetch encounter details' });
      return;
    }

    // Now fetch the FULL encounter details to get care team with actual names
    try {
      console.log('🏥 Fetching full encounter details for care team...');
      const encounterDetails = await aiNoteChecker.fetchEncounterDetails(userTokens.accessToken, encounterId);
      encounterRoleInfoList = encounterDetails.encounterRoleInfoList || [];
      console.log(`✅ Got care team with names: ${encounterRoleInfoList.length} members`);
      
      // Also update patientId if we didn't have it
      if (!patientId && encounterDetails.patientId) {
        patientId = encounterDetails.patientId;
        console.log(`📝 Got patientId from encounter details: ${patientId}`);
      }
    } catch (error: any) {
      console.warn('⚠️ Failed to fetch full encounter details:', error.message);
      // Continue with empty care team
      encounterRoleInfoList = [];
    }

    const progressNote = await aiNoteChecker.fetchProgressNote(
      userTokens.accessToken, 
      encounterId, 
      patientId as string
    );
    
    // Also return the patient info and care team we found
    res.json({ 
      success: true, 
      data: progressNote,
      patientId: patientId,
      careTeam: encounterRoleInfoList
    });
  } catch (error: any) {
    console.error('Error fetching progress note:', error);
    res.status(500).json({ error: 'Failed to fetch progress note', details: error.message });
  }
});

// Create ToDo for note deficiencies
app.post('/notes/:encounterId/create-todo', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const { encounterId } = req.params;
    const username = (req as any).user.username;
    
    if (!encounterId) {
      res.status(400).json({ error: 'Encounter ID is required' });
      return;
    }
    
    // Get valid tokens
    const userTokens = await getValidTokens(username);
    if (!userTokens) {
      res.status(401).json({ error: 'Unable to obtain valid tokens. Please login again.' });
      return;
    }

    // Get the latest AI check result for this encounter
    const noteCheckResult = await vitalSignsDb.getNoteCheckResult(encounterId);
    if (!noteCheckResult) {
      res.status(404).json({ error: 'No AI check result found for this encounter' });
      return;
    }

    // Check for issues using the correct field names (camelCase from database mapping)
    if (!noteCheckResult.issuesFound || !noteCheckResult.aiAnalysis?.issues) {
      res.status(400).json({ error: 'No issues found in the AI analysis to create a ToDo for' });
      return;
    }

    // Get encounter details directly by ID
    const encounterDetails = await aiNoteChecker.fetchEncounterDetails(userTokens.accessToken, encounterId);
    
    if (!encounterDetails) {
      res.status(404).json({ error: 'Encounter not found' });
      return;
    }

    // Extract patient and encounter data from the response
    const encounterData = encounterDetails;
    const patientData = {
      id: encounterDetails.patientInfo.id,
      firstName: encounterDetails.patientInfo.firstName || 'Unknown',
      lastName: encounterDetails.patientInfo.lastName || 'Patient'
    };

    // Create the ToDo
    const todoId = await aiNoteChecker.createNoteDeficiencyToDo(
      userTokens.accessToken,
      encounterId,
      patientData.id,
      `${patientData.firstName} ${patientData.lastName}`,
      encounterData.dateOfService,
      noteCheckResult.aiAnalysis.issues,
      encounterData.encounterRoleInfoList || []
    );

    // Save the created ToDo info to our database for tracking
    const patientName = `${patientData.firstName} ${patientData.lastName}`;
    const dateOfService = new Date(encounterData.dateOfService);
    const formattedDate = dateOfService.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric'
    });
    const subject = `Note Deficiencies - ${formattedDate}`;
    
    // Build description
    const issuesList = noteCheckResult.aiAnalysis.issues.map((issue: any, index: number) => {
      const issueTypeMap: { [key: string]: string } = {
        'no_explicit_plan': 'Missing Explicit Plan',
        'chronicity_mismatch': 'Chronicity Mismatch',
        'unclear_documentation': 'Unclear Documentation',
        'chief_complaint_structure': 'Chief Complaint Structure'
      };
      return `${index + 1}. ${issueTypeMap[issue.issue] || issue.issue}: ${issue.assessment}\n   ${issue.details.correction}`;
    }).join('\n\n');
    const description = `The following deficiencies were identified in the progress note:\n\n${issuesList}`;
    
    // Determine assignee info
    const assignee = encounterData.encounterRoleInfoList.find((member: any) => 
      member.encounterRoleType === 'SECONDARY_PROVIDER'
    ) || encounterData.encounterRoleInfoList.find((member: any) => 
      member.encounterRoleType === 'STAFF'
    ) || encounterData.encounterRoleInfoList.find((member: any) => 
      member.encounterRoleType === 'PROVIDER'
    );
    
    const ccList = encounterData.encounterRoleInfoList.filter((member: any) => 
      member.id !== assignee?.id
    );

    await vitalSignsDb.saveCreatedToDo(
      encounterId,
      patientData.id,
      patientName,
      todoId,
      subject,
      description,
      assignee?.providerId || 'unknown',
      assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unknown',
      ccList,
      noteCheckResult.aiAnalysis.issues.length,
      username
    );

    res.json({ 
      success: true, 
      todoId,
      message: 'ToDo created successfully for note deficiencies'
    });
    
  } catch (error: any) {
    console.error('Error creating ToDo for note deficiencies:', error);
    res.status(500).json({ error: 'Failed to create ToDo', details: error.message });
  }
});

// Get created ToDos for a specific encounter
app.get('/notes/:encounterId/todos', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const { encounterId } = req.params;
    
    if (!encounterId) {
      res.status(400).json({ error: 'Encounter ID is required' });
      return;
    }
    
    const createdTodos = await vitalSignsDb.getCreatedToDosForEncounter(encounterId);
    
    res.json({ 
      success: true, 
      todos: createdTodos
    });
  } catch (error: any) {
    console.error('Error fetching created ToDos:', error);
    res.status(500).json({ error: 'Failed to fetch created ToDos', details: error.message });
  }
});

// Check specific encounter note with AI
app.post('/notes/check/:encounterId', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const username = (req as any).user.username;
    const { encounterId } = req.params;
    const { patientId, patientName, chiefComplaint, dateOfService, force } = req.body;
    
    if (!patientId || typeof patientId !== 'string') {
      res.status(400).json({ error: 'Patient ID is required in request body' });
      return;
    }
    
    // Get valid tokens
    const userTokens = await getValidTokens(username);
    if (!userTokens) {
      res.status(401).json({ error: 'Unable to obtain valid tokens. Please login again.' });
      return;
    }
    
    if (!encounterId) {
      res.status(400).json({ error: 'Encounter ID is required' });
      return;
    }

    const result = await aiNoteChecker.checkSingleNote(
      userTokens.accessToken,
      encounterId,
      patientId,
      patientName || 'Unknown Patient',
      chiefComplaint || 'Unknown',
      dateOfService || new Date().toISOString(),
      username,
      Boolean(force) // Convert to boolean, default to false
    );
    
    res.json({ 
      success: true, 
      message: 'Note check completed',
      result
    });
  } catch (error: any) {
    console.error('Error checking note:', error);
    res.status(500).json({ error: 'Failed to check note', details: error.message });
  }
});

// Process all eligible encounters
app.post('/notes/check-all', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const username = (req as any).user.username;
    
    // Get valid tokens
    const userTokens = await getValidTokens(username);
    if (!userTokens) {
      res.status(401).json({ error: 'Unable to obtain valid tokens. Please login again.' });
      return;
    }
    
    const result = await aiNoteChecker.processEligibleEncounters(userTokens.accessToken, username);
    
    res.json({ 
      success: true, 
      message: 'Batch note checking completed',
      ...result
    });
  } catch (error: any) {
    console.error('Error in batch note checking:', error);
    res.status(500).json({ error: 'Failed to process notes', details: error.message });
  }
});

// Get note check results
app.get('/notes/results', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const results = await aiNoteChecker.getNoteCheckResults(
      parseInt(limit as string), 
      parseInt(offset as string)
    );
    
    res.json({ success: true, results });
  } catch (error: any) {
    console.error('Error fetching note check results:', error);
    res.status(500).json({ error: 'Failed to fetch results', details: error.message });
  }
});

// Get specific note check result
app.get('/notes/result/:encounterId', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const { encounterId } = req.params;
    
    if (!encounterId || typeof encounterId !== 'string') {
      res.status(400).json({ error: 'Encounter ID is required' });
      return;
    }
    
    const result = await aiNoteChecker.getNoteCheckResult(encounterId);
    
    if (!result) {
      res.status(404).json({ error: 'Note check result not found' });
      return;
    }
    
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Error fetching note check result:', error);
    res.status(500).json({ error: 'Failed to fetch result', details: error.message });
  }
});

// Mark an issue as invalid
app.post('/notes/:encounterId/issues/:checkId/:issueIndex/mark-invalid', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const { encounterId, checkId, issueIndex } = req.params;
    const { reason, issueType, assessment, issueHash } = req.body;
    const username = (req as any).user.username;
    
    if (!encounterId || !checkId || issueIndex === undefined) {
      res.status(400).json({ error: 'Encounter ID, check ID, and issue index are required' });
      return;
    }
    
    await vitalSignsDb.markIssueAsInvalid(
      encounterId,
      parseInt(checkId),
      parseInt(issueIndex),
      issueType,
      assessment,
      issueHash,
      username,
      reason
    );
    
    res.json({ 
      success: true, 
      message: 'Issue marked as invalid successfully'
    });
  } catch (error: any) {
    console.error('Error marking issue as invalid:', error);
    res.status(500).json({ error: 'Failed to mark issue as invalid', details: error.message });
  }
});

// Remove invalid marking from an issue
app.delete('/notes/:encounterId/issues/:checkId/:issueIndex/mark-invalid', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const { encounterId, checkId, issueIndex } = req.params;
    
    if (!encounterId || !checkId || issueIndex === undefined) {
      res.status(400).json({ error: 'Encounter ID, check ID, and issue index are required' });
      return;
    }
    
    await vitalSignsDb.unmarkIssueAsInvalid(
      encounterId,
      parseInt(checkId),
      parseInt(issueIndex)
    );
    
    res.json({ 
      success: true, 
      message: 'Invalid marking removed successfully'
    });
  } catch (error: any) {
    console.error('Error removing invalid marking:', error);
    res.status(500).json({ error: 'Failed to remove invalid marking', details: error.message });
  }
});

// Get invalid issues for an encounter
app.get('/notes/:encounterId/invalid-issues', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const { encounterId } = req.params;
    
    if (!encounterId) {
      res.status(400).json({ error: 'Encounter ID is required' });
      return;
    }
    
    const invalidIssues = await vitalSignsDb.getInvalidIssuesForEncounter(encounterId);
    
    res.json({ 
      success: true, 
      invalidIssues
    });
  } catch (error: any) {
    console.error('Error fetching invalid issues:', error);
    res.status(500).json({ error: 'Failed to fetch invalid issues', details: error.message });
  }
});

// Bulk force re-check: Enqueue multiple notes for force re-check
app.post('/notes/bulk-force-recheck', validateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobs } = req.body;
    
    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      res.status(400).json({ error: 'Jobs array is required and must not be empty' });
      return;
    }
    
    console.log(`🔄 Bulk force re-check requested for ${jobs.length} notes`);
    
    // Import the aiNoteCheckQueue from jobProcessor
    const { aiNoteCheckQueue } = require('./jobProcessor');
    
    let enqueuedCount = 0;
    const scanId = `bulk-force-${Date.now()}`;
    
    // Enqueue each job with force flag
    for (const [index, job] of jobs.entries()) {
      const { encounterId, patientId, patientName, chiefComplaint, dateOfService, force } = job;
      
      if (!encounterId || !patientId || !patientName || !chiefComplaint || !dateOfService) {
        console.warn(`⚠️ Skipping invalid job data for encounter ${encounterId}`);
        continue;
      }
      
      try {
        // Add individual note check job directly to the queue (same pattern as AI scan processor)
        await aiNoteCheckQueue.add('check-note', {
          encounterId,
          patientId,
          patientName,
          chiefComplaint,
          dateOfService,
          scanId,
          force: Boolean(force) // Include force flag to bypass MD5 checking
        }, {
          delay: index * 2000, // Stagger jobs every 2 seconds
          attempts: 1,
          removeOnComplete: 10,
          removeOnFail: 50
        });
        
        enqueuedCount++;
        console.log(`✅ Enqueued force re-check for encounter ${encounterId} (${patientName})`);
      } catch (jobError: any) {
        console.error(`❌ Failed to enqueue job for encounter ${encounterId}:`, jobError);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Successfully enqueued ${enqueuedCount} out of ${jobs.length} notes for force re-check`,
      enqueuedCount
    });
  } catch (error: any) {
    console.error('Error processing bulk force re-check:', error);
    res.status(500).json({ error: 'Failed to process bulk force re-check', details: error.message });
  }
});

// Token refresh function
async function refreshEZDermToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    console.log('🔄 Attempting to refresh EZDerm token...');
    
    const response: AxiosResponse<{ accessToken: string }> = await axios.get(EZDERM_REFRESH_URL, {
      headers: {
        'Host': 'login.ezinfra.net',
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'authorization': `Bearer ${refreshToken}`,
        'content-type': 'application/json',
        'origin': 'https://pms.ezderm.com',
        'referer': 'https://pms.ezderm.com/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
      }
    });

    const { accessToken } = response.data;
    console.log('✅ Token refresh successful');
    
    // Note: EZDerm refresh token API only returns new accessToken, not a new refreshToken
    // The refresh token remains the same and can be reused
    return {
      accessToken,
      refreshToken: refreshToken // Keep the same refresh token
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
      const loginData: EZDermAPILoginRequest = {
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
    console.log('🚀 Starting EZ Tracking Board Server...');
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Port: ${PORT}`);
    
    // Initialize database
    console.log('💾 Initializing database connection...');
    await vitalSignsDb.initialize();
    console.log('✅ Database initialized successfully');

    // Note: Job processors are handled by the dedicated worker service
    console.log('ℹ️ Job processing is handled by the dedicated worker service');

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

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 EZDerm API Base: ${EZDERM_LOGIN_URL}`);
      console.log(`🩺 Vital signs carryforward enabled (server-side jobs)`);
      console.log(`🤖 AI Note Checker enabled (Claude AI integration)`);
      console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`🔐 Login endpoint: http://0.0.0.0:${PORT}/login`);
      console.log(`📝 AI Note Checker endpoints: /notes/*`);
      console.log(`✅ Server startup complete!`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully shutting down API server...');
  await vitalSignsDb.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Gracefully shutting down API server...');
  await vitalSignsDb.close();
  process.exit(0);
});

startServer(); 