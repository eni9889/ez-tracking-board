import axios from 'axios';
import { vitalSignsDb } from './database';

interface VitalSigns {
  id?: string;
  encounterId: string;
  height1?: number;
  height2?: number;
  heightUnit?: string;
  weight1?: number;
  weight2?: number;
  weightUnit?: string;
  bmi?: number;
  temperature?: number;
  temperatureUnit?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulse?: number;
  respirations?: number;
  headCircumference?: number;
  changeStatus?: string;
}

interface HistoricalEncounter {
  id: string;
  dateOfService: string;
  dateOfArrival?: string;
  establishedPatient: boolean;
  status: string;
  patientInfo: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    yearsOld: number;
  };
}

interface PatientAge {
  years: number;
  isOver18: boolean;
}

class VitalSignsService {
  private readonly EZDERM_BASE_URL = 'https://srvprod.ezinfra.net';

  /**
   * Calculate patient age from date of birth
   */
  private calculateAge(dateOfBirth: string): PatientAge {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return {
      years: age,
      isOver18: age >= 18
    };
  }

  /**
   * Check if patient is eligible for vital signs carryforward
   */
  private isEligibleForCarryforward(encounter: any): boolean {
    // Must be READY_FOR_STAFF status
    if (encounter.status !== 'READY_FOR_STAFF') {
      return false;
    }

    // Must be established patient (not new)
    if (!encounter.establishedPatient) {
      return false;
    }

    // Must be over 18 years old
    if (encounter.patientInfo?.dateOfBirth) {
      const age = this.calculateAge(encounter.patientInfo.dateOfBirth);
      if (!age.isOver18) {
        console.log(`Patient ${encounter.patientInfo.firstName} ${encounter.patientInfo.lastName} is ${age.years} years old, skipping vital signs carryforward`);
        return false;
      }
    } else {
      console.log('Patient date of birth not available, skipping vital signs carryforward');
      return false;
    }

    return true;
  }

  /**
   * Get historical encounters for a patient
   */
  private async getHistoricalEncounters(patientId: string, accessToken: string, currentEncounterId: string): Promise<HistoricalEncounter[]> {
    try {
      const response = await axios.post(
        `${this.EZDERM_BASE_URL}/ezderm-webservice/rest/encounter/getByFilter`,
        {
          lightBean: true,
          patientId: patientId,
          includeVirtualEncounters: true
        },
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'patientid': patientId,
            'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
            'accept-language': 'en-US;q=1.0'
          }
        }
      );

      // Filter out current encounter and sort by date (most recent first)
      const encounters = response.data
        .filter((enc: any) => enc.id !== currentEncounterId)
        .sort((a: any, b: any) => new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime());

      return encounters;
    } catch (error) {
      console.error('Error fetching historical encounters:', error);
      throw error;
    }
  }

  /**
   * Get vital signs for a specific encounter
   */
  private async getVitalSigns(encounterId: string, patientId: string, accessToken: string): Promise<VitalSigns | null> {
    try {
      const response = await axios.get(
        `${this.EZDERM_BASE_URL}/ezderm-webservice/rest/encounter/getVitalSigns/_rid/${encounterId}`,
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'encounterid': encounterId,
            'patientid': patientId,
            'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
            'accept-language': 'en-US;q=1.0'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error fetching vital signs for encounter ${encounterId}:`, error);
      return null;
    }
  }

  /**
   * Update vital signs for an encounter
   */
  private async updateVitalSigns(vitalSigns: VitalSigns, accessToken: string, patientId: string): Promise<boolean> {
    try {
      const updateData = {
        ...vitalSigns,
        changeStatus: 'UPDATED'
      };

      const response = await axios.post(
        `${this.EZDERM_BASE_URL}/ezderm-webservice/rest/vitalSigns/updateVitalSigns`,
        updateData,
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'encounterid': vitalSigns.encounterId,
            'patientid': patientId,
            'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
            'accept-language': 'en-US;q=1.0'
          }
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error('Error updating vital signs:', error);
      return false;
    }
  }

  /**
   * Check if vital signs contain height and weight data
   */
  private hasHeightAndWeight(vitalSigns: VitalSigns): boolean {
    const hasHeight = (vitalSigns.height1 !== undefined && vitalSigns.height1 > 0) || 
                     (vitalSigns.height2 !== undefined && vitalSigns.height2 > 0);
    const hasWeight = (vitalSigns.weight1 !== undefined && vitalSigns.weight1 > 0) || 
                     (vitalSigns.weight2 !== undefined && vitalSigns.weight2 > 0);
    
    return hasHeight && hasWeight;
  }

  /**
   * Process vital signs carryforward for a single encounter
   */
  async processVitalSignsCarryforward(encounter: any, accessToken: string): Promise<boolean> {
    try {
      // Check if encounter is eligible
      if (!this.isEligibleForCarryforward(encounter)) {
        return false;
      }

      // Check if already processed
      const alreadyProcessed = await vitalSignsDb.hasBeenProcessed(encounter.id);
      if (alreadyProcessed) {
        console.log(`Encounter ${encounter.id} already processed for vital signs carryforward`);
        return false;
      }

      console.log(`Processing vital signs carryforward for encounter ${encounter.id} - Patient: ${encounter.patientInfo.firstName} ${encounter.patientInfo.lastName}`);

      // For now, just mark as processed - full implementation will be added later
      await vitalSignsDb.markAsProcessed(
        encounter.id,
        encounter.patientInfo.id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        'Basic processing completed'
      );

      return true;
    } catch (error) {
      console.error(`Error processing vital signs carryforward for encounter ${encounter.id}:`, error);
      
      await vitalSignsDb.markAsProcessed(
        encounter.id,
        encounter.patientInfo?.id || 'unknown',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return false;
    }
  }

  /**
   * Process vital signs carryforward for multiple encounters
   */
  async processMultipleEncounters(encounters: any[], accessToken: string): Promise<{ processed: number; successful: number; failed: number }> {
    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const encounter of encounters) {
      try {
        const result = await this.processVitalSignsCarryforward(encounter, accessToken);
        if (this.isEligibleForCarryforward(encounter)) {
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
    return await vitalSignsDb.getProcessingStats();
  }
}

export const vitalSignsService = new VitalSignsService();
