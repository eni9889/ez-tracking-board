// Request types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface EncountersRequest {
  username: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  clinicId?: string;
  providerIds?: string[];
}

export interface LogoutRequest {
  username: string;
}

// Response types
export interface LoginResponse {
  success: boolean;
  username: string;
  serverUrl: string;
  sessionToken?: string;
  expiresAt?: string;
}

export interface SessionValidationResponse {
  valid: boolean;
  username?: string;
  expiresAt?: string;
  error?: string;
}

export interface EncountersResponse {
  encounters: Encounter[];
}

export interface ErrorResponse {
  error: string;
  details?: string;
  status?: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  database?: string;
  environment?: string;
}

// EZDerm API types
export interface EZDermLoginRequest {
  username: string;
  password: string;
  application: string;
  timeZoneId: string;
  clientVersion: string;
}

export interface EZDermLoginResponse {
  accessToken: string;
  refreshToken: string;
  servers: {
    app: string;
  };
}

export interface EZDermEncounterFilter {
  dateOfServiceRangeHigh: string;
  clinicId: string;
  providerIds: string[];
  practiceId: string;
  dateOfServiceRangeLow: string;
  lightBean: boolean;
  dateSelection: string;
}

// Patient and encounter types
export interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  medicalRecordNumber: string;
  phoneNumber?: string;
  emailAddress?: string;
}

export interface Provider {
  id: string;
  name: string;
  role: 'PROVIDER' | 'SECONDARY_PROVIDER' | 'COSIGNING_PROVIDER' | 'STAFF';
  title?: string;
}

export interface Encounter {
  id: string;
  patientName: string;
  patientInfo: PatientInfo;
  appointmentTime: string;
  arrivalTime?: string;
  chiefComplaint: string;
  status: EncounterStatus;
  room: string | number;
  providers: Provider[];
  clinicName: string;
  appointmentType: string;
  appointmentColor: string;
  establishedPatient: boolean;
}

export type EncounterStatus = 
  | 'SCHEDULED' 
  | 'CONFIRMED' 
  | 'CHECKED_IN' 
  | 'ARRIVED' 
  | 'IN_ROOM' 
  | 'WITH_PROVIDER' 
  | 'WITH_STAFF' 
  | 'PENDING_COSIGN' 
  | 'CHECKED_OUT' 
  | 'CANCELLED' 
  | 'NO_SHOW' 
  | 'RESCHEDULED' 
  | 'MESSAGE_LEFT' 
  | 'NO_ANSWERED'
  | 'READY_FOR_STAFF';

// Raw EZDerm API encounter response (as received from API)
export interface EZDermEncounter {
  id: string;
  patientInfo: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    medicalRecordNumber: string;
    phoneNumber?: string;
    emailAddress?: string;
  };
  dateOfService: string;
  dateOfArrival?: string;
  chiefComplaintName: string;
  status: EncounterStatus;
  room?: string | number;
  encounterRoleInfoList: Array<{
    providerId: string;
    firstName: string;
    lastName: string;
    encounterRoleType: 'PROVIDER' | 'SECONDARY_PROVIDER' | 'COSIGNING_PROVIDER' | 'STAFF';
    title?: string;
  }>;
  clinicName: string;
  appointmentType: {
    name: string;
    color: string;
  };
  establishedPatient: boolean;
}

// Token storage types
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  serverUrl: string;
  timestamp: number;
}

// Utility types
export type TokenStore = Map<string, StoredTokens>;

// AI Note Checker Job Types
export interface AINoteScanJobData {
  scanId: string;
  batchSize?: number;
}

export interface AINoteCheckJobData {
  encounterId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  dateOfService: string;
  scanId: string;
}

// EZDerm ToDo Types
export interface EZDermToDoUser {
  userId: string;
  userType: 'ASSIGNEE' | 'WATCHER';
}

export interface EZDermToDoLink {
  order: number;
  linkEntityId: string;
  description: string;
  linkType: 'PATIENT' | 'ENCOUNTER';
}

export interface EZDermToDoRequest {
  reminderEnabled: boolean;
  subject: string;
  users: EZDermToDoUser[];
  description: string;
  id: string;
  links: EZDermToDoLink[];
}

export interface EZDermToDoResponse {
  id: string;
}

// AI Note Checker Types
export interface IncompleteNotesRequest {
  fetchFrom?: number;
  size?: number;
  group?: string;
}

export interface IncompleteEncounter {
  id: string;
  active: boolean;
  chiefComplaintName: string;
  unsignedConsents: number;
  dateOfService: string;
  status: EncounterStatus;
  encounterRoleInfoList: Array<{
    active: boolean;
    providerId: string;
    encounterId: string;
    encounterRoleType: 'STAFF' | 'PROVIDER';
    onlineCheckInEnabled: boolean;
    fullOnlineCheckInEnabled: boolean;
  }>;
  virtualEncounter: boolean;
  checkAppointmentTypeOfAptSeries: boolean;
  checkResourceAvailability: boolean;
}

export interface IncompletePatientEncounter {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  avatarS3Id?: string;
  incompleteEncounters: IncompleteEncounter[];
  inboxGroupType: string;
  minEncDate: string;
}

export interface IncompleteNotesResponse {
  count: number;
  incompletePatientEncounters: IncompletePatientEncounter[];
}

export interface ProgressNoteRequest {
  encounterId: string;
}

export interface ProgressNoteItem {
  elementType: string;
  text: string;
  autogenerated: boolean;
  maxCodingValue: number;
  suggestedCodingValue: number;
  order: number;
  note?: string;
  multipleItemValue: any[];
  hasReconciliation?: boolean;
}

export interface ProgressNoteSection {
  sectionType: 'SUBJECTIVE' | 'OBJECTIVE' | 'ASSESSMENT_AND_PLAN';
  locked: boolean;
  order: number;
  items: ProgressNoteItem[];
}

export interface ProgressNoteResponse {
  progressNotes: ProgressNoteSection[];
  groupCodes: {
    problemPointsV2: number;
    dataPointsV2: number;
    riskPointsV2: number;
    emCode: string;
  };
  availablePQRSMeasures: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
  encounterNonBillableStatuses: {
    active: boolean;
    encounterId: string;
    billableEncounter: boolean;
    emCoding: boolean;
  };
  encounterPosted: boolean;
  patientAlerts?: Array<{
    id: string;
    text: string;
    modifiedById: string;
    dateModified: string;
  }>;
  patientId: string;
  availableAlertForPatientNote: boolean;
  showAlerts: boolean;
  notesCount: number;
}

export interface AIAnalysisIssue {
  assessment: string;
  issue: 'no_explicit_plan' | 'chronicity_mismatch' | 'unclear_documentation' | 'chief_complaint_structure';
  details: {
    HPI?: string;
    'A&P': string;
    correction: string;
  };
}

export interface AIAnalysisResult {
  issues?: AIAnalysisIssue[];
  status: 'ok' | 'corrections_needed';
  summary?: string;
}

export interface NoteCheckResult {
  id: number;
  encounterId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  dateOfService: string;
  status: 'pending' | 'completed' | 'error';
  aiAnalysis?: AIAnalysisResult;
  issuesFound: boolean;
  checkedAt: Date;
  checkedBy: string;
  errorMessage?: string;
  noteContentMd5?: string;
  noteContent?: string;
}

export interface NoteCheckQueueItem {
  id: number;
  encounterId: string;
  patientId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  createdAt: Date;
  processedAt?: Date;
}

export interface CreatedToDo {
  id: number;
  encounterId: string;
  patientId: string;
  patientName: string;
  ezDermToDoId: string;
  subject: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  ccList: any[];
  issuesCount: number;
  createdBy: string;
  createdAt: Date;
} 