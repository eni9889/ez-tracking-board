import express, { Request, Response } from 'express';
import cors from 'cors';
import axios, { AxiosResponse } from 'axios';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
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
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/', limiter);

// Store tokens in memory (in production, use Redis or a database)
const tokenStore: TokenStore = new Map<string, StoredTokens>();

// EZDerm API endpoints
const EZDERM_LOGIN_URL = 'https://login.ezinfra.net/api/login';
const EZDERM_API_BASE = 'https://srvprod.ezinfra.net';

// Constants
const TOKEN_EXPIRY_MS = 600000; // 10 minutes
const DEFAULT_CLINIC_ID = '44b62760-50a1-488c-92ed-e0c7aa3cde92';
const DEFAULT_PRACTICE_ID = '4cc96922-4d83-4183-863b-748d69de621f';
const ACTIVE_STATUSES: EncounterStatus[] = [
  'SCHEDULED',
  'CONFIRMED', 
  'MESSAGE_LEFT',
  'CHECKED_IN', 
  'IN_ROOM', 
  'WITH_PROVIDER',
  'WITH_STAFF',
  'READY_FOR_STAFF',
  'PENDING_COSIGN'
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

    // Return success response
    res.json({
      success: true,
      username,
      serverUrl: servers.app
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
app.post('/api/encounters', async (req: Request<{}, EncountersResponse | ErrorResponse, EncountersRequest>, res: Response<EncountersResponse | ErrorResponse>) => {
  try {
    const { username, dateRangeStart, dateRangeEnd, clinicId, providerIds } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    // Get stored tokens
    const userTokens = tokenStore.get(username);
    if (!userTokens) {
      res.status(401).json({ error: 'User not authenticated. Please login first.' });
      return;
    }

    // Check if token is expired
    if (isTokenExpired(userTokens)) {
      tokenStore.delete(username);
      res.status(401).json({ error: 'Session expired. Please login again.' });
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

    console.log('Sending request to EZDerm API:', encounterData);

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
    console.log('allEncounters', allEncounters);

    // Filter to only show patients currently in clinic (not checked out)
    const activeEncounters = allEncounters.filter(encounter => {
      console.log('encounter.status', encounter.status);
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

// Logout endpoint
app.post('/api/logout', (req: Request<{}, { success: boolean }, LogoutRequest>, res: Response<{ success: boolean }>) => {
  const { username } = req.body;
  if (username) {
    tokenStore.delete(username);
  }
  res.json({ success: true });
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
app.post('/api/vital-signs/process/:encounterId', async (req: Request, res: Response) => {
  try {
    const encounterId = req.params.encounterId;
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required in request body' });
    }
    
    if (!encounterId) {
      return res.status(400).json({ error: 'Encounter ID is required' });
    }
    
    // Get stored tokens
    const userTokens = tokenStore.get(username);
    if (!userTokens) {
      return res.status(401).json({ error: 'User not authenticated. Please login first.' });
    }
    
    // Check if token is expired
    if (isTokenExpired(userTokens)) {
      tokenStore.delete(username);
      return res.status(401).json({ error: 'Session expired. Please login again.' });
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
app.post('/api/vital-signs/process-all', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required in request body' });
    }
    
    // Get stored tokens
    const userTokens = tokenStore.get(username);
    if (!userTokens) {
      return res.status(401).json({ error: 'User not authenticated. Please login first.' });
    }
    
    // Check if token is expired
    if (isTokenExpired(userTokens)) {
      tokenStore.delete(username);
      return res.status(401).json({ error: 'Session expired. Please login again.' });
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