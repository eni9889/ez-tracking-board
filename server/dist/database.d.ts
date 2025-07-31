declare class VitalSignsDatabase {
    private db;
    private readonly dbPath;
    constructor();
    initialize(): Promise<void>;
    private createTables;
    hasBeenProcessed(encounterId: string): Promise<boolean>;
    markAsProcessed(encounterId: string, patientId: string, sourceEncounterId?: string, heightValue?: number, weightValue?: number, heightUnit?: string, weightUnit?: string, success?: boolean, errorMessage?: string): Promise<void>;
    getProcessingStats(): Promise<{
        total: number;
        successful: number;
        failed: number;
    }>;
    close(): Promise<void>;
}
export declare const vitalSignsDb: VitalSignsDatabase;
export {};
//# sourceMappingURL=database.d.ts.map