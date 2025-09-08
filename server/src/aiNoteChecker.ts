import axios from './axiosConfig';
import { AxiosResponse } from 'axios';
import { vitalSignsDb } from './database';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import OpenAI from 'openai';
import {
  IncompleteNotesRequest,
  IncompleteNotesResponse,
  IncompletePatientEncounter,
  IncompleteEncounter,
  ProgressNoteRequest,
  ProgressNoteResponse,
  AIAnalysisResult,
  AIAnalysisIssue,
  NoteCheckResult,
  EZDermToDoRequest,
  EZDermToDoResponse,
  EZDermToDoUser,
  EZDermToDoLink
} from './types';

class AINoteChecker {
  private readonly EZDERM_API_BASE = 'https://srvprod.ezinfra.net';
  private openaiClient: OpenAI;
  private promptTemplates: Map<string, string> = new Map();

  // Define the check types
  private readonly CHECK_TYPES = {
    CHRONICITY: 'chronicity-check',
    HPI_STRUCTURE: 'hpi-structure-check',
    PLAN: 'plan-check',
    ACCURACY: 'accuracy-check'
  } as const;

  // Model configuration for different check types
  // gpt-4o: More capable, better for complex analysis (HPI structure, plan evaluation)
  // gpt-4o-mini: Faster and cheaper, good for simpler checks (chronicity, accuracy)
  private readonly CHECK_MODELS = {
    'chronicity-check': 'gpt-5',     // Simple chronicity detection
    'hpi-structure-check': 'gpt-5-nano',       // Complex HPI structure analysis
    'plan-check': 'gpt-5-nano',                // Detailed plan evaluation
    'accuracy-check': 'gpt-5-mini'        // Basic accuracy validation
  } as const;

  // Default model fallback
  private readonly DEFAULT_MODEL = 'gpt-5-nano';

  constructor() {
    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    if (!openaiApiKey) {
      console.warn('⚠️ OPENAI_API_KEY not found in environment variables. AI analysis will not be available.');
    }
    
    this.openaiClient = new OpenAI({
      apiKey: openaiApiKey
    });
    
    this.loadAllPromptTemplates();
  }

  private async loadAllPromptTemplates(): Promise<void> {
    const checkTypes = Object.values(this.CHECK_TYPES);
    
    for (const checkType of checkTypes) {
      try {
        const promptPath = path.join(__dirname, 'prompts', `${checkType}.md`);
        console.log(`📝 Loading ${checkType} prompt from:`, promptPath);
        const promptContent = await fs.readFile(promptPath, 'utf8');
        this.promptTemplates.set(checkType, promptContent);
        const lines = promptContent.split('\n').length;
        const chars = promptContent.length;
        console.log(`📝 ${checkType} prompt loaded successfully (${lines} lines, ${chars} characters)`);
      } catch (error) {
        console.error(`❌ Failed to load ${checkType} prompt template:`, error);
        console.log(`🔄 Using fallback prompt for ${checkType}`);
        this.promptTemplates.set(checkType, this.getFallbackPrompt(checkType));
      }
    }
  }

  private getFallbackPrompt(checkType: string): string {
    switch (checkType) {
      case this.CHECK_TYPES.CHRONICITY:
        return `You are a dermatology medical coder. Check if the chronicity of every diagnosis in the A&P matches what is documented in the HPI. Return {"status": "ok", "reason": "..."} if correct, or JSON with issues if problems found.`;
      case this.CHECK_TYPES.HPI_STRUCTURE:
        return `You are a dermatology medical coder. Check if the HPI structure is correct for billing. Return {"status": "ok", "reason": "..."} if correct, or JSON with issues if problems found.`;
      case this.CHECK_TYPES.PLAN:
        return `You are a dermatology medical coder. Check if every assessment in the A&P has a documented plan. Return {"status": "ok", "reason": "..."} if correct, or JSON with issues if problems found.`;
      case this.CHECK_TYPES.ACCURACY:
        return `You are a dermatology medical coder. Check if the A&P aligns with the HPI. Return {"status": "ok", "reason": "..."} if correct, or JSON with issues if problems found.`;
      default:
        return `You are a dermatology medical coder. Analyze the note for issues. Return {"status": "ok", "reason": "..."} if correct, or JSON with issues if problems found.`;
    }
  }

  /**
   * Check if an encounter is eligible for AI note checking
   */
  private parseDate(dateString: string): Date {
    // Handle malformed date strings
    if (!dateString || typeof dateString !== 'string') {
      console.warn(`⚠️ Invalid date string: ${dateString}, using current time`);
      return new Date();
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn(`⚠️ Failed to parse date: ${dateString}, using current time`);
      return new Date();
    }
    
    return date;
  }

  private isEligibleForCheck(encounter: IncompleteEncounter): boolean {
    const eligibleStatuses = ['PENDING_COSIGN', 'CHECKED_OUT', 'WITH_PROVIDER'];
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const serviceDate = this.parseDate(encounter.dateOfService);
    
    return eligibleStatuses.includes(encounter.status) && 
           serviceDate < twoHoursAgo;
  }

  /**
   * Fetch incomplete notes from EZDerm API
   */
  async fetchIncompleteNotes(
    accessToken: string, 
    request: IncompleteNotesRequest = {}
  ): Promise<IncompleteNotesResponse[]> {
    try {
      console.log('📋 Fetching incomplete notes from EZDerm API...');
      
      const requestData = {
        fetchFrom: request.fetchFrom || 0,
        size: request.size || 50,
        ...(request.group && { group: request.group })
      };

      const response: AxiosResponse<IncompleteNotesResponse[]> = await axios.post(
        `${this.EZDERM_API_BASE}/ezderm-webservice/rest/inbox/getIncompleteNotes`,
        requestData,
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'user-agent': 'ezDerm/4.28.1 (build:133.1; macOS(Catalyst) 15.6.0)',
            'accept-language': 'en-US;q=1.0'
          }
        }
      );

      console.log(`✅ Fetched ${response.data.length} incomplete note batches`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching incomplete notes:', error.response?.data || error.message);
      throw new Error(`Failed to fetch incomplete notes: ${error.message}`);
    }
  }

  /**
   * Get all incomplete notes with pagination support
   */
  async getAllIncompleteNotes(accessToken: string): Promise<IncompletePatientEncounter[]> {
    try {
      let allPatients: IncompletePatientEncounter[] = [];
      let fetchFrom = 0;
      const pageSize = 50;
      let hasMore = true;

      while (hasMore) {
        console.log(`📄 Fetching incomplete notes page starting from ${fetchFrom}...`);
        
        const response = await this.fetchIncompleteNotes(accessToken, {
          fetchFrom,
          size: pageSize
        });

        if (response.length === 0 || !response[0] || response[0].incompletePatientEncounters.length === 0) {
          hasMore = false;
          break;
        }

        allPatients.push(...response[0].incompletePatientEncounters);
        fetchFrom += pageSize;

        // Safety check to prevent infinite loops
        if (allPatients.length > 1000) {
          console.log('⚠️ Reached safety limit of 1000 patients, stopping pagination');
          break;
        }
      }

      console.log(`📊 Total incomplete patients fetched: ${allPatients.length}`);
      return allPatients;
    } catch (error: any) {
      console.error('❌ Error getting all incomplete notes:', error.message);
      throw error;
    }
  }

  /**
   * Filter encounters that are eligible for AI checking
   */
  filterEligibleEncounters(patients: IncompletePatientEncounter[]): Array<{
    patient: IncompletePatientEncounter;
    encounter: IncompleteEncounter;
  }> {
    const eligible: Array<{ patient: IncompletePatientEncounter; encounter: IncompleteEncounter }> = [];

    for (const patient of patients) {
      for (const encounter of patient.incompleteEncounters) {
        if (this.isEligibleForCheck(encounter)) {
          eligible.push({ patient, encounter });
        }
      }
    }

    console.log(`🎯 Found ${eligible.length} encounters eligible for AI checking`);
    return eligible;
  }

  /**
   * Fetch full encounter details including care team with names
   */
  async fetchEncounterDetails(
    accessToken: string,
    encounterId: string
  ): Promise<any> {
    try {
      console.log(`🏥 Fetching encounter details for: ${encounterId}`);
      
      const response: AxiosResponse<any> = await axios.get(
        `${this.EZDERM_API_BASE}/ezderm-webservice/rest/encounter/getById/_rid/${encounterId}`,
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'encounterid': encounterId,
            'user-agent': 'ezDerm/4.28.1 (build:133.1; macOS(Catalyst) 15.6.0)',
            'accept-language': 'en-US;q=1.0'
          }
        }
      );

      console.log(`✅ Encounter details fetched for: ${encounterId}`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Error fetching encounter details for ${encounterId}:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch encounter details: ${error.message}`);
    }
  }

  /**
   * Fetch progress note details for a specific encounter
   */
  async fetchProgressNote(
    accessToken: string,
    encounterId: string,
    patientId: string
  ): Promise<ProgressNoteResponse> {
    try {
      console.log(`📄 Fetching progress note for encounter: ${encounterId}`);
      
      const response: AxiosResponse<ProgressNoteResponse> = await axios.post(
        `${this.EZDERM_API_BASE}/ezderm-webservice/rest/progressnote/getProgressNoteInfo`,
        { encounterId },
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'encounterid': encounterId,
            'patientid': patientId,
            'user-agent': 'ezDerm/4.28.1 (build:133.1; macOS(Catalyst) 15.6.0)',
            'accept-language': 'en-US;q=1.0'
          }
        }
      );

      console.log(`✅ Progress note fetched for encounter: ${encounterId}`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Error fetching progress note for encounter ${encounterId}:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch progress note: ${error.message}`);
    }
  }

  /**
   * Format progress note for AI analysis
   */
  private formatProgressNoteForAnalysis(progressNote: ProgressNoteResponse): string {
    let formattedNote = '';

    for (const section of progressNote.progressNotes) {
      formattedNote += `\n\n--- ${section.sectionType} ---\n`;
      
      for (const item of section.items) {
        if (item.elementType === 'HISTORY_OF_PRESENT_ILLNESS') {
          const HPIIntroText = item.text.split('\n\n')[0]
          console.log('HPIIntroText:', HPIIntroText)
          formattedNote += `\n${item.elementType}:\n${HPIIntroText}\n${item.note}\n`;
        } else if (item.text && item.text.trim()) {
          formattedNote += `\n${item.elementType}:\n${item.text}\n`;
          
          if (item.note && item.note.trim()) {
            formattedNote += `Note: ${item.note}\n`;
          }
        }
      }
    }

    return formattedNote.trim();
  }

  /**
   * Get the AI model to use for a specific check type
   */
  private getModelForCheck(checkType: string): string {
    return this.CHECK_MODELS[checkType as keyof typeof this.CHECK_MODELS] || this.DEFAULT_MODEL;
  }

  /**
   * Get model configuration summary for logging
   */
  private getModelConfigSummary(): string {
    const configs = Object.entries(this.CHECK_MODELS).map(([check, model]) => `${check}: ${model}`);
    return configs.join(', ');
  }

  /**
   * Perform a single AI check with specific prompt
   */
  private async performSingleCheck(
    checkType: string, 
    noteText: string
  ): Promise<AIAnalysisResult> {
    if (!this.openaiClient.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.promptTemplates.get(checkType);
    if (!prompt) {
      throw new Error(`Prompt template not found for check type: ${checkType}`);
    }

    // Get the model for this specific check type
    const modelToUse = this.getModelForCheck(checkType);

    try {
      console.log(`🤖 Performing ${checkType} check with OpenAI ${modelToUse}...`);

      const response = await this.openaiClient.responses.create({
        model: modelToUse,
        input: `${prompt}\n\nProgress Note to analyze:\n${noteText}`
      });

      const aiResponse = response.output_text;
      if (!aiResponse) {
        throw new Error(`No response content received from OpenAI for ${checkType}`);
      }
      
      console.log(`📝 Raw AI response for ${checkType}:`, aiResponse);

      // Parse the JSON response from OpenAI
      let analysisResult: AIAnalysisResult;
      try {
        // Extract JSON from the response (might have extra text)
        let jsonText = this.extractJSON(aiResponse);
        
        // Fix common JSON syntax issues from AI responses
        jsonText = this.fixCommonJSONIssues(jsonText);
        
        const parsedResponse = JSON.parse(jsonText);
        console.log(`🔍 Parsed AI response for ${checkType}:`, JSON.stringify(parsedResponse, null, 2));
        
        analysisResult = this.normalizeAIResponse(parsedResponse);
        console.log(`🔧 Normalized result for ${checkType}:`, JSON.stringify(analysisResult, null, 2));
      } catch (parseError) {
        console.error(`❌ Failed to parse AI response as JSON for ${checkType}:`, parseError);
        console.error('Raw response:', aiResponse);
        
        // Fallback response
        analysisResult = {
          status: 'corrections_needed',
          summary: `${checkType} analysis failed to parse response properly`,
          issues: [{
            assessment: 'Analysis Error',
            issue: 'unclear_documentation',
            details: {
              'A&P': `Could not parse AI response for ${checkType}`,
              correction: 'Manual review required'
            }
          }]
        };
      }

      console.log(`✅ ${checkType} check completed`);
      return analysisResult;
    } catch (error: any) {
      console.error(`❌ Error performing ${checkType} check:`, error.response?.data || error.message);
      throw new Error(`${checkType} check failed: ${error.message}`);
    }
  }

  /**
   * Analyze progress note using multiple specialized AI checks
   */
  async analyzeProgressNote(progressNote: ProgressNoteResponse): Promise<AIAnalysisResult> {
    if (!this.openaiClient.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      console.log('🤖 Starting comprehensive AI note analysis with multiple checks...');
      
      // In development mode, reload all prompt templates
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Development mode: Reloading all AI prompt templates...');
        await this.loadAllPromptTemplates();
        console.log('✅ All AI prompt templates reloaded successfully');
      }
      
      const noteText = this.formatProgressNoteForAnalysis(progressNote);

      // Perform all AI checks in parallel for better performance
      const checkPromises = Object.values(this.CHECK_TYPES).map(checkType => 
        this.performSingleCheck(checkType, noteText)
      );

      console.log(`🔄 Running ${checkPromises.length} AI checks in parallel...`);
      console.log(`🤖 Model configuration: ${this.getModelConfigSummary()}`);
      const aiCheckResults = await Promise.all(checkPromises);

      // Perform local vital signs check (no AI call needed)
      const vitalSignsResult = this.checkVitalSigns(progressNote);

      // Combine all results (AI checks + vital signs check)
      const allCheckResults = [...aiCheckResults, vitalSignsResult];
      const combinedResult = this.combineCheckResults(allCheckResults);
      
      console.log('✅ Comprehensive note analysis completed (AI checks + local validation)');
      console.log('📊 Combined analysis result:', JSON.stringify(combinedResult, null, 2));
      
      return combinedResult;
    } catch (error: any) {
      console.error('❌ Error analyzing progress note with AI:', error.response?.data || error.message);
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  /**
   * Check for presence of height and weight in vital signs (local validation)
   */
  private checkVitalSigns(progressNote: ProgressNoteResponse): AIAnalysisResult {
    console.log('🔍 Checking vital signs for height and weight...');
    
    // Find the OBJECTIVE section
    const objectiveSection = progressNote.progressNotes.find(
      section => section.sectionType === 'OBJECTIVE'
    );
    
    if (!objectiveSection) {
      console.log('⚠️ No OBJECTIVE section found');
      return {
        status: 'corrections_needed',
        summary: 'Missing OBJECTIVE section with vital signs',
        issues: [{
          assessment: 'Vital Signs',
          issue: 'unclear_documentation',
          details: {
            HPI: 'No OBJECTIVE section found',
            'A&P': 'Vital signs section missing',
            correction: 'Add OBJECTIVE section with height and weight measurements'
          }
        }]
      };
    }
    
    // Find the VITAL_SIGNS element
    const vitalSignsItem = objectiveSection.items.find(
      item => item.elementType === 'VITAL_SIGNS'
    );
    
    if (!vitalSignsItem || !vitalSignsItem.text) {
      console.log('⚠️ No VITAL_SIGNS element found');
      return {
        status: 'corrections_needed',
        summary: 'Missing vital signs documentation',
        issues: [{
          assessment: 'Vital Signs',
          issue: 'unclear_documentation',
          details: {
            HPI: 'Vital signs not documented',
            'A&P': 'Height and weight required for billing',
            correction: 'Add height and weight measurements to vital signs'
          }
        }]
      };
    }
    
    const vitalSignsText = vitalSignsItem.text.toLowerCase();
    const hasHeight = vitalSignsText.includes('height') || vitalSignsText.includes('ht');
    const hasWeight = vitalSignsText.includes('weight') || vitalSignsText.includes('wt') || vitalSignsText.includes('lbs') || vitalSignsText.includes('kg');
    
    const missingVitals: string[] = [];
    if (!hasHeight) missingVitals.push('height');
    if (!hasWeight) missingVitals.push('weight');
    
    if (missingVitals.length > 0) {
      console.log(`⚠️ Missing vital signs: ${missingVitals.join(', ')}`);
      return {
        status: 'corrections_needed',
        summary: `Missing required vital signs: ${missingVitals.join(' and ')}`,
        issues: [{
          assessment: 'Vital Signs',
          issue: 'unclear_documentation',
          details: {
            HPI: `Current vital signs: ${vitalSignsItem.text}`,
            'A&P': `Missing ${missingVitals.join(' and ')} measurements`,
            correction: `Add ${missingVitals.join(' and ')} to vital signs documentation`
          }
        }]
      };
    }
    
    console.log('✅ Height and weight found in vital signs');
    return {
      status: 'ok',
      reason: 'Height and weight are properly documented in vital signs'
    };
  }

  /**
   * Combine results from multiple AI checks into a single result
   */
  private combineCheckResults(checkResults: AIAnalysisResult[]): AIAnalysisResult {
    const allIssues: AIAnalysisIssue[] = [];
    let hasIssues = false;

    // Collect all issues from all checks
    for (const result of checkResults) {
      if (result.status === 'corrections_needed' && result.issues) {
        allIssues.push(...result.issues);
        hasIssues = true;
      }
    }

    // If no issues found across all checks
    if (!hasIssues) {
      return {
        status: 'ok',
        reason: 'All checks passed: chronicity, HPI structure, plan documentation, accuracy validation, and vital signs verification completed successfully'
      };
    }

    // If issues found, combine them
    const issueTypes = [...new Set(allIssues.map(issue => issue.issue))];
    const issueCount = allIssues.length;
    
    return {
      status: 'corrections_needed',
      summary: `Found ${issueCount} issue${issueCount > 1 ? 's' : ''} across multiple checks: ${issueTypes.join(', ')}`,
      issues: allIssues
    };
  }

  /**
   * Perform complete note check for a single encounter
   */
  async checkSingleNote(
    accessToken: string,
    encounterId: string,
    patientId: string,
    patientName: string,
    chiefComplaint: string,
    dateOfService: string,
    checkedBy: string,
    force: boolean = false
  ): Promise<NoteCheckResult> {
    console.log(`🔍 Starting AI note check for encounter: ${encounterId}`);
    
    try {
      // Fetch progress note
      const progressNote = await this.fetchProgressNote(accessToken, encounterId, patientId);
      
      // Calculate MD5 for duplicate detection
      const noteContentMd5 = this.calculateNoteContentMd5(progressNote);
      const noteContent = this.formatProgressNoteForAnalysis(progressNote);
      
      console.log(`🔐 Note content MD5: ${noteContentMd5}`);
      
      // Check if we've already analyzed this exact content (unless forced)
      const existingCheck = await vitalSignsDb.findNoteCheckByMd5(noteContentMd5);
      
      let aiAnalysis: AIAnalysisResult;
      let issuesFound: boolean;
      
      if (existingCheck && existingCheck.status === 'completed' && !force) {
        console.log(`♻️ Found existing analysis for same content (MD5: ${noteContentMd5}), reusing result`);
        aiAnalysis = existingCheck.ai_analysis;
        issuesFound = existingCheck.issues_found;
      } else {
        if (force) {
          console.log(`🔄 Force flag detected, performing fresh AI analysis despite existing MD5: ${noteContentMd5}`);
        } else {
          console.log(`🆕 New content detected, performing AI analysis`);
        }
        // Analyze with AI
        aiAnalysis = await this.analyzeProgressNote(progressNote);
        
        // Determine if issues were found
        issuesFound = aiAnalysis.status === 'corrections_needed' && 
                      Boolean(aiAnalysis.issues) && 
                      (aiAnalysis.issues?.length || 0) > 0;
      }

      console.log(`📊 Analysis result: status=${aiAnalysis.status}, issues=${aiAnalysis.issues?.length || 0}, issuesFound=${issuesFound}`);

      // Save result to database
      const resultId = await vitalSignsDb.saveNoteCheckResult(
        encounterId,
        patientId,
        patientName,
        chiefComplaint,
        this.parseDate(dateOfService),
        'completed',
        checkedBy,
        aiAnalysis,
        issuesFound,
        undefined, // errorMessage
        noteContentMd5,
        noteContent
      );

      console.log(`✅ Note check completed for encounter: ${encounterId} (Issues found: ${issuesFound})`);

      return {
        id: resultId,
        encounterId,
        patientId,
        patientName,
        chiefComplaint,
        dateOfService,
        status: 'completed',
        aiAnalysis,
        issuesFound,
        checkedAt: new Date(),
        checkedBy
      };
    } catch (error: any) {
      console.error(`❌ Note check failed for encounter ${encounterId}:`, error.message);
      
      // Save error result to database
      const resultId = await vitalSignsDb.saveNoteCheckResult(
        encounterId,
        patientId,
        patientName,
        chiefComplaint,
        this.parseDate(dateOfService),
        'error',
        checkedBy,
        undefined,
        false,
        error.message
      );

      return {
        id: resultId,
        encounterId,
        patientId,
        patientName,
        chiefComplaint,
        dateOfService,
        status: 'error',
        issuesFound: false,
        checkedAt: new Date(),
        checkedBy,
        errorMessage: error.message
      };
    }
  }

  /**
   * Process multiple eligible encounters
   */
  async processEligibleEncounters(
    accessToken: string,
    checkedBy: string
  ): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: NoteCheckResult[];
  }> {
    console.log('🚀 Starting batch processing of eligible encounters...');
    
    try {
      // Get all incomplete notes
      const allPatients = await this.getAllIncompleteNotes(accessToken);
      console.log('🔍 All patients:', allPatients.length);

      // Filter eligible encounters
      const eligibleEncounters = this.filterEligibleEncounters(allPatients);
      console.log('🔍 Eligible encounters:', eligibleEncounters.length);
      
      if (eligibleEncounters.length === 0) {
        console.log('ℹ️ No eligible encounters found for processing');
        return { processed: 0, successful: 0, failed: 0, results: [] };
      }

      const results: NoteCheckResult[] = [];
      let successful = 0;
      let failed = 0;

      // Process each eligible encounter
      for (const { patient, encounter } of eligibleEncounters) {
        try {
          const patientName = `${patient.firstName} ${patient.lastName}`;
          
          const result = await this.checkSingleNote(
            accessToken,
            encounter.id,
            patient.id,
            patientName,
            encounter.chiefComplaintName,
            encounter.dateOfService,
            checkedBy
          );

          results.push(result);
          
          if (result.status === 'completed') {
            successful++;
          } else {
            failed++;
          }

          // Add small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          console.error(`❌ Error processing encounter ${encounter.id}:`, error.message);
          failed++;
        }
      }

      console.log(`✅ Batch processing completed: ${successful} successful, ${failed} failed`);
      
      return {
        processed: eligibleEncounters.length,
        successful,
        failed,
        results
      };
    } catch (error: any) {
      console.error('❌ Error in batch processing:', error.message);
      throw error;
    }
  }

  /**
   * Get note check results from database
   */
  async getNoteCheckResults(limit: number = 50, offset: number = 0): Promise<NoteCheckResult[]> {
    return await vitalSignsDb.getNoteCheckResults(limit, offset);
  }

  /**
   * Get specific note check result
   */
  async getNoteCheckResult(encounterId: string): Promise<NoteCheckResult | null> {
    return await vitalSignsDb.getNoteCheckResult(encounterId);
  }

  /**
   * Calculate MD5 hash of note content for duplicate detection
   */
  private calculateNoteContentMd5(progressNote: ProgressNoteResponse): string {
    const noteText = this.formatProgressNoteForAnalysis(progressNote);
    return crypto.createHash('md5').update(noteText).digest('hex');
  }

  /**
   * Extract JSON from AI response that might contain extra text
   */
  private extractJSON(text: string): string {
    // Try to find JSON object boundaries
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonStart > jsonEnd) {
      throw new Error('No valid JSON object found in response');
    }
    
    return text.substring(jsonStart, jsonEnd + 1);
  }

  /**
   * Fix common JSON syntax issues that Claude might produce
   */
  private fixCommonJSONIssues(jsonText: string): string {
    // Fix ":ok" -> "ok" (remove extra colon)
    jsonText = jsonText.replace(/"status":\s*:(\w+)/g, '"status": "$1"');
    
    // Fix ":corrections_needed" -> "corrections_needed"
    jsonText = jsonText.replace(/"status":\s*:(\w+)/g, '"status": "$1"');
    
    // Fix other potential colon issues
    jsonText = jsonText.replace(/:\s*:([^,}\]]+)/g, ': "$1"');
    
    return jsonText;
  }

  /**
   * Normalize AI response to match expected format
   */
  private normalizeAIResponse(response: any): AIAnalysisResult {
    // Handle the case where Claude returns "ok" or ":ok" status
    if (response.status === 'ok' || response.status === ':ok') {
      return {
        status: 'ok',
        reason: response.reason || undefined
      };
    }

    // Handle different error status formats
    let status = response.status;
    if (status === 'error' || status === 'corrections_needed') {
      status = 'corrections_needed';
    }

    // Normalize issues array
    const issues: AIAnalysisIssue[] = [];
    if (response.issues && Array.isArray(response.issues)) {
      for (const issue of response.issues) {
        // Handle the format Claude is actually returning
        if (issue.type && issue.diagnoses && issue.details) {
          // Convert Claude's format to our expected format
          const normalizedIssue: AIAnalysisIssue = {
            assessment: Array.isArray(issue.diagnoses) ? issue.diagnoses.join(', ') : issue.diagnoses,
            issue: issue.type === 'chronicity_mismatch' ? 'chronicity_mismatch' : 
                   issue.type === 'missing_plan' ? 'no_explicit_plan' : 'unclear_documentation',
            details: {
              'A&P': typeof issue.details === 'string' ? issue.details : JSON.stringify(issue.details),
              correction: `Review and correct the ${issue.type} for: ${Array.isArray(issue.diagnoses) ? issue.diagnoses.join(', ') : issue.diagnoses}`
            }
          };
          issues.push(normalizedIssue);
        } else if (issue.assessment && issue.issue && issue.details) {
          // Already in expected format
          issues.push(issue);
        }
      }
    }

    return {
      status: status as 'ok' | 'corrections_needed',
      summary: response.summary || `Found ${issues.length} issue(s) requiring attention`,
      issues
    };
  }

  /**
   * Create a ToDo in EZDerm for note deficiencies
   */
  async createNoteDeficiencyToDo(
    accessToken: string,
    encounterId: string,
    patientId: string,
    patientName: string,
    encounterDate: string,
    issues: AIAnalysisIssue[],
    encounterRoleInfoList: any[]
  ): Promise<string> {
    try {
      console.log('📝 Creating note deficiency ToDo for encounter:', encounterId);

      // Format the encounter date as MM/DD/YYYY
      const date = new Date(encounterDate);
      const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
      
      // Build the subject
      const subject = `Note Deficiencies - ${formattedDate}`;
      
      // Build the description from issues
      let description = 'The following issues were found in the clinical note:\n\n';
      issues.forEach((issue, index) => {
        description += `${index + 1}. ${issue.assessment}:\n`;
        description += `   Issue: ${issue.issue.replace(/_/g, ' ')}\n`;
        if (issue.details.HPI) {
          description += `   HPI: ${issue.details.HPI}\n`;
        }
        description += `   A&P: ${issue.details['A&P']}\n`;
        description += `   Suggested Correction: ${issue.details.correction}\n\n`;
      });
      
      // Determine care team users from encounterRoleInfoList
      const users: EZDermToDoUser[] = [];
      const processedUserIds = new Set<string>();
      
      // Find SECONDARY_PROVIDER or STAFF for assignment
      let assigneeFound = false;
      for (const roleInfo of encounterRoleInfoList) {
        if (roleInfo.active && roleInfo.providerId && !processedUserIds.has(roleInfo.providerId)) {
          if ((roleInfo.encounterRoleType === 'SECONDARY_PROVIDER' || roleInfo.encounterRoleType === 'STAFF') && !assigneeFound) {
            users.push({
              userId: roleInfo.providerId,
              userType: 'ASSIGNEE'
            });
            assigneeFound = true;
            processedUserIds.add(roleInfo.providerId);
          } else if (roleInfo.encounterRoleType === 'PROVIDER' || roleInfo.encounterRoleType === 'STAFF' || roleInfo.encounterRoleType === 'SECONDARY_PROVIDER') {
            // Add everyone else as watchers
            users.push({
              userId: roleInfo.providerId,
              userType: 'WATCHER'
            });
            processedUserIds.add(roleInfo.providerId);
          }
        }
      }
      
      // If no SECONDARY_PROVIDER or STAFF found, assign to the first PROVIDER
      if (!assigneeFound && encounterRoleInfoList.length > 0) {
        const firstProvider = encounterRoleInfoList.find(role => 
          role.active && role.providerId && role.encounterRoleType === 'PROVIDER'
        );
        if (firstProvider && !processedUserIds.has(firstProvider.providerId)) {
          users.push({
            userId: firstProvider.providerId,
            userType: 'ASSIGNEE'
          });
          processedUserIds.add(firstProvider.providerId);
        }
      }
      
      // Create patient link
      const links: EZDermToDoLink[] = [
        {
          order: 0,
          linkEntityId: patientId,
          description: patientName,
          linkType: 'PATIENT'
        }
      ];
      
      // Generate unique ToDo ID
      const todoId = crypto.randomUUID();
      
      const todoRequest: EZDermToDoRequest = {
        reminderEnabled: false,
        subject,
        users,
        description,
        id: todoId,
        links
      };

      console.log('📝 ToDo request:', {
        subject,
        assignees: users.filter(u => u.userType === 'ASSIGNEE').length,
        watchers: users.filter(u => u.userType === 'WATCHER').length,
        issuesCount: issues.length
      });

      const response: AxiosResponse<EZDermToDoResponse> = await axios.post(
        `${this.EZDERM_API_BASE}/ezderm-webservice/rest/task/add`,
        todoRequest,
        {
          headers: {
            'Host': 'srvprod.ezinfra.net',
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${accessToken}`,
            'patientid': patientId,
            'user-agent': 'ezDerm/4.28.1 (build:133.1; macOS(Catalyst) 15.6.0)',
            'accept-language': 'en-US;q=1.0'
          }
        }
      );

      console.log('✅ ToDo created successfully:', response.data.id);
      return response.data.id;
      
    } catch (error: any) {
      console.error('❌ Error creating note deficiency ToDo:', error.response?.data || error.message);
      throw new Error(`Failed to create ToDo: ${error.message}`);
    }
  }
}

// Export singleton instance
export const aiNoteChecker = new AINoteChecker();
