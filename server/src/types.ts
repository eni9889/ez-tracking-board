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

export interface EncountersResponse {
  encounters: Encounter[];
}

export interface ErrorResponse {
  error: string;
  details?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
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