// Login types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  username: string;
  serverUrl: string;
}

// Patient and encounter types
export interface PatientInfo {
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
  status: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'ARRIVED' | 'IN_ROOM' | 'WITH_PROVIDER' | 'WITH_STAFF' | 'READY_FOR_STAFF' | 'PENDING_COSIGN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED' | 'MESSAGE_LEFT' | 'NO_ANSWERED';
  room: string | number;
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
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
} 