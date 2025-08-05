import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios, { AxiosResponse } from 'axios';
import { vitalSignsDb } from './database';
import { vitalSignsService } from './vitalSignsService';
import {
  EZDermLoginRequest,
  EZDermLoginResponse,
  EZDermEncounterFilter,
  EZDermEncounter,
  Encounter,
  EncounterStatus
} from './types';

// Redis connection configuration
const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Create queue for vital signs processing
export const vitalSignsQueue = new Queue('vital-signs-processing', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 10, // Keep only last 10 completed jobs
    removeOnFail: 50,     // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// EZDerm API configuration
const EZDERM_LOGIN_URL = 'https://login.ezinfra.net/api/login';
const EZDERM_REFRESH_URL = 'https://login.ezinfra.net/api/refresh';
const DEFAULT_CLINIC_ID = '44b62760-50a1-488c-92ed-e0c7aa3cde92';
const DEFAULT_PRACTICE_ID = '4cc96922-4d83-4183-863b-748d69de621f';

// Active statuses that should be processed
const TARGET_STATUSES: EncounterStatus[] = ['READY_FOR_STAFF', 'WITH_STAFF'];

// Development filter - only process this specific patient in dev mode
const DEV_PATIENT_MRN = 'EZTE0000';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Date formatting utilities
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

// Transform EZDerm encounter to our format
const transformEZDermEncounter = (encounter: EZDermEncounter): Encounter => {
  return {
    id: encounter.id,
    patientName: `${encounter.patientInfo.firstName} ${encounter.patientInfo.lastName}`,
    patientInfo: {
      firstName: encounter.patientInfo.firstName,
      lastName: encounter.patientInfo.lastName,
      dateOfBirth: encounter.patientInfo.dateOfBirth,
      id: encounter.patientInfo.id,
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

// Login to EZDerm with stored credentials
async function loginToEZDerm(username: string, password: string): Promise<{ accessToken: string; refreshToken: string; serverUrl: string } | null> {
  try {
    const loginData: EZDermLoginRequest = {
      username,
      password,
      application: 'EZDERM',
      timeZoneId: 'America/Detroit',
      clientVersion: '4.28.0'
    };

    const response: AxiosResponse<EZDermLoginResponse> = await axios.post(EZDERM_LOGIN_URL, loginData, {
      headers: {
        'Host': 'login.ezinfra.net',
        'accept': 'application/json',
        'content-type': 'application/json',
        'user-agent': 'ezDerm/4.28.0 (com.ezderm.ezderm; build:132.19; macOS(Catalyst) 15.5.0) Alamofire/5.10.2',
        'accept-language': 'en-US;q=1.0'
      }
    });

    const { accessToken, refreshToken, servers } = response.data;
    
    // Store tokens in database
    await vitalSignsDb.storeTokens(username, accessToken, refreshToken, servers.app);
    
    return {
      accessToken,
      refreshToken,
      serverUrl: servers.app
    };
  } catch (error: any) {
    console.error('EZDerm login failed:', error.response?.data || error.message);
    return null;
  }
}

// Token refresh function for job processor
async function refreshEZDermTokenInJob(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    console.log('🔄 Job: Attempting to refresh EZDerm token...');
    
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
    console.log('✅ Job: Token refresh successful');
    
    return {
      accessToken,
      refreshToken: newRefreshToken
    };
  } catch (error: any) {
    console.error('❌ Job: Token refresh failed:', error.response?.data || error.message);
    return null;
  }
}

// Enhanced function to get valid tokens in job context
async function getValidTokensForJob(username: string): Promise<{ accessToken: string; refreshToken: string; serverUrl: string } | null> {
  try {
    // First, try to get stored tokens
    let tokens = await vitalSignsDb.getStoredTokens(username);
    
    if (tokens) {
      // Tokens are valid and not expired
      return tokens;
    }
    
    // Tokens are expired or don't exist, try to refresh
    console.log(`🔄 Job: Tokens expired for user ${username}, attempting refresh...`);
    
    // Get the refresh token even if access token is expired
    const expiredTokenData = await vitalSignsDb.getStoredTokensIgnoreExpiry(username);
    
    if (expiredTokenData?.refreshToken) {
      const refreshedTokens = await refreshEZDermTokenInJob(expiredTokenData.refreshToken);
      
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
    console.log(`🔑 Job: Token refresh failed for user ${username}, attempting re-login...`);
    const credentials = await vitalSignsDb.getUserCredentials(username);
    
    if (credentials) {
      const authData = await loginToEZDerm(credentials.username, credentials.password);
      if (authData) {
        console.log(`✅ Job: Re-login successful for user ${username}`);
        return authData;
      }
    }
    
    console.log(`❌ Job: No valid credentials found for user ${username}`);
    return null;
    
  } catch (error: any) {
    console.error(`💥 Job: Error getting valid tokens for user ${username}:`, error.message);
    return null;
  }
}

// Get today's encounters from EZDerm
async function getTodaysEncounters(accessToken: string, serverUrl: string): Promise<Encounter[]> {
  try {
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

    const response: AxiosResponse<EZDermEncounter[]> = await axios.post(
      `${serverUrl}ezderm-webservice/rest/encounter/getByFilter`,
      encounterData,
      {
        headers: {
          'Host': 'srvprod.ezinfra.net',
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': `Bearer ${accessToken}`,
          'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
          'accept-language': 'en-US;q=1.0'
        }
      }
    );

    return response.data.map(transformEZDermEncounter);
  } catch (error: any) {
    console.error('Failed to fetch encounters:', error.response?.data || error.message);
    throw error;
  }
}

// Job processor function
async function processVitalSignsCarryforward(job: Job): Promise<{ processed: number; successful: number; failed: number }> {
  console.log('🔄 Starting vital signs carryforward job...');
  
  try {
    // Get stored credentials
    const credentials = await vitalSignsDb.getActiveUserCredentials();
    if (!credentials) {
      throw new Error('No active user credentials found. Please login through the frontend first.');
    }

    // Get valid tokens (with automatic refresh if needed)
    let authData = await getValidTokensForJob(credentials.username);
    
    if (!authData) {
      throw new Error('Failed to obtain valid EZDerm tokens');
    }

    // Get today's encounters
    const allEncounters = await getTodaysEncounters(authData.accessToken, authData.serverUrl);
    
    // Filter to target statuses (READY_FOR_STAFF, WITH_STAFF)
    let targetEncounters = allEncounters.filter(encounter => 
      TARGET_STATUSES.includes(encounter.status)
    );

    if (targetEncounters.length === 0) {
      const statusMsg = 'No patients found with READY_FOR_STAFF or WITH_STAFF status';
      console.log(`ℹ️ ${statusMsg}`);
      return { processed: 0, successful: 0, failed: 0 };
    }

    const modeMsg = IS_DEVELOPMENT ? ' (development mode - filtered to specific patient)' : '';
    console.log(`📋 Found ${targetEncounters.length} patients to process for vital signs carryforward${modeMsg}`);

    // Process each encounter
    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const encounter of targetEncounters) {
      try {
        // Check if already processed
        const alreadyProcessed = await vitalSignsDb.hasBeenProcessed(encounter.id);
        if (alreadyProcessed) {
          console.log(`⏭️ Skipping ${encounter.patientName} - already processed`);
          continue;
        }

        processed++;
        console.log(`🩺 Processing vital signs for ${encounter.patientName} (${encounter.status})`);
        console.log(`📋 Encounter data: ID=${encounter.id}, PatientID=${(encounter.patientInfo as any)?.id}, PatientName=${encounter.patientInfo?.firstName} ${encounter.patientInfo?.lastName}`);
        
        const result = await vitalSignsService.processVitalSignsCarryforward(encounter, authData.accessToken);
        
        if (result) {
          successful++;
          console.log(`✅ Successfully processed vital signs for ${encounter.patientName}`);
        } else {
          failed++;
          console.log(`❌ Failed to process vital signs for ${encounter.patientName}`);
        }
      } catch (error) {
        processed++;
        failed++;
        console.error(`💥 Error processing ${encounter.patientName}:`, error);
      }
    }

    const summary = { processed, successful, failed };
    console.log(`🏁 Vital signs job completed: ${JSON.stringify(summary)}`);
    
    return summary;
    
  } catch (error) {
    console.error('💥 Vital signs job failed:', error);
    throw error;
  }
}

// Create worker
export const vitalSignsWorker = new Worker('vital-signs-processing', processVitalSignsCarryforward, {
  connection: redis,
  concurrency: 1, // Only one job at a time
});

// Worker event handlers
vitalSignsWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

vitalSignsWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

vitalSignsWorker.on('error', (err) => {
  console.error('🚨 Worker error:', err);
});

// Start the recurring job
export async function startVitalSignsJob(): Promise<void> {
  try {
    // Clear any existing jobs first
    await vitalSignsQueue.obliterate({ force: true });
    
    // Add recurring job every 10 seconds
    await vitalSignsQueue.add(
      'process-vital-signs',
      {},
      {
        repeat: {
          every: 10000, // 10 seconds
        },
        jobId: 'vital-signs-carryforward', // Ensures only one instance
      }
    );

    console.log('🚀 Vital signs carryforward job started (every 10 seconds)');
  } catch (error) {
    console.error('Failed to start vital signs job:', error);
    throw error;
  }
}

// Stop the job system
export async function stopVitalSignsJob(): Promise<void> {
  try {
    await vitalSignsWorker.close();
    await vitalSignsQueue.close();
    await redis.quit();
    console.log('🛑 Vital signs job system stopped');
  } catch (error) {
    console.error('Error stopping vital signs job system:', error);
  }
} 