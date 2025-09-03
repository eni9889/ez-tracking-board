// EMR Provider types
export type EMRProvider = 'EZDERM' | 'EMA';

// Login types
export interface BaseLoginRequest {
  emrProvider: EMRProvider;
  username: string;
  password: string;
}

export interface EZDermLoginRequest extends BaseLoginRequest {
  emrProvider: 'EZDERM';
}

export interface EMALoginRequest extends BaseLoginRequest {
  emrProvider: 'EMA';
  firmName: string;
}

export type LoginRequest = EZDermLoginRequest | EMALoginRequest;

export interface LoginResponse {
  success: boolean;
  username: string;
  serverUrl: string;
  emrProvider: EMRProvider;
  sessionToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface SessionValidationResponse {
  valid: boolean;
  username?: string;
  expiresAt?: string;
  error?: string;
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
  status: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'ARRIVED' | 'IN_ROOM' | 'WITH_PROVIDER' | 'WITH_STAFF' | 'READY_FOR_STAFF' | 'PENDING_COSIGN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED' | 'MESSAGE_LEFT' | 'NO_ANSWERED' | 'NOT_ARRIVED' | 'ENCOUNTER_COMPLETED';
  room?: string | number;
  providers: Provider[];
  clinicName: string;
  appointmentType: string;
  appointmentColor: string;
  establishedPatient: boolean;
}

export interface EncountersRequest {
  username: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  clinicId?: string;
  providerIds?: string[];
}

export interface EncountersResponse {
  encounters: Encounter[];
}

// Auth context types
export interface User {
  username: string;
  emrProvider: EMRProvider;
}

export interface AuthContextType {
  user: User | null;
  login: (loginRequest: LoginRequest, persistentLogin?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// ModMed EMA OAuth2 Response types
export interface EMATokenResponse {
  scope: string;
  token_type: string;
  access_token: string;
  refresh_token: string;
}

// FHIR Bundle types for EMA encounters
export interface FHIRCoding {
  system: string;
  code: string;
  display: string;
}

export interface FHIRCodeableConcept {
  coding: FHIRCoding[];
  text?: string;
}

export interface FHIRReference {
  reference: string;
  display: string;
}

export interface FHIRPeriod {
  start: string;
  end?: string;
}

export interface FHIRParticipant {
  type: FHIRCodeableConcept[];
  individual: FHIRReference;
}

export interface FHIRLocation {
  location: FHIRReference;
}

export interface FHIREncounter {
  resourceType: 'Encounter';
  id: string;
  meta: {
    lastUpdated: string;
  };
  status: string;
  class: FHIRCoding;
  type: FHIRCodeableConcept[];
  subject: FHIRReference;
  participant: FHIRParticipant[];
  period: FHIRPeriod;
  location: FHIRLocation[];
}

export interface FHIRBundleLink {
  relation: string;
  url: string;
}

export interface FHIRBundleEntry {
  fullUrl: string;
  resource: FHIREncounter;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  id: string;
  meta: {
    lastUpdated: string;
  };
  type: 'searchset';
  total: number;
  link: FHIRBundleLink[];
  entry: FHIRBundleEntry[];
} 