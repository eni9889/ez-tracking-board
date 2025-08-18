import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios from './axiosConfig';
import { AxiosResponse } from 'axios';
import { vitalSignsDb } from './database';
import { vitalSignsService } from './vitalSignsService';
import { aiNoteChecker } from './aiNoteChecker';
import {
  EZDermLoginRequest,
  EZDermLoginResponse,
  EZDermEncounterFilter,
  EZDermEncounter,
  Encounter,
  EncounterStatus,
  AINoteScanJobData,
  AINoteCheckJobData,
  StoredTokens
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

// Token management helper for AI note checking jobs (reuse existing pattern)
const getValidTokensForAI = async (username: string): Promise<{ accessToken: string; refreshToken: string; serverUrl: string } | null> => {
  // Use the existing token management function from vital signs jobs
  return await getValidTokensForJob(username);
};

// AI Note Scan Job Processor
const processAINoteScan = async (job: Job<AINoteScanJobData>) => {
  const { scanId, batchSize = 100 } = job.data;
  
  console.log(`🔍 Starting AI note scan, scanId: ${scanId}`);
  
  try {
    // Get stored credentials (same pattern as vital signs job)
    const credentials = await vitalSignsDb.getActiveUserCredentials();
    if (!credentials) {
      throw new Error('No active user credentials found. Please login through the frontend first.');
    }

    // Get valid tokens for the active user
    const tokens = await getValidTokensForAI(credentials.username);
    if (!tokens) {
      throw new Error(`Failed to get valid tokens for user: ${credentials.username}`);
    }

    console.log(`🔑 Using credentials for user: ${credentials.username}`);

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
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const serviceDate = new Date(encounter.dateOfService);
            
            const isEligible = eligibleStatuses.includes(encounter.status) && serviceDate < twoHoursAgo;
            
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
                console.log(`⏭️ Skipping encounter ${encounter.id}: recent check exists`);
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
  const { encounterId, patientId, patientName, chiefComplaint, dateOfService, scanId } = job.data;
  
  console.log(`🤖 Starting AI check for encounter: ${encounterId} (${patientName})`);
  console.log(`📅 Date of service: ${dateOfService} (type: ${typeof dateOfService})`);
  
  try {
    // Get stored credentials (SAME PATTERN AS VITAL SIGNS)
    const credentials = await vitalSignsDb.getActiveUserCredentials();
    if (!credentials) {
      throw new Error('No active user credentials found. Please login through the frontend first.');
    }

    // Use the same robust token management as vital signs
    console.log(`🔑 AI Job: Getting valid tokens for user: ${credentials.username}`);
    const tokens = await getValidTokensForJob(credentials.username);
    if (!tokens) {
      throw new Error(`Failed to get valid tokens for user: ${credentials.username}`);
    }
    console.log(`✅ AI Job: Got valid tokens for ${credentials.username}`);

    // Perform the AI check
    const checkId = await aiNoteChecker.checkSingleNote(
      tokens.accessToken,  // 1st: accessToken
      encounterId,         // 2nd: encounterId  
      patientId,           // 3rd: patientId
      patientName,         // 4th: patientName
      chiefComplaint,      // 5th: chiefComplaint
      dateOfService,       // 6th: dateOfService
      credentials.username // 7th: checkedBy
    );

    // Get the AI analysis result to check for issues
    const noteCheckResult = await vitalSignsDb.getNoteCheckResult(encounterId);
    
    // if (noteCheckResult && noteCheckResult.issues_found && noteCheckResult.ai_analysis?.issues) {
    //   console.log(`📝 Issues found in note ${encounterId}, creating ToDo...`);
      
    //   try {
    //     // Get the progress note to access encounterRoleInfoList
    //     const progressNote = await aiNoteChecker.fetchProgressNote(tokens.accessToken, encounterId, patientId);
        
    //     // Find encounterRoleInfoList from the original incomplete encounter data
    //     // We'll need to fetch this from the incomplete notes API
    //     const incompleteNotes = await aiNoteChecker.fetchIncompleteNotes(tokens.accessToken, {
    //       fetchFrom: 0,
    //       size: 100
    //     });
        
    //     let encounterRoleInfoList: any[] = [];
        
    //     // Search for the encounter in incomplete notes to get role info
    //     for (const batch of incompleteNotes) {
    //       if (batch.incompletePatientEncounters) {
    //         for (const patientData of batch.incompletePatientEncounters) {
    //           const encounter = patientData.incompleteEncounters.find(enc => enc.id === encounterId);
    //           if (encounter && encounter.encounterRoleInfoList) {
    //             encounterRoleInfoList = encounter.encounterRoleInfoList;
    //             break;
    //           }
    //         }
    //       }
    //       if (encounterRoleInfoList.length > 0) break;
    //     }
        
    //     if (encounterRoleInfoList.length > 0) {
    //       const todoId = await aiNoteChecker.createNoteDeficiencyToDo(
    //         tokens.accessToken,
    //         encounterId,
    //         patientId,
    //         patientName,
    //         dateOfService,
    //         noteCheckResult.ai_analysis.issues,
    //         encounterRoleInfoList
    //       );
          
    //       console.log(`✅ ToDo created successfully: ${todoId} for encounter: ${encounterId}`);
          
    //       return {
    //         encounterId,
    //         patientName,
    //         checkId,
    //         scanId,
    //         todoId,
    //         issuesFound: true,
    //         completedAt: new Date().toISOString()
    //       };
    //     } else {
    //       console.warn(`⚠️ Could not find encounter role info for ${encounterId}, skipping ToDo creation`);
    //     }
        
    //   } catch (todoError: any) {
    //     console.error(`❌ Failed to create ToDo for encounter ${encounterId}:`, todoError.message);
    //     // Don't fail the entire job if ToDo creation fails
    //   }
    // }

    console.log(`✅ AI check completed for encounter: ${encounterId}, checkId: ${checkId}`);
    
    return {
      encounterId,
      patientName,
      checkId,
      scanId,
      issuesFound: noteCheckResult?.issues_found || false,
      completedAt: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error(`❌ AI check failed for encounter: ${encounterId}`, error);
    throw error;
  }
};

// Create workers
export const vitalSignsWorker = new Worker('vital-signs-processing', processVitalSignsCarryforward, {
  connection: redis,
  concurrency: 1, // Only one job at a time
});

export const aiNoteScanWorker = new Worker('ai-note-scan', processAINoteScan, {
  connection: redis,
  concurrency: 1, // Only one scan at a time
});

export const aiNoteCheckWorker = new Worker('ai-note-check', processAINoteCheck, {
  connection: redis,
  concurrency: 3, // Allow multiple AI checks in parallel
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

// AI Note Scan Worker event handlers
aiNoteScanWorker.on('completed', (job) => {
  console.log(`✅ AI Note Scan ${job.id} completed successfully`);
});

aiNoteScanWorker.on('failed', (job, err) => {
  console.error(`❌ AI Note Scan ${job?.id} failed:`, err);
});

aiNoteScanWorker.on('error', (err) => {
  console.error('🚨 AI Note Scan Worker error:', err);
});

// AI Note Check Worker event handlers
aiNoteCheckWorker.on('completed', (job) => {
  console.log(`✅ AI Note Check ${job.id} completed successfully`);
});

aiNoteCheckWorker.on('failed', (job, err) => {
  console.error(`❌ AI Note Check ${job?.id} failed:`, err);
});

aiNoteCheckWorker.on('error', (err) => {
  console.error('🚨 AI Note Check Worker error:', err);
});

// Start the recurring job
export async function startVitalSignsJob(): Promise<void> {
  try {
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

// Start the AI note checking job system
export async function startAINoteCheckingJob(): Promise<void> {
  try {
    console.log('🚀 Starting AI note checking job system...');
    
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
        every: 5 * 60 * 1000, // 30 minutes
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
    await vitalSignsWorker.close();
    await vitalSignsQueue.close();
    await redis.quit();
    console.log('🛑 Vital signs job system stopped');
  } catch (error) {
    console.error('Error stopping vital signs job system:', error);
  }
}

export async function stopAINoteCheckingJob(): Promise<void> {
  try {
    await aiNoteScanWorker.close();
    await aiNoteCheckWorker.close();
    await aiNoteScanQueue.close();
    await aiNoteCheckQueue.close();
    console.log('🛑 AI note checking job system stopped');
  } catch (error) {
    console.error('Error stopping AI note checking job system:', error);
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
    console.log('🔄 Starting vital signs job processor...');
    await startVitalSignsJob();
    console.log('✅ Vital signs job processor started');

    // Start AI note checking job processor
    console.log('🤖 Starting AI note checking job processor...');
    await startAINoteCheckingJob();
    console.log('✅ AI note checking job processor started');

    console.log('🚀 Worker process is ready and listening for jobs!');

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('📡 Received SIGTERM, shutting down gracefully...');
      await stopVitalSignsJob();
      await stopAINoteCheckingJob();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('📡 Received SIGINT, shutting down gracefully...');
      await stopVitalSignsJob();
      await stopAINoteCheckingJob();
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