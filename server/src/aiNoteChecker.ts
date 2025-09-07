import axios from './axiosConfig';
import { AxiosResponse } from 'axios';
import { vitalSignsDb } from './database';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
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
  private readonly CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
  private claudeApiKey: string;
  private promptTemplate: string = '';

  constructor() {
    this.claudeApiKey = process.env.CLAUDE_API_KEY || '';
    if (!this.claudeApiKey) {
      console.warn('⚠️ CLAUDE_API_KEY not found in environment variables. AI analysis will not be available.');
    }
    this.loadPromptTemplate();
  }

  private async loadPromptTemplate(): Promise<void> {
    try {
      const promptPath = path.join(__dirname, 'ai-prompt.md');
      console.log('📝 Loading prompt from:', promptPath);
      this.promptTemplate = await fs.readFile(promptPath, 'utf8');
      const lines = this.promptTemplate.split('\n').length;
      const chars = this.promptTemplate.length;
      console.log(`📝 AI prompt template loaded successfully (${lines} lines, ${chars} characters)`);
    } catch (error) {
      console.error('❌ Failed to load AI prompt template:', error);
      console.log('🔄 Using fallback prompt template');
      this.promptTemplate = `You are a dermatology medical coder. I want you to strictly check two things:
1. If the chronicity of every diagnosis in the A&P matches what is documented in the HPI.
2. If every assessment in the A&P has a documented plan.

You must return {status: :ok} only if absolutely everything is correct. If even one issue is found, return a JSON object listing all issues, with details and corrections. Return JSON only.`;
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
   * Filter assessment and plan text to remove items containing destruction or biopsy
   */
  private filterAssessmentAndPlan(assessmentText: string): string {
    if (!assessmentText) return '';

    // Split the assessment text into individual numbered items
    // The pattern matches the start of a new numbered item (e.g., "1. ", "2. ", etc.)
    const assessmentItems = assessmentText.split(/(?=\n\n\d+\.\s|\n\d+\.\s|^\d+\.\s)/);
    
    const filteredItems: string[] = [];

    for (const item of assessmentItems) {
      if (!item.trim()) continue;

      // Check if this assessment item contains "destruction" or "biopsy" anywhere in the text
      const lowerCaseItem = item.toLowerCase();
      const hasDestructionOrBiopsy = lowerCaseItem.includes('plan:') && (lowerCaseItem.includes('destruction') || lowerCaseItem.includes('biopsy') || lowerCaseItem.includes('excision'));

      if (!hasDestructionOrBiopsy) {
        filteredItems.push(item);
      }
    }

    // Join the filtered items and clean up any extra whitespace
    return filteredItems.join('\n\n').trim();
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
          formattedNote += `\n${item.elementType}:\n${item.note}\n`;
        } 
        else if (item.elementType === 'ASSESSMENT_AND_PLAN') { 
          // Remove any assessment and plan items that have Plan: that includes destruction or biopsy
          const filteredAssessmentText = this.filterAssessmentAndPlan(item.text);
          if (filteredAssessmentText.trim()) {
            formattedNote += `\n${item.elementType}:\n${filteredAssessmentText}\n`;
          }
        }
        else if (item.text && item.text.trim()) {
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
   * Analyze progress note using Claude AI
   */
  async analyzeProgressNote(progressNote: ProgressNoteResponse): Promise<AIAnalysisResult> {
    if (!this.claudeApiKey) {
      throw new Error('Claude API key not configured');
    }

    try {
      console.log('🤖 Analyzing progress note with Claude AI...');
      
      // In development mode, reload the prompt template every time
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Development mode: Reloading AI prompt template from ai-prompt.md...');
        await this.loadPromptTemplate();
        console.log('✅ AI prompt template reloaded successfully');
      }
      
      const noteText = this.formatProgressNoteForAnalysis(progressNote);
      const fullPrompt = `${this.promptTemplate}\n\nProgress Note to analyze:\n${noteText}`;

      const response = await axios.post(
        this.CLAUDE_API_URL,
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: 'You are a medical coding assistant. You must respond with ONLY valid JSON. Do not include any explanations, comments, or additional text outside the JSON object.',
          messages: [
            {
              role: 'user',
              content: fullPrompt
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.claudeApiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 120000 // 2 minutes timeout for Anthropic API calls
        }
      );

      const aiResponse = response.data.content[0].text;
      console.log('📝 Raw AI response:', aiResponse);

      // Parse the JSON response from Claude
      let analysisResult: AIAnalysisResult;
      try {
        // Extract JSON from the response (might have extra text)
        let jsonText = this.extractJSON(aiResponse);
        
        // Fix common JSON syntax issues from Claude
        jsonText = this.fixCommonJSONIssues(jsonText);
        
        const parsedResponse = JSON.parse(jsonText);
        console.log('🔍 Parsed AI response:', JSON.stringify(parsedResponse, null, 2));
        
        analysisResult = this.normalizeAIResponse(parsedResponse);
        console.log('🔧 Normalized result:', JSON.stringify(analysisResult, null, 2));
      } catch (parseError) {
        console.error('❌ Failed to parse AI response as JSON:', parseError);
        console.error('Raw response:', aiResponse);
        
        // Fallback response
        analysisResult = {
          status: 'corrections_needed',
          summary: 'AI analysis failed to parse response properly',
          issues: [{
            assessment: 'Analysis Error',
            issue: 'no_explicit_plan',
            details: {
              'A&P': 'Could not parse AI response',
              correction: 'Manual review required'
            }
          }]
        };
      }

      console.log('✅ AI analysis completed');
      return analysisResult;
    } catch (error: any) {
      console.error('❌ Error analyzing progress note with AI:', error.response?.data || error.message);
      throw new Error(`AI analysis failed: ${error.message}`);
    }
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
