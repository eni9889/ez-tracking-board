import axios from './axiosConfig';
import { vitalSignsDb } from './database';

// Insurance policy IDs that require PROVIDER level eligibility checks
// All other insurance policies will use PRACTICE level checks
const PROVIDER_LEVEL_INSURANCE_IDS: string[] = [
  // TODO: Add insurance policy IDs that require provider-level checks
];

// Helper function to determine if a policy requires provider-level checks
function requiresProviderLevelCheck(policyId: string): boolean {
  return PROVIDER_LEVEL_INSURANCE_IDS.includes(policyId);
}

interface PatientInsuranceProfile {
  id: string;
  patientName: string;
  patientId: string;
  patientDateOfBirth: string;
  insurancePolicies: InsurancePolicy[];
  active: boolean;
  selfPay: boolean;
}

interface InsurancePolicy {
  id: string;
  memberNumber: string;
  insuranceNote: string;
  insurancePolicyType: {
    id: string;
    active: boolean;
    type: string;
    description: string;
    code: string;
  };
  relationshipToResponsiblePerson: string;
  groupName: string;
  validFrom: string;
  validThrough: string;
  responsibleFirstName: string;
  responsibleLastName: string;
  responsibleGender: string;
  responsibleDateOfBirth: string;
  responsiblePhone: string;
  eligibilityStatus?: string;
  eligibilityId?: string;
  eligibilityDate?: string;
  pastEligibilityStatus?: string;
  pastEligibilityId?: string;
  pastEligibilityDate?: string;
}

interface EligibilityCheckRequest {
  patientEligibilityCheckInfoRequestList: Array<{
    id: string;
    dateForEligibilityCheck: string;
    type: string;
  }>;
  id: string;
  type: 'PROVIDER' | 'PRACTICE';
}

interface EligibilityCheckResponse {
  id: string;
  eligibilityStatusValue: string;
}

interface BenefitsEncounter {
  id: string;
  patientInfo: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
  appointmentTime: string;
  status: string;
  establishedPatient: boolean;
}

class BenefitsService {
  private readonly EZDERM_BASE_URL = 'https://srvprod.ezinfra.net';

  /**
   * Check if patient is eligible for benefits eligibility check
   */
  private isEligibleForEligibilityCheck(encounter: BenefitsEncounter): boolean {
    // Must have basic encounter structure
    if (!encounter || !encounter.id) {
      console.log('Invalid encounter structure - missing encounter ID');
      return false;
    }

    // Must have patient info with ID
    if (!encounter.patientInfo?.id) {
      console.log('Invalid encounter structure - missing patient ID');
      return false;
    }

    // Check if encounter is scheduled for today or in the future
    const encounterDate = new Date(encounter.appointmentTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (encounterDate < today) {
      console.log(`Encounter ${encounter.id} is in the past, skipping eligibility check`);
      return false;
    }

    // Check if appointment is within next 24 hours
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (encounterDate >= tomorrow) {
      console.log(`Encounter ${encounter.id} is more than 24 hours away, skipping eligibility check`);
      return false;
    }

    return true;
  }

  /**
   * Get active patient insurance profiles
   */
  private async getActivePatientInsuranceProfile(patientId: string, accessToken: string): Promise<PatientInsuranceProfile[]> {
    try {
      console.log(`Fetching active insurance profiles for patient: ${patientId}`);
      
      const response = await axios.get(
        `${this.EZDERM_BASE_URL}/ezderm-webservice/rest/insurance/getActivePatientInsuranceProfile/_rid/${patientId}`,
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'patientid': patientId,
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
          }
        }
      );

      const data = response.data;
      if (data && data.activePatientInsuranceProfiles) {
        return data.activePatientInsuranceProfiles.filter((profile: PatientInsuranceProfile) => 
          profile.active && !profile.selfPay && profile.insurancePolicies.length > 0
        );
      }

      return [];
    } catch (error) {
      console.error('Error fetching patient insurance profiles:', error);
      throw error;
    }
  }

  /**
   * Check if eligibility check is needed for insurance policy
   */
  private needsEligibilityCheck(policy: InsurancePolicy): boolean {
    // Check if no eligibility status exists
    if (!policy.eligibilityStatus) {
      return true;
    }

    // Check if eligibility status is not ELIGIBLE
    if (policy.eligibilityStatus !== 'ELIGIBLE') {
      return true;
    }

    // Check if eligibility date is old (more than 7 days)
    if (policy.eligibilityDate) {
      const eligibilityDate = new Date(policy.eligibilityDate);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      if (eligibilityDate < sevenDaysAgo) {
        console.log(`Policy ${policy.id} eligibility is older than 7 days, needs recheck`);
        return true;
      }
    }

    return false;
  }

  /**
   * Enqueue eligibility check for insurance profile
   */
  private async enqueueEligibilityCheck(
    profileId: string, 
    entityId: string, 
    entityType: 'PROVIDER' | 'PRACTICE',
    accessToken: string
  ): Promise<EligibilityCheckResponse[]> {
    try {
      const checkDate = new Date().toISOString();
      
      const requestData: EligibilityCheckRequest = {
        patientEligibilityCheckInfoRequestList: [{
          id: profileId,
          dateForEligibilityCheck: checkDate,
          type: "PROFILE"
        }],
        id: entityId,
        type: entityType
      };

      console.log(`Enqueuing eligibility check for profile ${profileId} with ${entityType} ${entityId}`);

      const response = await axios.post(
        `${this.EZDERM_BASE_URL}/ezderm-webservice/rest/patient/checkEligibility`,
        requestData,
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error enqueuing ${entityType} eligibility check:`, error);
      throw error;
    }
  }

  /**
   * Get default provider and practice IDs for eligibility checks
   */
  private async getEligibilityEntities(accessToken: string): Promise<{ providerId: string; practiceId: string }> {
    try {
      console.log('Fetching practice and providers for eligibility settings');
      
      const response = await axios.get(
        `${this.EZDERM_BASE_URL}/ezderm-webservice/rest/practice/getPracticeAndProvidersForEligibilitySettings`,
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
          }
        }
      );

      const entities = response.data;
      
      // Find the first provider and practice in the list
      const provider = entities.find((p: any) => p.eligibilityCheckEntity === 'PROVIDER');
      const practice = entities.find((p: any) => p.eligibilityCheckEntity === 'PRACTICE');
      
      if (!provider) {
        throw new Error('No suitable provider found for eligibility checks');
      }
      
      if (!practice) {
        throw new Error('No suitable practice found for eligibility checks');
      }

      console.log(`Using provider: ${provider.defaultPracticeOrProviderDescription} (${provider.defaultPracticeOrProviderId})`);
      console.log(`Using practice: ${practice.defaultPracticeOrProviderDescription} (${practice.defaultPracticeOrProviderId})`);
      
      return {
        providerId: provider.defaultPracticeOrProviderId,
        practiceId: practice.defaultPracticeOrProviderId
      };
    } catch (error) {
      console.error('Error fetching eligibility entities:', error);
      throw error;
    }
  }

  /**
   * Process benefits eligibility check for a single encounter
   */
  async processBenefitsEligibilityCheck(encounter: BenefitsEncounter, accessToken: string): Promise<boolean> {
    try {
      // Check if encounter is eligible
      if (!this.isEligibleForEligibilityCheck(encounter)) {
        console.log(`Encounter ${encounter.id} is not eligible for benefits eligibility check - marking as processed`);
        
        // Mark as processed to prevent continuous retries
        await vitalSignsDb.markBenefitsEligibilityAsProcessed(
          encounter.id,
          encounter.patientInfo?.id || 'unknown',
          0,
          false,
          'Not eligible for eligibility check (past date, too far in future, or missing patient info)'
        );
        
        return false;
      }

      // Check if already processed recently
      const alreadyProcessed = await vitalSignsDb.hasBenefitsEligibilityBeenProcessed(encounter.id);
      if (alreadyProcessed) {
        console.log(`Encounter ${encounter.id} already processed for benefits eligibility check`);
        return false;
      }

      console.log(`Processing benefits eligibility check for encounter ${encounter.id} - Patient: ${encounter.patientInfo.firstName} ${encounter.patientInfo.lastName}`);

      // Validate patient ID before proceeding
      if (!encounter.patientInfo?.id) {
        console.log(`Encounter ${encounter.id} has no patient ID - marking as processed`);
        await vitalSignsDb.markBenefitsEligibilityAsProcessed(
          encounter.id,
          'unknown',
          0,
          false,
          'No patient ID found in encounter'
        );
        return false;
      }

      // Get patient insurance profiles
      const insuranceProfiles = await this.getActivePatientInsuranceProfile(
        encounter.patientInfo.id,
        accessToken
      );

      if (insuranceProfiles.length === 0) {
        console.log(`No active insurance profiles found for patient ${encounter.patientInfo.id}`);
        await vitalSignsDb.markBenefitsEligibilityAsProcessed(
          encounter.id,
          encounter.patientInfo.id,
          0,
          false,
          'No active insurance profiles found'
        );
        return false;
      }

      // Get default provider and practice for eligibility checks
      const eligibilityEntities = await this.getEligibilityEntities(accessToken);

      let totalChecksEnqueued = 0;
      let successfulChecks = 0;

      // Process each insurance profile
      for (const profile of insuranceProfiles) {
        try {
          // Check if any policies need eligibility verification
          const policiesNeedingCheck = profile.insurancePolicies.filter(policy => 
            this.needsEligibilityCheck(policy)
          );

          if (policiesNeedingCheck.length === 0) {
            console.log(`All policies for profile ${profile.id} have recent eligibility checks`);
            continue;
          }

          // Determine if this profile requires provider-level checks
          const needsProviderCheck = profile.insurancePolicies.some(policy => 
            requiresProviderLevelCheck(policy.id)
          );

          if (needsProviderCheck) {
            // Enqueue eligibility check as PROVIDER
            console.log(`Enqueuing PROVIDER eligibility check for profile ${profile.id} (requires provider-level check)`);
            const providerCheckResponses = await this.enqueueEligibilityCheck(
              profile.id,
              eligibilityEntities.providerId,
              'PROVIDER',
              accessToken
            );

            totalChecksEnqueued++;

            // Check if the provider request was successful
            if (providerCheckResponses && providerCheckResponses.length > 0) {
              const response = providerCheckResponses[0];
              if (response && response.eligibilityStatusValue === 'PENDING_RESPONSE') {
                successfulChecks++;
                console.log(`✅ Successfully enqueued PROVIDER eligibility check for profile ${profile.id}`);
              } else {
                console.log(`❌ Provider eligibility check response for profile ${profile.id}: ${response?.eligibilityStatusValue || 'unknown'}`);
              }
            }
          } else {
            // Enqueue eligibility check as PRACTICE (default for most insurances)
            console.log(`Enqueuing PRACTICE eligibility check for profile ${profile.id} (default level)`);
            const practiceCheckResponses = await this.enqueueEligibilityCheck(
              profile.id,
              eligibilityEntities.practiceId,
              'PRACTICE',
              accessToken
            );

            totalChecksEnqueued++;

            // Check if the practice request was successful
            if (practiceCheckResponses && practiceCheckResponses.length > 0) {
              const response = practiceCheckResponses[0];
              if (response && response.eligibilityStatusValue === 'PENDING_RESPONSE') {
                successfulChecks++;
                console.log(`✅ Successfully enqueued PRACTICE eligibility check for profile ${profile.id}`);
              } else {
                console.log(`❌ Practice eligibility check response for profile ${profile.id}: ${response?.eligibilityStatusValue || 'unknown'}`);
              }
            }
          }

        } catch (error) {
          console.error(`Error processing eligibility checks for profile ${profile.id}:`, error);
          totalChecksEnqueued += 1; // We attempted one eligibility check
          // Continue with other profiles
        }
      }

      // Mark as processed with results
      const allSuccessful = totalChecksEnqueued > 0 && successfulChecks === totalChecksEnqueued;
      await vitalSignsDb.markBenefitsEligibilityAsProcessed(
        encounter.id,
        encounter.patientInfo.id,
        totalChecksEnqueued,
        allSuccessful,
        allSuccessful ? undefined : `${successfulChecks}/${totalChecksEnqueued} checks successful`
      );

      if (totalChecksEnqueued > 0) {
        const profileCount = insuranceProfiles.length;
        console.log(`Successfully processed benefits eligibility for encounter ${encounter.id}: ${successfulChecks}/${totalChecksEnqueued} checks enqueued (${profileCount} profiles × 1 check each)`);
        return allSuccessful;
      } else {
        console.log(`No eligibility checks needed for encounter ${encounter.id}`);
        return false;
      }

    } catch (error) {
      console.error(`Error processing benefits eligibility for encounter ${encounter.id}:`, error);
      
      // DO NOT mark as processed on server errors - allow retries
      // Only mark as processed for definitive business logic failures (handled above)
      console.log(`⚠️ Not marking encounter ${encounter.id} as processed due to server error - will retry on next job run`);
      
      return false;
    }
  }

  /**
   * Process benefits eligibility checks for multiple encounters
   */
  async processMultipleEncounters(encounters: BenefitsEncounter[], accessToken: string): Promise<{ processed: number; successful: number; failed: number }> {
    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const encounter of encounters) {
      try {
        const result = await this.processBenefitsEligibilityCheck(encounter, accessToken);
        if (this.isEligibleForEligibilityCheck(encounter)) {
          processed++;
          if (result) {
            successful++;
          } else {
            failed++;
          }
        }
      } catch (error) {
        console.error(`Error processing encounter ${encounter.id}:`, error);
        processed++;
        failed++;
      }
    }

    return { processed, successful, failed };
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    return await vitalSignsDb.getBenefitsEligibilityStats();
  }
}

export const benefitsService = new BenefitsService();
