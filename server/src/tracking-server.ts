import express, { Request, Response } from 'express';
import cors from 'cors';
import axios, { AxiosResponse } from 'axios';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
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
const formatDateWithOffset = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00-0400`;
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

    // Store tokens with username as key
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

    // Get today's date for default range
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Prepare request data exactly like the curl command
    const encounterData: EZDermEncounterFilter = {
      dateOfServiceRangeHigh: dateRangeEnd || formatDateWithOffset(tomorrow),
      clinicId: clinicId || DEFAULT_CLINIC_ID,
      providerIds: providerIds || [],
      practiceId: DEFAULT_PRACTICE_ID,
      dateOfServiceRangeLow: dateRangeStart || formatDateWithOffset(today),
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

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 EZDerm API Base: ${EZDERM_API_BASE}`);
}); 