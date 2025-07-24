// API Authentication Types
export interface LoginRequest {
  username: string;
  password: string;
  application: string;
  timeZoneId: string;
  clientVersion: string;
}

export interface LoginResponse {
  servers: {
    app: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface UserInfo {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  practiceId: string;
  clinicIds: string[];
}

// Practice and Clinic Types
export interface ClinicInfo {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface PracticeInfo {
  id: string;
  name: string;
  clinics: ClinicInfo[];
}

// Patient Types
export interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  mrn?: string;
  phone?: string;
  email?: string;
}

// Appointment/Schedule Types
export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CHECKED_IN = 'CHECKED_IN',
  IN_ROOM = 'IN_ROOM',
  WITH_PROVIDER = 'WITH_PROVIDER',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  COMPLETED = 'COMPLETED'
}

export enum AppointmentType {
  OFFICE_VISIT = 'OFFICE_VISIT',
  TELEMEDICINE = 'TELEMEDICINE',
  HOSPITAL_VISIT = 'HOSPITAL_VISIT',
  PROCEDURE = 'PROCEDURE',
  FOLLOW_UP = 'FOLLOW_UP'
}

export interface ProviderInfo {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  specialty?: string;
}

export interface SchedulerData {
  id: string;
  dateModified: string;
  active: boolean;
  providerId: string;
  clinicId: string;
  dateOfService: string;
  duration: number;
  status: AppointmentStatus;
  type: AppointmentType;
  patientInfo: PatientInfo;
  clinicInfo: ClinicInfo;
  providerInfo?: ProviderInfo;
  roomNumber?: string;
  room?: number;
  checkInTime?: string;
  roomTime?: string;
  providerTime?: string;
  checkOutTime?: string;
  chiefComplaint?: string;
  notes?: string;
}

// Request Types
export interface SchedulerDataRequest {
  dateSelection: 'SPECIFY_RANGE';
  dateOfServiceRangeHigh: string;
  dateOfServiceRangeLow: string;
  clinicId: string;
  practiceId: string;
  providerIds: string[];
  lightBean: boolean;
}

// Encounter Types
export interface Encounter {
  id: string;
  patientId: string;
  providerId: string;
  dateOfService: string;
  status: 'SIGNED_OFF' | 'DRAFT' | 'IN_PROGRESS';
  chiefComplaint?: string;
}

export interface EncounterFilterRequest {
  dateSelection: 'SPECIFY_RANGE';
  lightBean: boolean;
  dateOfServiceRangeHigh: string;
  dateOfServiceRangeLow: string;
  clinicId: string;
  practiceId: string;
  providerIds: string[];
}

export interface EncounterRoleInfo {
  id: string;
  active: boolean;
  providerId: string;
  encounterId: string;
  encounterRoleType: 'PROVIDER' | 'STAFF' | 'SECONDARY_PROVIDER';
  firstName: string;
  lastName: string;
  title?: string;
  onlineCheckInEnabled: boolean;
  fullOnlineCheckInEnabled: boolean;
}

export interface AppointmentTypeInfo {
  id: string;
  active: boolean;
  name: string;
  color: string;
  practiceDefault: boolean;
  resourceScheduleOnly: boolean;
  cosmetic: boolean;
  resourceTypes: any[];
}

export interface EncounterDetail {
  id: string;
  active: boolean;
  virtualEncounter: boolean;
  dateOfService: string;
  dateOfArrival?: string;
  duration?: number;
  patientInfo: {
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    medicalRecordNumber: string;
    encounterMedicalProblemIds: string[];
    medicationIds: string[];
    datesOfService: string[];
    insuranceCompanies: any[];
    medicarePartB: boolean;
    alertCount: number;
    avatarS3Id?: string;
    mailValidAndVerified: boolean;
    phoneNumber?: string;
    emailAddress?: string;
  };
  encounterRoleInfoList: EncounterRoleInfo[];
  chiefComplaintName?: string;
  appointmentType?: AppointmentTypeInfo;
  status: 'SCHEDULED' | 'WITH_PROVIDER' | 'CHECKED_IN' | 'IN_ROOM' | 'COMPLETED' | 'CHECKED_OUT';
  clinicId: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  bridgeEncounter: boolean;
  room: number;
  codingReportAvailable: boolean;
  establishedPatient: boolean;
  eligibilityStatusValue?: string;
  resources: any[];
  objectiveLock: boolean;
  hasCustomSmsPermission: boolean;
  hasSmsEzlinkPermission: boolean;
} 