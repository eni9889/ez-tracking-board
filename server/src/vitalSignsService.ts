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
   * Get full encounter details including vital signs
   */
  private async getEncounterById(encounterId: string, patientId: string, accessToken: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.EZDERM_BASE_URL}/ezderm-webservice/rest/encounter/getById/_rid/${encounterId}`,
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
      console.error(`Error fetching encounter ${encounterId}:`, error);
      return null;
    }
  }

  /**
   * Extract vital signs from encounter response
   */
  private extractVitalSigns(encounter: any): VitalSigns | null {
    if (!encounter.vitalSignsInfo) {
      return null;
    }

    const vitalSignsInfo = encounter.vitalSignsInfo;
    
    return {
      id: vitalSignsInfo.id,
      encounterId: encounter.id,
      height1: vitalSignsInfo.height1,
      height2: vitalSignsInfo.height2,
      heightUnit: vitalSignsInfo.heightUnit,
      weight1: vitalSignsInfo.weight1,
      weight2: vitalSignsInfo.weight2,
      weightUnit: vitalSignsInfo.weightUnit,
      bmi: vitalSignsInfo.bmi,
      temperature: vitalSignsInfo.temperature,
      temperatureUnit: vitalSignsInfo.temperatureUnit,
      bloodPressureSystolic: vitalSignsInfo.bloodPressureSystolic,
      bloodPressureDiastolic: vitalSignsInfo.bloodPressureDiastolic,
      pulse: vitalSignsInfo.pulse,
      respirations: vitalSignsInfo.respirations,
      headCircumference: vitalSignsInfo.headCircumference
    };
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
   * Find the most recent encounter with height and weight data
   */
  private async findMostRecentVitalSigns(encounters: HistoricalEncounter[], patientId: string, accessToken: string): Promise<{ encounter: HistoricalEncounter; vitalSigns: VitalSigns } | null> {
    for (const encounter of encounters) {
      try {
        const fullEncounter = await this.getEncounterById(encounter.id, patientId, accessToken);
        
        if (fullEncounter) {
          const vitalSigns = this.extractVitalSigns(fullEncounter);
          
          if (vitalSigns && this.hasHeightAndWeight(vitalSigns)) {
            console.log(`Found vital signs in encounter ${encounter.id} from ${encounter.dateOfService}`);
            return { encounter, vitalSigns };
          }
        }
      } catch (error) {
        console.error(`Error checking vital signs for encounter ${encounter.id}:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Calculate BMI from height and weight
   */
  private calculateBMI(vitalSigns: VitalSigns): number | undefined {
    const height = vitalSigns.height1 || vitalSigns.height2;
    const weight = vitalSigns.weight1 || vitalSigns.weight2;
    
    if (!height || !weight) {
      return undefined;
    }

    // Convert to metric if needed and calculate BMI
    let heightInMeters: number;
    let weightInKg: number;

    // Handle height conversion (assuming inches if heightUnit is IN)
    if (vitalSigns.heightUnit === 'IN') {
      heightInMeters = height * 0.0254; // inches to meters
    } else {
      heightInMeters = height / 100; // assume cm, convert to meters
    }

    // Handle weight conversion (assuming pounds if weightUnit is LB_OZ)
    if (vitalSigns.weightUnit === 'LB_OZ') {
      weightInKg = weight * 0.453592; // pounds to kg
    } else {
      weightInKg = weight; // assume kg
    }

    const bmi = weightInKg / (heightInMeters * heightInMeters);
    return Math.round(bmi * 100) / 100; // round to 2 decimal places
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

      // Get historical encounters
      const historicalEncounters = await this.getHistoricalEncounters(
        encounter.patientInfo.id,
        accessToken,
        encounter.id
      );

      if (historicalEncounters.length === 0) {
        console.log(`No historical encounters found for patient ${encounter.patientInfo.id}`);
        await vitalSignsDb.markAsProcessed(
          encounter.id,
          encounter.patientInfo.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          false,
          'No historical encounters found'
        );
        return false;
      }

      // Find most recent encounter with vital signs
      const recentVitalSigns = await this.findMostRecentVitalSigns(
        historicalEncounters,
        encounter.patientInfo.id,
        accessToken
      );

      if (!recentVitalSigns) {
        console.log(`No historical vital signs found for patient ${encounter.patientInfo.id}`);
        await vitalSignsDb.markAsProcessed(
          encounter.id,
          encounter.patientInfo.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          false,
          'No historical vital signs found'
        );
        return false;
      }

      // Get current encounter with vital signs to update
      const currentEncounter = await this.getEncounterById(
        encounter.id,
        encounter.patientInfo.id,
        accessToken
      );

      if (!currentEncounter) {
        console.log(`Could not get current encounter ${encounter.id}`);
        await vitalSignsDb.markAsProcessed(
          encounter.id,
          encounter.patientInfo.id,
          recentVitalSigns.encounter.id,
          undefined,
          undefined,
          undefined,
          undefined,
          false,
          'Could not get current encounter'
        );
        return false;
      }

      const currentVitalSigns = this.extractVitalSigns(currentEncounter);
      
      if (!currentVitalSigns) {
        console.log(`Current encounter ${encounter.id} has no vital signs record`);
        await vitalSignsDb.markAsProcessed(
          encounter.id,
          encounter.patientInfo.id,
          recentVitalSigns.encounter.id,
          undefined,
          undefined,
          undefined,
          undefined,
          false,
          'Current encounter has no vital signs record'
        );
        return false;
      }

      // Update with historical height and weight
      const updatedVitalSigns: VitalSigns = { ...currentVitalSigns };
      
      // Copy height and weight from historical encounter
      if (recentVitalSigns.vitalSigns.height1) {
        updatedVitalSigns.height1 = recentVitalSigns.vitalSigns.height1;
      }
      if (recentVitalSigns.vitalSigns.height2) {
        updatedVitalSigns.height2 = recentVitalSigns.vitalSigns.height2;
      }
      if (recentVitalSigns.vitalSigns.heightUnit) {
        updatedVitalSigns.heightUnit = recentVitalSigns.vitalSigns.heightUnit;
      }
      if (recentVitalSigns.vitalSigns.weight1) {
        updatedVitalSigns.weight1 = recentVitalSigns.vitalSigns.weight1;
      }
      if (recentVitalSigns.vitalSigns.weight2) {
        updatedVitalSigns.weight2 = recentVitalSigns.vitalSigns.weight2;
      }
      if (recentVitalSigns.vitalSigns.weightUnit) {
        updatedVitalSigns.weightUnit = recentVitalSigns.vitalSigns.weightUnit;
      }
      
      // Recalculate BMI if we have height and weight
      const calculatedBMI = this.calculateBMI(recentVitalSigns.vitalSigns);
      if (calculatedBMI) {
        updatedVitalSigns.bmi = calculatedBMI;
      }

      // Update vital signs in EZDerm
      const updateSuccess = await this.updateVitalSigns(
        updatedVitalSigns,
        accessToken,
        encounter.patientInfo.id
      );

      if (updateSuccess) {
        console.log(`Successfully updated vital signs for encounter ${encounter.id} with data from encounter ${recentVitalSigns.encounter.id}`);
        
        await vitalSignsDb.markAsProcessed(
          encounter.id,
          encounter.patientInfo.id,
          recentVitalSigns.encounter.id,
          recentVitalSigns.vitalSigns.height1,
          recentVitalSigns.vitalSigns.weight1,
          recentVitalSigns.vitalSigns.heightUnit,
          recentVitalSigns.vitalSigns.weightUnit,
          true
        );
        
        return true;
      } else {
        await vitalSignsDb.markAsProcessed(
          encounter.id,
          encounter.patientInfo.id,
          recentVitalSigns.encounter.id,
          recentVitalSigns.vitalSigns.height1,
          recentVitalSigns.vitalSigns.weight1,
          recentVitalSigns.vitalSigns.heightUnit,
          recentVitalSigns.vitalSigns.weightUnit,
          false,
          'Failed to update vital signs in EZDerm'
        );
        
        return false;
      }

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
