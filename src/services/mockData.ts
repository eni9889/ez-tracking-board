import { Encounter } from '../types/api.types';

export const mockEncounters: Encounter[] = [
  {
    id: '1',
    patientName: 'John Smith',
    patientInfo: {
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1985-06-15',
      gender: 'MALE',
      medicalRecordNumber: 'JSM001',
      phoneNumber: '(555) 123-4567',
      emailAddress: 'john.smith@email.com'
    },
    appointmentTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    arrivalTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago
    chiefComplaint: 'Annual skin check',
    status: 'WITH_PROVIDER',
    room: 3,
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's1',
        name: 'Maria Garcia',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'General',
    appointmentColor: 'FFCA28',
    establishedPatient: true
  },
  {
    id: '2',
    patientName: 'Emily Davis',
    patientInfo: {
      firstName: 'Emily',
      lastName: 'Davis',
      dateOfBirth: '1992-03-22',
      gender: 'FEMALE',
      medicalRecordNumber: 'EDA002',
      phoneNumber: '(555) 987-6543',
      emailAddress: 'emily.davis@email.com'
    },
    appointmentTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    arrivalTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago - danger!
    chiefComplaint: 'Acne follow-up',
    status: 'CHECKED_IN',
    room: 'N/A',
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Follow-up',
    appointmentColor: '4CAF50',
    establishedPatient: true
  },
  {
    id: '3',
    patientName: 'Robert Wilson',
    patientInfo: {
      firstName: 'Robert',
      lastName: 'Wilson',
      dateOfBirth: '1978-11-08',
      gender: 'MALE',
      medicalRecordNumber: 'RWI003',
      phoneNumber: '(555) 456-7890'
    },
    appointmentTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now
    chiefComplaint: 'Mole removal consultation',
    status: 'CONFIRMED',
    room: 0,
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Consultation',
    appointmentColor: '2196F3',
    establishedPatient: false
  },
  {
    id: '4',
    patientName: 'Lisa Thompson',
    patientInfo: {
      firstName: 'Lisa',
      lastName: 'Thompson',
      dateOfBirth: '1967-09-14',
      gender: 'FEMALE',
      medicalRecordNumber: 'LTH004',
      phoneNumber: '(555) 321-9876',
      emailAddress: 'lisa.thompson@email.com'
    },
    appointmentTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
    arrivalTime: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 min ago - danger!
    chiefComplaint: 'Psoriasis treatment',
    status: 'WITH_STAFF',
    room: 7,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Amanda Rodriguez',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 'np1',
        name: 'Jennifer Kim',
        role: 'SECONDARY_PROVIDER',
        title: 'NP'
      },
      {
        id: 's2',
        name: 'David Brown',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Treatment',
    appointmentColor: 'FF9800',
    establishedPatient: true
  },
  {
    id: '5',
    patientName: 'Michael Park',
    patientInfo: {
      firstName: 'Michael',
      lastName: 'Park',
      dateOfBirth: '1995-01-30',
      gender: 'MALE',
      medicalRecordNumber: 'MPA005',
      phoneNumber: '(555) 654-3210'
    },
    appointmentTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
    arrivalTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    chiefComplaint: 'Eczema flare-up',
    status: 'IN_ROOM',
    room: 12,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's3',
        name: 'Sarah Wilson',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Urgent',
    appointmentColor: 'F44336',
    establishedPatient: true
  },
  {
    id: '6',
    patientName: 'Carol Martinez',
    patientInfo: {
      firstName: 'Carol',
      lastName: 'Martinez',
      dateOfBirth: '1951-07-19',
      gender: 'FEMALE',
      medicalRecordNumber: 'CMA006',
      phoneNumber: '(555) 789-0123',
      emailAddress: 'carol.martinez@email.com'
    },
    appointmentTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min from now
    chiefComplaint: 'Skin cancer screening',
    status: 'SCHEDULED',
    room: 'N/A',
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Screening',
    appointmentColor: '9C27B0',
    establishedPatient: true
  }
]; 