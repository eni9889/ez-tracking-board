declare class VitalSignsService {
    private readonly EZDERM_BASE_URL;
    /**
     * Calculate patient age from date of birth
     */
    private calculateAge;
    /**
     * Check if patient is eligible for vital signs carryforward
     */
    private isEligibleForCarryforward;
    /**
     * Get historical encounters for a patient
     */
    private getHistoricalEncounters;
    /**
     * Get vital signs for a specific encounter
     */
    private getVitalSigns;
    /**
     * Update vital signs for an encounter
     */
    private updateVitalSigns;
    /**
     * Check if vital signs contain height and weight data
     */
    private hasHeightAndWeight;
    /**
     * Process vital signs carryforward for a single encounter
     */
    processVitalSignsCarryforward(encounter: any, accessToken: string): Promise<boolean>;
    /**
     * Process vital signs carryforward for multiple encounters
     */
    processMultipleEncounters(encounters: any[], accessToken: string): Promise<{
        processed: number;
        successful: number;
        failed: number;
    }>;
    /**
     * Get processing statistics
     */
    getProcessingStats(): Promise<{
        total: number;
        successful: number;
        failed: number;
    }>;
}
export declare const vitalSignsService: VitalSignsService;
export {};
//# sourceMappingURL=vitalSignsService.d.ts.map