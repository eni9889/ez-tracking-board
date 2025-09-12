import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios from './axiosConfig';
import { AxiosResponse } from 'axios';
import { vitalSignsDb } from './database';
import { vitalSignsService } from './vitalSignsService';
import { benefitsService } from './benefitsService';
import { aiNoteChecker } from './aiNoteChecker';
import { appConfig } from './config';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs
dayjs.extend(utc);
dayjs.extend(timezone);
import {
  EZDermLoginRequest,
  EZDermLoginResponse,
  EZDermEncounterFilter,
  EZDermEncounter,
  Encounter,
  EncounterStatus,
  AINoteScanJobData,
  AINoteCheckJobData,
  ToDoCompletionCheckJobData,
  StoredTokens
} from './types';

// Redis connection configuration
const redisConfig: any = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required by BullMQ
};

// Add password if provided
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

// Add TLS support for DigitalOcean managed Redis
if (process.env.NODE_ENV === 'production') {
  redisConfig.tls = { rejectUnauthorized: false };
}

const redis = new IORedis(redisConfig);

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

// Create queue for AI note scanning (finding notes to check)
export const aiNoteScanQueue = new Queue('ai-note-scan', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 5,  // Keep only last 5 completed scans
    removeOnFail: 20,     // Keep last 20 failed scans
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
});

// Create queue for individual AI note checking
export const aiNoteCheckQueue = new Queue('ai-note-check', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50, // Keep more completed individual checks
    removeOnFail: 100,    // Keep more failed individual checks
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 15000,
    },
  },
});

// Create queue for benefits eligibility processing
export const benefitsEligibilityQueue = new Queue('benefits-eligibility-processing', {
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

// Create queue for ToDo completion checking
export const todoCompletionCheckQueue = new Queue('todo-completion-check', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 5,  // Keep only last 5 completed scans
    removeOnFail: 20,     // Keep last 20 failed scans
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
});

// EZDerm API configuration
const EZDERM_LOGIN_URL = 'https://login.ezinfra.net/api/login';
const EZDERM_REFRESH_URL = 'https://login.ezinfra.net/api/refreshToken/getAccessToken';
const DEFAULT_CLINIC_ID = '44b62760-50a1-488c-92ed-e0c7aa3cde92';
const DEFAULT_PRACTICE_ID = '4cc96922-4d83-4183-863b-748d69de621f';

// Active statuses that should be processed
const TARGET_STATUSES: EncounterStatus[] = ['READY_FOR_STAFF', 'WITH_STAFF'];

// Development filter - only process this specific patient in dev mode
const DEV_PATIENT_MRN = 'EZTE0000';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// AI Note Checker instance (imported from aiNoteChecker.ts)

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
    console.log('✅ Job: Token refresh successful');
    
    // Note: EZDerm refresh token API only returns new accessToken, not a new refreshToken
    // The refresh token remains the same and can be reused
    return {
      accessToken,
      refreshToken: refreshToken // Keep the same refresh token
    };
  } catch (error: any) {
    console.error('❌ Job: Token refresh failed:', error.response?.data || error.message);
    return null;
  }
}

// Enhanced function to get valid tokens using service user credentials
async function getValidTokensForJob(): Promise<{ accessToken: string; refreshToken: string; serverUrl: string } | null> {
  try {
    const serviceUser = appConfig.ezderm.serviceUser;
    const servicePassword = appConfig.ezderm.servicePassword;
    
    if (!serviceUser || !servicePassword) {
      console.error('❌ Job: EZDerm service user credentials not configured. Set EZDERM_USER and EZDERM_PASS environment variables.');
      return null;
    }
    
    console.log(`🔑 Job: Using service user: ${serviceUser}`);
    
    // First, try to get stored tokens for the service user
    let tokens = await vitalSignsDb.getStoredTokens(serviceUser);
    
    if (tokens) {
      // Tokens are valid and not expired
      console.log(`✅ Job: Using cached tokens for service user: ${serviceUser}`);
      return tokens;
    }
    
    // Tokens are expired or don't exist, try to refresh
    console.log(`🔄 Job: Tokens expired for service user ${serviceUser}, attempting refresh...`);
    
    // Get the refresh token even if access token is expired
    const expiredTokenData = await vitalSignsDb.getStoredTokensIgnoreExpiry(serviceUser);
    
    if (expiredTokenData?.refreshToken) {
      const refreshedTokens = await refreshEZDermTokenInJob(expiredTokenData.refreshToken);
      
      if (refreshedTokens) {
        // Store the new tokens
        await vitalSignsDb.storeTokens(serviceUser, refreshedTokens.accessToken, refreshedTokens.refreshToken, expiredTokenData.serverUrl);
        
        console.log(`✅ Job: Token refresh successful for service user: ${serviceUser}`);
        return {
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken,
          serverUrl: expiredTokenData.serverUrl
        };
      }
    }
    
    // Refresh failed, try fresh login with service credentials
    console.log(`🔑 Job: Token refresh failed for service user ${serviceUser}, attempting fresh login...`);
    const authData = await loginToEZDerm(serviceUser, servicePassword);
    
    if (authData) {
      console.log(`✅ Job: Fresh login successful for service user: ${serviceUser}`);
      return authData;
    }
    
    console.log(`❌ Job: Failed to authenticate service user: ${serviceUser}`);
    return null;
    
  } catch (error: any) {
    console.error(`💥 Job: Error getting valid tokens for service user:`, error.message);
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

// Get tomorrow's encounters from EZDerm for benefits eligibility checks
async function getTomorrowsEncounters(accessToken: string, serverUrl: string): Promise<Encounter[]> {
  try {
    // Use dayjs for proper date handling in Eastern timezone
    const tomorrow = dayjs().tz('America/Detroit').add(1, 'day');
    const tomorrowStart = tomorrow.startOf('day');
    const tomorrowEnd = tomorrow.endOf('day');
    
    // Use the exact format from encounters.md
    const encounterData = {
      practiceId: DEFAULT_PRACTICE_ID,
      lightBean: true,
      includeVirtualEncounters: false,
      dateSelection: 'SPECIFY_RANGE',
      dateOfServiceRangeLow: tomorrowStart.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]').replace('Z', '-04:00'),
      dateOfServiceRangeHigh: tomorrowEnd.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]').replace('Z', '-04:00')
    };

    console.log(`Today: ${dayjs().tz('America/Detroit').format('YYYY-MM-DD HH:mm:ss')} (EDT)`);
    console.log(`Tomorrow: ${tomorrow.format('YYYY-MM-DD')} (EDT)`);
    console.log(`Fetching tomorrow's encounters: ${encounterData.dateOfServiceRangeLow} to ${encounterData.dateOfServiceRangeHigh}`);

    const response: AxiosResponse<EZDermEncounter[]> = await axios.post(
      `${serverUrl}ezderm-webservice/rest/encounter/getByFilter`,
      encounterData,
      {
        headers: {
          'accept': 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'origin': 'https://pms.ezderm.com',
          'referer': 'https://pms.ezderm.com/',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
        }
      }
    );

    return response.data.map(transformEZDermEncounter);
  } catch (error: any) {
    console.error('Failed to fetch tomorrow\'s encounters:', error.response?.data || error.message);
    throw error;
  }
}

// Job processor function
async function processVitalSignsCarryforward(job: Job): Promise<{ processed: number; successful: number; failed: number }> {
  console.log('🔄 Starting vital signs carryforward job...');
  
  try {
    // Get stored credentials
    // Get valid tokens using service user credentials
    let authData = await getValidTokensForJob();
    
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

    // Process each encounter
    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const encounter of targetEncounters) {
      try {
        // Check if already processed
        const alreadyProcessed = await vitalSignsDb.hasBeenProcessed(encounter.id);
        if (alreadyProcessed) {
          console.debug(`⏭️ Skipping ${encounter.patientName} - already processed`);
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

// Token management helper for AI note checking jobs (reuse existing pattern)
const getValidTokensForAI = async (): Promise<{ accessToken: string; refreshToken: string; serverUrl: string } | null> => {
  // Use the service user token management function
  return await getValidTokensForJob();
};

// Helper function to find the first appointment time for tomorrow
function getFirstAppointmentTime(encounters: Encounter[]): dayjs.Dayjs | null {
  if (encounters.length === 0) {
    return null;
  }

  // Sort encounters by appointment time and get the earliest one
  const sortedEncounters = encounters
    .filter(encounter => encounter.appointmentTime)
    .map(encounter => ({
      ...encounter,
      appointmentTimeDayjs: dayjs(encounter.appointmentTime).tz('America/Detroit')
    }))
    .sort((a, b) => a.appointmentTimeDayjs.valueOf() - b.appointmentTimeDayjs.valueOf());

  if (sortedEncounters.length === 0) {
    return null;
  }

  const firstEncounter = sortedEncounters[0];
  return firstEncounter ? firstEncounter.appointmentTimeDayjs : null;
}

// Benefits eligibility job processor function
async function processBenefitsEligibilityCheck(job: Job): Promise<{ processed: number; successful: number; failed: number }> {
  console.log('💰 Starting benefits eligibility check job...');
  
  try {
    // Get valid tokens using service user credentials
    let authData = await getValidTokensForJob();
    
    if (!authData) {
      throw new Error('Failed to obtain valid EZDerm tokens');
    }

    // Get tomorrow's encounters
    const allEncounters = await getTomorrowsEncounters(authData.accessToken, authData.serverUrl);
    
    if (allEncounters.length === 0) {
      const statusMsg = 'No appointments found for tomorrow';
      console.log(`ℹ️ ${statusMsg}`);
      return { processed: 0, successful: 0, failed: 0 };
    }

    // Find the first appointment time
    const firstAppointmentTime = getFirstAppointmentTime(allEncounters);
    
    if (!firstAppointmentTime) {
      console.log('ℹ️ No valid appointment times found for tomorrow');
      return { processed: 0, successful: 0, failed: 0 };
    }

    console.log(`🎯 Running benefits eligibility check. First appointment at ${firstAppointmentTime.format('YYYY-MM-DD HH:mm:ss')} (EDT), running at optimal time.`);

    // Process each encounter
    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const encounter of allEncounters) {
      try {
        // Check if already processed
        const alreadyProcessed = await vitalSignsDb.hasBenefitsEligibilityBeenProcessed(encounter.id);
        if (alreadyProcessed) {
          console.debug(`⏭️ Skipping ${encounter.patientName} - already processed`);
          continue;
        }

        processed++;
        console.log(`💰 Processing benefits eligibility for ${encounter.patientName} (appointment at ${encounter.appointmentTime})`);
        console.log(`📋 Encounter data: ID=${encounter.id}, PatientID=${(encounter.patientInfo as any)?.id}, PatientName=${encounter.patientInfo?.firstName} ${encounter.patientInfo?.lastName}`);
        
        // Map the encounter to the benefits encounter interface
        const benefitsEncounter = {
          id: encounter.id,
          patientInfo: {
            id: encounter.patientInfo.id,
            firstName: encounter.patientInfo.firstName,
            lastName: encounter.patientInfo.lastName,
            dateOfBirth: encounter.patientInfo.dateOfBirth,
          },
          appointmentTime: encounter.appointmentTime,
          status: encounter.status,
          establishedPatient: encounter.establishedPatient
        };
        
        const result = await benefitsService.processBenefitsEligibilityCheck(benefitsEncounter, authData.accessToken);
        
        if (result) {
          successful++;
          console.log(`✅ Successfully processed benefits eligibility for ${encounter.patientName}`);
        } else {
          failed++;
          console.log(`❌ Failed to process benefits eligibility for ${encounter.patientName}`);
        }
      } catch (error) {
        processed++;
        failed++;
        console.error(`💥 Error processing ${encounter.patientName}:`, error);
      }
    }

    const summary = { processed, successful, failed };
    console.log(`🏁 Benefits eligibility job completed: ${JSON.stringify(summary)}`);
    
    return summary;
    
  } catch (error) {
    console.error('💥 Benefits eligibility job failed:', error);
    throw error;
  }
}

// AI Note Scan Job Processor
const processAINoteScan = async (job: Job<AINoteScanJobData>) => {
  const { scanId, batchSize = 100 } = job.data;
  
  console.log(`🔍 Starting AI note scan, scanId: ${scanId}`);
  
  try {
    // Get valid tokens using service user credentials
    const tokens = await getValidTokensForAI();
    if (!tokens) {
      throw new Error('Failed to get valid tokens for service user');
    }

    console.log('🔑 Using service user credentials for AI note scanning');

    // Fetch incomplete notes
    const incompleteNotes = await aiNoteChecker.fetchIncompleteNotes(tokens.accessToken, {
      fetchFrom: 0,
      size: batchSize
    });

    let totalEligible = 0;
    let totalQueued = 0;

    // Process each batch
    for (const batch of incompleteNotes) {
      if (batch.incompletePatientEncounters) {
        for (const patientData of batch.incompletePatientEncounters) {
          for (const encounter of patientData.incompleteEncounters) {
            // Apply same eligibility filter as the main endpoint
            const eligibleStatuses = ['PENDING_COSIGN', 'CHECKED_OUT', 'WITH_PROVIDER'];
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            const serviceDate = new Date(encounter.dateOfService);
            
            const isEligible = eligibleStatuses.includes(encounter.status) && serviceDate < thirtyMinutesAgo;
            
            if (isEligible) {
              totalEligible++;
              
              // Check if we already have a recent check for this note
              const existingCheck = await vitalSignsDb.getNoteCheckByEncounterId(encounter.id);
              
              // Only queue if no existing check or if it's been more than 6 hours
              const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
              const shouldCheck = !existingCheck || 
                                 (existingCheck.status === 'error') ||
                                 (new Date(existingCheck.checkedAt) < sixHoursAgo);
              
              if (shouldCheck) {
                // Queue individual note check
                await aiNoteCheckQueue.add('check-note', {
                  encounterId: encounter.id,
                  patientId: patientData.id,
                  patientName: `${patientData.firstName} ${patientData.lastName}`,
                  chiefComplaint: encounter.chiefComplaintName || 'No chief complaint',
                  dateOfService: encounter.dateOfService,
                  scanId
                }, {
                  delay: totalQueued * 5000, // Stagger jobs every 5 seconds
                });
                
                totalQueued++;
                console.log(`📝 Queued note check for encounter: ${encounter.id} (${patientData.firstName} ${patientData.lastName})`);
              } else {
                console.debug(`⏭️ Skipping encounter ${encounter.id}: recent check exists`);
              }
            }
          }
        }
      }
    }

    console.log(`✅ AI note scan completed. Found ${totalEligible} eligible encounters, queued ${totalQueued} for checking`);
    
    return {
      scanId,
      totalEligible,
      totalQueued,
      completedAt: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error(`❌ AI note scan failed`, error);
    throw error;
  }
};

// AI Note Check Job Processor
const processAINoteCheck = async (job: Job<AINoteCheckJobData>) => {
  const { encounterId, patientId, patientName, chiefComplaint, dateOfService, scanId, force } = job.data;
  
  console.log(`🤖 Starting AI check for encounter: ${encounterId} (${patientName})`);
  console.log(`📅 Date of service: ${dateOfService} (type: ${typeof dateOfService})`);
  if (force) {
    console.log(`🔄 Force flag enabled - bypassing MD5 duplicate detection`);
  }
  
  try {
    // Get stored credentials (SAME PATTERN AS VITAL SIGNS)
    // Use the same robust token management as vital signs
    console.log('🔑 AI Job: Getting valid tokens using service user credentials');
    const tokens = await getValidTokensForJob();
    if (!tokens) {
      throw new Error('Failed to get valid tokens for service user');
    }
    console.log('✅ AI Job: Got valid tokens using service user credentials');

    // Perform the AI check with force flag
    const checkResult = await aiNoteChecker.checkSingleNote(
      tokens.accessToken,  // 1st: accessToken
      encounterId,         // 2nd: encounterId  
      patientId,           // 3rd: patientId
      patientName,         // 4th: patientName
      chiefComplaint,      // 5th: chiefComplaint
      dateOfService,       // 6th: dateOfService
      appConfig.ezderm.serviceUser, // 7th: checkedBy
      Boolean(force)       // 8th: force flag
    );

    // Get the AI analysis result to check for issues
    const noteCheckResult = await vitalSignsDb.getNoteCheckResult(encounterId);
    
    console.log(`✅ AI check completed for encounter: ${encounterId}, checkId: ${checkResult.id}`);
    
    // Immediately verify the result was saved by reading it back
    const verifyResult = await vitalSignsDb.getNoteCheckResult(encounterId);
    if (verifyResult && verifyResult.id === checkResult.id) {
      console.log(`✅ Verified: Background job result saved and readable for encounter ${encounterId}`);
    } else {
      console.error(`❌ Warning: Could not verify saved result for encounter ${encounterId}. Expected ID: ${checkResult.id}, Found: ${verifyResult?.id || 'null'}`);
    }
    
    return {
      encounterId,
      patientName,
      checkId: checkResult.id,
      scanId,
      issuesFound: noteCheckResult?.issues_found || false,
      completedAt: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error(`❌ AI check failed for encounter: ${encounterId}`, error);
    
    // Check if this is a retryable error from Anthropic (529 overloaded or timeout)
    const isRetryableError = (
      // 529 Overloaded errors
      error.message?.includes('Request failed with status code 529') ||
      error.message?.includes('Overloaded') ||
      (error.response?.status === 529) ||
      (error.response?.data?.error?.type === 'overloaded_error') ||
      // Timeout errors
      error.message?.includes('timeout of') ||
      error.message?.includes('exceeded') ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT'
    );
    
    if (isRetryableError) {
      // Determine error type for logging
      const isTimeout = error.message?.includes('timeout') || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      const errorType = isTimeout ? 'timeout' : 'overloaded (529)';
      
      console.log(`🔄 Anthropic API ${errorType} for encounter ${encounterId}, will retry...`);
      
      // Get current attempt count
      const attemptsMade = (job.attemptsMade || 0) + 1;
      const maxRetries = 5; // Maximum 5 retries for API errors
      
      if (attemptsMade < maxRetries) {
        // Calculate exponential backoff delay (2^attempts * 30 seconds)
        const delaySeconds = Math.min(Math.pow(2, attemptsMade) * 30, 300); // Max 5 minutes
        console.log(`⏱️ Scheduling retry ${attemptsMade}/${maxRetries} in ${delaySeconds} seconds for encounter ${encounterId} (${errorType})`);
        
        // Re-enqueue the job with delay
        await aiNoteCheckQueue.add('ai-note-check', job.data, {
          delay: delaySeconds * 1000, // Convert to milliseconds
          attempts: 1, // Each retry is treated as a new job
          removeOnComplete: 10,
          removeOnFail: 50
        });
        
        // Mark this job as completed successfully (since we're handling the retry manually)
        return {
          encounterId,
          patientName,
          status: 'retrying',
          attemptsMade,
          nextRetryIn: delaySeconds,
          reason: `Anthropic API ${errorType}`,
          scanId
        };
      } else {
        console.error(`❌ Max retries (${maxRetries}) exceeded for encounter ${encounterId} due to Anthropic ${errorType} errors`);
        throw new Error(`AI analysis failed after ${maxRetries} retries due to Anthropic API ${errorType}`);
      }
    }
    
    // For other errors, throw immediately (no retry)
    throw error;
  }
};

// ToDo Completion Check Job Processor
const processToDoCompletionCheck = async (job: Job<ToDoCompletionCheckJobData>) => {
  const { scanId, batchSize = 50 } = job.data;
  
  console.log(`🔍 Starting ToDo completion check, scanId: ${scanId}`);
  
  try {
    // Get valid tokens using service user credentials
    const tokens = await getValidTokensForJob();
    if (!tokens) {
      throw new Error('Failed to get valid tokens for service user');
    }

    console.log('🔑 Using service user credentials for ToDo completion checking');

    // Get ToDos that need status checking
    const todosToCheck = await vitalSignsDb.getToDosForStatusCheck();
    
    if (todosToCheck.length === 0) {
      console.log('ℹ️ No ToDos found that need status checking');
      return {
        scanId,
        totalChecked: 0,
        completedTodos: 0,
        followupChecksTriggered: 0,
        completedAt: new Date().toISOString()
      };
    }

    console.log(`📋 Found ${todosToCheck.length} ToDos to check for completion`);

    let totalChecked = 0;
    let completedTodos = 0;
    let followupChecksTriggered = 0;

    // Process each ToDo (limit by batchSize)
    const todosToProcess = todosToCheck.slice(0, batchSize);
    
    for (const todo of todosToProcess) {
      try {
        totalChecked++;
        
        console.log(`📋 Checking ToDo status: ${todo.ezDermToDoId} for encounter: ${todo.encounterId}`);
        
        // Fetch ToDo status from EZDerm
        const todoStatus = await aiNoteChecker.fetchToDoStatus(
          tokens.accessToken,
          todo.ezDermToDoId,
          todo.patientId
        );
        
        if (todoStatus) {
          const isCompleted = todoStatus.status === 'COMPLETED' || todoStatus.status === 'CLOSED';
          
          if (isCompleted) {
            completedTodos++;
            console.log(`✅ ToDo ${todo.ezDermToDoId} is completed with status: ${todoStatus.status}`);
            
            // Track this completion
            await vitalSignsDb.trackToDoCompletion(
              todo.encounterId,
              todo.ezDermToDoId,
              todoStatus.status
            );
            
            // Check if there was a previous AI check for this encounter
            const previousAiCheck = await vitalSignsDb.getNoteCheckResult(todo.encounterId);
            
            if (previousAiCheck) {
              console.log(`🤖 Previous AI check found for encounter ${todo.encounterId}, triggering follow-up AI check`);
              
              // Queue a new AI check for this encounter with force=true
              await aiNoteCheckQueue.add('todo-completion-followup-check', {
                encounterId: todo.encounterId,
                patientId: todo.patientId,
                patientName: todo.patientName,
                chiefComplaint: 'ToDo Completion Follow-up',
                dateOfService: new Date().toISOString(),
                scanId: `todo-followup-${Date.now()}`,
                force: true
              }, {
                delay: followupChecksTriggered * 10000, // Stagger by 10 seconds
              });
              
              followupChecksTriggered++;
              console.log(`📝 Queued follow-up AI check for encounter: ${todo.encounterId}`);
            } else {
              console.log(`ℹ️ No previous AI check found for encounter ${todo.encounterId}, skipping follow-up`);
            }
          } else {
            // Still open, track it as checked but not completed
            await vitalSignsDb.trackToDoCompletion(
              todo.encounterId,
              todo.ezDermToDoId,
              todoStatus.status
            );
            console.log(`⏳ ToDo ${todo.ezDermToDoId} is still open with status: ${todoStatus.status}`);
          }
        } else {
          // ToDo not found, might have been deleted
          await vitalSignsDb.trackToDoCompletion(
            todo.encounterId,
            todo.ezDermToDoId,
            'NOT_FOUND'
          );
          console.log(`❓ ToDo ${todo.ezDermToDoId} not found (may have been deleted)`);
        }
        
      } catch (error: any) {
        console.error(`❌ Error checking ToDo ${todo.ezDermToDoId}:`, error.message);
      }
    }

    console.log(`✅ ToDo completion check completed. Checked: ${totalChecked}, Completed: ${completedTodos}, Follow-up checks triggered: ${followupChecksTriggered}`);
    
    return {
      scanId,
      totalChecked,
      completedTodos,
      followupChecksTriggered,
      completedAt: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error(`❌ ToDo completion check failed`, error);
    throw error;
  }
};

// Workers - will be created only when explicitly started
export let vitalSignsWorker: Worker | null = null;
export let benefitsEligibilityWorker: Worker | null = null;
export let aiNoteScanWorker: Worker | null = null;
export let aiNoteCheckWorker: Worker | null = null;
export let todoCompletionCheckWorker: Worker | null = null;

// Worker event handlers - will be set up when workers are created

// Start the recurring job
export async function startVitalSignsJob(): Promise<void> {
  try {
    // Create the worker if it doesn't exist
    if (!vitalSignsWorker) {
      vitalSignsWorker = new Worker('vital-signs-processing', processVitalSignsCarryforward, {
        connection: redis,
        concurrency: 1, // Only one job at a time
      });

      // Set up event handlers
      vitalSignsWorker.on('completed', (job) => {
        console.log(`✅ Job ${job.id} completed successfully`);
      });

      vitalSignsWorker.on('failed', (job, err) => {
        console.error(`❌ Job ${job?.id} failed:`, err);
      });

      vitalSignsWorker.on('error', (err) => {
        console.error('🚨 Worker error:', err);
      });
    }

    // Pause the queue first, then clear any existing jobs
    await vitalSignsQueue.pause();
    await vitalSignsQueue.obliterate({ force: true });
    
    // Resume the queue
    await vitalSignsQueue.resume();
    
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

// Start the benefits eligibility job
export async function startBenefitsEligibilityJob(): Promise<void> {
  try {
    // Create the worker if it doesn't exist
    if (!benefitsEligibilityWorker) {
      benefitsEligibilityWorker = new Worker('benefits-eligibility-processing', processBenefitsEligibilityCheck, {
        connection: redis,
        concurrency: 1, // Only one job at a time
      });

      // Set up event handlers
      benefitsEligibilityWorker.on('completed', (job) => {
        console.log(`✅ Benefits eligibility job ${job.id} completed successfully`);
      });

      benefitsEligibilityWorker.on('failed', (job, err) => {
        console.error(`❌ Benefits eligibility job ${job?.id} failed:`, err);
      });

      benefitsEligibilityWorker.on('error', (err) => {
        console.error('🚨 Benefits eligibility worker error:', err);
      });
    }

    // Pause the queue first, then clear any existing jobs
    await benefitsEligibilityQueue.pause();
    await benefitsEligibilityQueue.obliterate({ force: true });
    
    // Resume the queue
    await benefitsEligibilityQueue.resume();
    
    // Add recurring job every 5 minutes to check if it's time to run
    await benefitsEligibilityQueue.add(
      'process-benefits-eligibility',
      {},
      {
        repeat: {
          every: 1 * 60 * 60 * 1000, // 1 hour in production
        },
        jobId: 'benefits-eligibility-check', // Ensures only one instance
      }
    );

    console.log('🚀 Benefits eligibility job started (checks every 5 minutes)');
  } catch (error) {
    console.error('Failed to start benefits eligibility job:', error);
    throw error;
  }
}

// Start the AI note checking job system
export async function startAINoteCheckingJob(): Promise<void> {
  try {
    console.log('🚀 Starting AI note checking job system...');
    
    // Create the workers if they don't exist
    if (!aiNoteScanWorker) {
      aiNoteScanWorker = new Worker('ai-note-scan', processAINoteScan, {
        connection: redis,
        concurrency: 1, // Only one scan at a time
      });

      // Set up event handlers for scan worker
      aiNoteScanWorker.on('completed', (job) => {
        console.log(`✅ AI Note Scan ${job.id} completed successfully`);
      });

      aiNoteScanWorker.on('failed', (job, err) => {
        console.error(`❌ AI Note Scan ${job?.id} failed:`, err);
      });

      aiNoteScanWorker.on('error', (err) => {
        console.error('🚨 AI Note Scan Worker error:', err);
      });
    }

    if (!aiNoteCheckWorker) {
      aiNoteCheckWorker = new Worker('ai-note-check', processAINoteCheck, {
        connection: redis,
        concurrency: 3, // Allow multiple AI checks in parallel
      });

      // Set up event handlers for check worker
      aiNoteCheckWorker.on('completed', (job) => {
        console.log(`✅ AI Note Check ${job.id} completed successfully`);
      });

      aiNoteCheckWorker.on('failed', (job, err) => {
        console.error(`❌ AI Note Check ${job?.id} failed:`, err);
      });

      aiNoteCheckWorker.on('error', (err) => {
        console.error('🚨 AI Note Check Worker error:', err);
      });
    }
    
    // Pause the queues first, then clear any existing jobs
    console.log('⏸️ Pausing AI note queues...');
    try {
      await aiNoteScanQueue.pause();
      await aiNoteCheckQueue.pause();
    } catch (pauseError) {
      console.log('⚠️ Queues were already paused or in unknown state, continuing...');
    }
    
    console.log('🧹 Clearing existing AI note jobs...');
    try {
      await aiNoteScanQueue.obliterate({ force: true });
      await aiNoteCheckQueue.obliterate({ force: true });
    } catch (obliterateError) {
      console.log('⚠️ Could not obliterate queues (they may be empty), continuing...');
    }
    
    console.log('▶️ Resuming AI note queues...');
    await aiNoteScanQueue.resume();
    await aiNoteCheckQueue.resume();

    // Schedule recurring AI note scans every 5 minutes
    await aiNoteScanQueue.add('scan-incomplete-notes', {
      scanId: `scan-${Date.now()}`,
      batchSize: 200
    }, {
      repeat: {
        every: 5 * 60 * 1000, // 5 minutes
        immediately: true
      },
      jobId: 'recurring-ai-note-scan'
    });

    console.log('✅ AI note checking job system started successfully');
    console.log('📋 Scheduled recurring AI note scans every 30 minutes');
  } catch (error) {
    console.error('Error starting AI note checking job system:', error);
    throw error;
  }
}

// Start the ToDo completion checking job system
export async function startToDoCompletionCheckingJob(): Promise<void> {
  try {
    console.log('🚀 Starting ToDo completion checking job system...');
    
    // Create the worker if it doesn't exist
    if (!todoCompletionCheckWorker) {
      todoCompletionCheckWorker = new Worker('todo-completion-check', processToDoCompletionCheck, {
        connection: redis,
        concurrency: 1, // Only one completion check at a time
      });

      // Set up event handlers for ToDo completion check worker
      todoCompletionCheckWorker.on('completed', (job) => {
        console.log(`✅ ToDo Completion Check ${job.id} completed successfully`);
      });

      todoCompletionCheckWorker.on('failed', (job, err) => {
        console.error(`❌ ToDo Completion Check ${job?.id} failed:`, err);
      });

      todoCompletionCheckWorker.on('error', (err) => {
        console.error('🚨 ToDo Completion Check Worker error:', err);
      });
    }
    
    // Pause the queue first, then clear any existing jobs
    console.log('⏸️ Pausing ToDo completion check queue...');
    try {
      await todoCompletionCheckQueue.pause();
    } catch (pauseError) {
      console.log('⚠️ Queue was already paused or in unknown state, continuing...');
    }
    
    console.log('🧹 Clearing existing ToDo completion check jobs...');
    try {
      await todoCompletionCheckQueue.obliterate({ force: true });
    } catch (obliterateError) {
      console.log('⚠️ Could not obliterate queue (it may be empty), continuing...');
    }
    
    console.log('▶️ Resuming ToDo completion check queue...');
    await todoCompletionCheckQueue.resume();

    // Schedule recurring ToDo completion checks every 15 minutes
    await todoCompletionCheckQueue.add('scan-todo-completions', {
      scanId: `todo-completion-scan-${Date.now()}`,
      batchSize: 50
    }, {
      repeat: {
        every: 15 * 60 * 1000, // 15 minutes
        immediately: true
      },
      jobId: 'recurring-todo-completion-check'
    });

    console.log('✅ ToDo completion checking job system started successfully');
    console.log('📋 Scheduled recurring ToDo completion checks every 15 minutes');
  } catch (error) {
    console.error('Error starting ToDo completion checking job system:', error);
    throw error;
  }
}

// Manually trigger an AI note scan
export async function triggerAINoteScan(): Promise<string> {
  try {
    const scanId = `manual-scan-${Date.now()}`;
    
    await aiNoteScanQueue.add('manual-scan', {
      scanId,
      batchSize: 200
    });

    console.log(`🔍 Triggered manual AI note scan, scanId: ${scanId}`);
    return scanId;
  } catch (error) {
    console.error('Error triggering AI note scan:', error);
    throw error;
  }
}

// Manually trigger a ToDo completion check
export async function triggerToDoCompletionCheck(): Promise<string> {
  try {
    const scanId = `manual-todo-completion-check-${Date.now()}`;
    
    await todoCompletionCheckQueue.add('manual-todo-completion-check', {
      scanId,
      batchSize: 50
    });

    console.log(`📋 Triggered manual ToDo completion check, scanId: ${scanId}`);
    return scanId;
  } catch (error) {
    console.error('Error triggering ToDo completion check:', error);
    throw error;
  }
}

// Get AI note checking job statistics
export async function getAINoteJobStats() {
  try {
    const [scanWaiting, scanActive, scanCompleted, scanFailed] = await Promise.all([
      aiNoteScanQueue.getWaiting(),
      aiNoteScanQueue.getActive(),
      aiNoteScanQueue.getCompleted(),
      aiNoteScanQueue.getFailed()
    ]);

    const [checkWaiting, checkActive, checkCompleted, checkFailed] = await Promise.all([
      aiNoteCheckQueue.getWaiting(),
      aiNoteCheckQueue.getActive(),
      aiNoteCheckQueue.getCompleted(),
      aiNoteCheckQueue.getFailed()
    ]);

    return {
      scan: {
        waiting: scanWaiting.length,
        active: scanActive.length,
        completed: scanCompleted.length,
        failed: scanFailed.length
      },
      check: {
        waiting: checkWaiting.length,
        active: checkActive.length,
        completed: checkCompleted.length,
        failed: checkFailed.length
      }
    };
  } catch (error) {
    console.error('Error getting AI note job stats:', error);
    throw error;
  }
}

// Stop the job systems
export async function stopVitalSignsJob(): Promise<void> {
  try {
    if (vitalSignsWorker) {
      await vitalSignsWorker.close();
      vitalSignsWorker = null;
    }
    await vitalSignsQueue.close();
    console.log('🛑 Vital signs job system stopped');
  } catch (error) {
    console.error('Error stopping vital signs job system:', error);
  }
}

export async function stopBenefitsEligibilityJob(): Promise<void> {
  try {
    if (benefitsEligibilityWorker) {
      await benefitsEligibilityWorker.close();
      benefitsEligibilityWorker = null;
    }
    await benefitsEligibilityQueue.close();
    console.log('🛑 Benefits eligibility job system stopped');
  } catch (error) {
    console.error('Error stopping benefits eligibility job system:', error);
  }
}

export async function stopAINoteCheckingJob(): Promise<void> {
  try {
    if (aiNoteScanWorker) {
      await aiNoteScanWorker.close();
      aiNoteScanWorker = null;
    }
    if (aiNoteCheckWorker) {
      await aiNoteCheckWorker.close();
      aiNoteCheckWorker = null;
    }
    await aiNoteScanQueue.close();
    await aiNoteCheckQueue.close();
    console.log('🛑 AI note checking job system stopped');
  } catch (error) {
    console.error('Error stopping AI note checking job system:', error);
  }
}

export async function stopToDoCompletionCheckingJob(): Promise<void> {
  try {
    if (todoCompletionCheckWorker) {
      await todoCompletionCheckWorker.close();
      todoCompletionCheckWorker = null;
    }
    await todoCompletionCheckQueue.close();
    console.log('🛑 ToDo completion checking job system stopped');
  } catch (error) {
    console.error('Error stopping ToDo completion checking job system:', error);
  }
}

// Main execution when running as a standalone worker process
async function main() {
  try {
    console.log('🔧 Starting dedicated worker process...');
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
    
    // Initialize database connection
    console.log('💾 Initializing database connection...');
    await vitalSignsDb.initialize();
    console.log('✅ Database initialized successfully');

    // Start vital signs job processor
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Starting vital signs job processor...');
      await startVitalSignsJob();
      console.log('✅ Vital signs job processor started');

       // Start AI note checking job processor
      console.log('🤖 Starting AI note checking job processor...');
      await startAINoteCheckingJob();
      console.log('✅ AI note checking job processor started');

      // Start ToDo completion checking job processor
      console.log('📋 Starting ToDo completion checking job processor...');
      await startToDoCompletionCheckingJob();
      console.log('✅ ToDo completion checking job processor started');

      // Start benefits eligibility job processor
      console.log('💰 Starting benefits eligibility job processor...');
      await startBenefitsEligibilityJob();
      console.log('✅ Benefits eligibility job processor started');
    }


    console.log('🚀 Worker process is ready and listening for jobs!');

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('📡 Received SIGTERM, shutting down gracefully...');
      await stopVitalSignsJob();
      await stopBenefitsEligibilityJob();
      await stopAINoteCheckingJob();
      await stopToDoCompletionCheckingJob();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('📡 Received SIGINT, shutting down gracefully...');
      await stopVitalSignsJob();
      await stopBenefitsEligibilityJob();
      await stopAINoteCheckingJob();
      await stopToDoCompletionCheckingJob();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start worker process:', error);
    process.exit(1);
  }
}

// Only run main() if this file is executed directly (not imported)
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unhandled error in worker process:', error);
    process.exit(1);
  });
} 