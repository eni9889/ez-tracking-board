import { Encounter } from '../types/api.types';

export const mockEncounters: Encounter[] = [
  {
    id: '1',
    patientName: 'John Smith',
    patientInfo: {
      id: 'patient-1',
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
      id: 'patient-2',
      firstName: 'Emily',
      lastName: 'Davis',
      dateOfBirth: '1992-03-22',
      gender: 'FEMALE',
      medicalRecordNumber: 'EDA002',
      phoneNumber: '(555) 987-6543',
      emailAddress: 'emily.davis@email.com'
    },
    appointmentTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    arrivalTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
    chiefComplaint: 'Acne consultation',
    status: 'READY_FOR_STAFF',
    room: 1,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Consultation',
    appointmentColor: '4CAF50',
    establishedPatient: false
  },
  {
    id: '3',
    patientName: 'Robert Wilson',
    patientInfo: {
      id: 'patient-3',
      firstName: 'Robert',
      lastName: 'Wilson',
      dateOfBirth: '1978-11-08',
      gender: 'MALE',
      medicalRecordNumber: 'RWI003',
      phoneNumber: '(555) 555-0123'
    },
    appointmentTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
    arrivalTime: undefined,
    chiefComplaint: 'Mole check',
    status: 'SCHEDULED',
    room: 'TBD',
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'General',
    appointmentColor: 'FF9800',
    establishedPatient: true
  },
  {
    id: '4',
    patientName: 'Lisa Thompson',
    patientInfo: {
      id: 'patient-4',
      firstName: 'Lisa',
      lastName: 'Thompson',
      dateOfBirth: '1967-09-14',
      gender: 'FEMALE',
      medicalRecordNumber: 'LTH004',
      phoneNumber: '(555) 321-7890',
      emailAddress: 'lisa.thompson@email.com'
    },
    appointmentTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    arrivalTime: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(), // 2.5 hours ago
    chiefComplaint: 'Psoriasis follow-up',
    status: 'ENCOUNTER_COMPLETED',
    room: 2,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's2',
        name: 'Robert Kim',
        role: 'STAFF',
        title: 'PA'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Follow-up',
    appointmentColor: '9C27B0',
    establishedPatient: true
  },
  {
    id: '5',
    patientName: 'Michael Park',
    patientInfo: {
      id: 'patient-5',
      firstName: 'Michael',
      lastName: 'Park',
      dateOfBirth: '1995-01-30',
      gender: 'MALE',
      medicalRecordNumber: 'MPA005',
      phoneNumber: '(555) 654-3210'
    },
    appointmentTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour from now
    arrivalTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago (early arrival)
    chiefComplaint: 'Eczema treatment',
    status: 'CHECKED_IN',
    room: undefined,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Treatment',
    appointmentColor: '2196F3',
    establishedPatient: true
  },
  {
    id: '6',
    patientName: 'Carol Martinez',
    patientInfo: {
      id: 'patient-6',
      firstName: 'Carol',
      lastName: 'Martinez',
      dateOfBirth: '1951-07-19',
      gender: 'FEMALE',
      medicalRecordNumber: 'CMA006',
      phoneNumber: '(555) 876-5432',
      emailAddress: 'carol.martinez@email.com'
    },
    appointmentTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    arrivalTime: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago
    chiefComplaint: 'Skin cancer screening',
    status: 'WITH_STAFF',
    room: 4,
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
    appointmentType: 'Screening',
    appointmentColor: 'F44336',
    establishedPatient: true
  },
  {
    id: '7',
    patientName: 'David Anderson',
    patientInfo: {
      id: 'patient-7',
      firstName: 'David',
      lastName: 'Anderson',
      dateOfBirth: '1972-04-12',
      gender: 'MALE',
      medicalRecordNumber: 'DAN007',
      phoneNumber: '(555) 234-5678'
    },
    appointmentTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Dermatitis consultation',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Consultation',
    appointmentColor: 'FF5722',
    establishedPatient: false
  },
  {
    id: '8',
    patientName: 'Jennifer Brown',
    patientInfo: {
      id: 'patient-8',
      firstName: 'Jennifer',
      lastName: 'Brown',
      dateOfBirth: '1988-09-03',
      gender: 'FEMALE',
      medicalRecordNumber: 'JBR008',
      phoneNumber: '(555) 345-6789',
      emailAddress: 'jennifer.brown@email.com'
    },
    appointmentTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    arrivalTime: new Date(Date.now() - 4.5 * 60 * 60 * 1000).toISOString(), // 4.5 hours ago (early arrival)
    chiefComplaint: 'Rash examination',
    status: 'ENCOUNTER_COMPLETED',
    room: 5,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's3',
        name: 'Angela Davis',
        role: 'STAFF',
        title: 'NP'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Urgent',
    appointmentColor: 'FF9800',
    establishedPatient: true
  },
  {
    id: '9',
    patientName: 'Thomas Lee',
    patientInfo: {
      id: 'patient-9',
      firstName: 'Thomas',
      lastName: 'Lee',
      dateOfBirth: '1961-12-25',
      gender: 'MALE',
      medicalRecordNumber: 'TLE009',
      phoneNumber: '(555) 456-7890'
    },
    appointmentTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
    arrivalTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago (early arrival)
    chiefComplaint: 'Seborrheic keratosis removal',
    status: 'READY_FOR_STAFF',
    room: 3,
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Procedure',
    appointmentColor: '795548',
    establishedPatient: true
  },
  {
    id: '10',
    patientName: 'Patricia White',
    patientInfo: {
      id: 'patient-10',
      firstName: 'Patricia',
      lastName: 'White',
      dateOfBirth: '1954-08-17',
      gender: 'FEMALE',
      medicalRecordNumber: 'PWH010',
      phoneNumber: '(555) 567-8901',
      emailAddress: 'patricia.white@email.com'
    },
    appointmentTime: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    arrivalTime: new Date(Date.now() - 5.25 * 60 * 60 * 1000).toISOString(), // 5.25 hours ago
    chiefComplaint: 'Melanoma follow-up',
    status: 'ENCOUNTER_COMPLETED',
    room: 1,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's2',
        name: 'Robert Kim',
        role: 'STAFF',
        title: 'PA'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Follow-up',
    appointmentColor: '607D8B',
    establishedPatient: true
  },
  {
    id: '11',
    patientName: 'Christopher Taylor',
    patientInfo: {
      id: 'patient-11',
      firstName: 'Christopher',
      lastName: 'Taylor',
      dateOfBirth: '1999-02-14',
      gender: 'MALE',
      medicalRecordNumber: 'CTA011',
      phoneNumber: '(555) 678-9012'
    },
    appointmentTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 minutes from now
    arrivalTime: undefined,
    chiefComplaint: 'Acne consultation',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Consultation',
    appointmentColor: '4CAF50',
    establishedPatient: false
  },
  {
    id: '12',
    patientName: 'Mary Johnson',
    patientInfo: {
      id: 'patient-12',
      firstName: 'Mary',
      lastName: 'Johnson',
      dateOfBirth: '1976-05-20',
      gender: 'FEMALE',
      medicalRecordNumber: 'MJO012',
      phoneNumber: '(555) 789-0123',
      emailAddress: 'mary.johnson@email.com'
    },
    appointmentTime: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 1.5 hours ago
    arrivalTime: new Date(Date.now() - 75 * 60 * 1000).toISOString(), // 1.25 hours ago
    chiefComplaint: 'Wart removal',
    status: 'WITH_PROVIDER',
    room: 2,
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Procedure',
    appointmentColor: 'E91E63',
    establishedPatient: true
  },
  {
    id: '13',
    patientName: 'Daniel Garcia',
    patientInfo: {
      id: 'patient-13',
      firstName: 'Daniel',
      lastName: 'Garcia',
      dateOfBirth: '1983-11-02',
      gender: 'MALE',
      medicalRecordNumber: 'DGA013',
      phoneNumber: '(555) 890-1234'
    },
    appointmentTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Shingles treatment',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Treatment',
    appointmentColor: '3F51B5',
    establishedPatient: true
  },
  {
    id: '14',
    patientName: 'Sarah Miller',
    patientInfo: {
      id: 'patient-14',
      firstName: 'Sarah',
      lastName: 'Miller',
      dateOfBirth: '1990-07-08',
      gender: 'FEMALE',
      medicalRecordNumber: 'SMI014',
      phoneNumber: '(555) 901-2345',
      emailAddress: 'sarah.miller@email.com'
    },
    appointmentTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 1.5 hours from now
    arrivalTime: new Date().toISOString(), // just arrived
    chiefComplaint: 'Cosmetic consultation',
    status: 'CHECKED_IN',
    room: undefined,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's3',
        name: 'Angela Davis',
        role: 'STAFF',
        title: 'NP'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Cosmetic',
    appointmentColor: 'FF4081',
    establishedPatient: false
  },
  {
    id: '15',
    patientName: 'Matthew Davis',
    patientInfo: {
      id: 'patient-15',
      firstName: 'Matthew',
      lastName: 'Davis',
      dateOfBirth: '1968-01-15',
      gender: 'MALE',
      medicalRecordNumber: 'MDA015',
      phoneNumber: '(555) 012-3456'
    },
    appointmentTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    arrivalTime: new Date(Date.now() - 6.5 * 60 * 60 * 1000).toISOString(), // 6.5 hours ago
    chiefComplaint: 'Basal cell carcinoma removal',
    status: 'ENCOUNTER_COMPLETED',
    room: 4,
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
    appointmentType: 'Surgery',
    appointmentColor: '9E9E9E',
    establishedPatient: true
  },
  {
    id: '16',
    patientName: 'Nancy Rodriguez',
    patientInfo: {
      id: 'patient-16',
      firstName: 'Nancy',
      lastName: 'Rodriguez',
      dateOfBirth: '1956-10-30',
      gender: 'FEMALE',
      medicalRecordNumber: 'NRO016',
      phoneNumber: '(555) 123-4567',
      emailAddress: 'nancy.rodriguez@email.com'
    },
    appointmentTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Age spot treatment',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Cosmetic',
    appointmentColor: 'CDDC39',
    establishedPatient: true
  },
  {
    id: '17',
    patientName: 'Mark Wilson',
    patientInfo: {
      id: 'patient-17',
      firstName: 'Mark',
      lastName: 'Wilson',
      dateOfBirth: '1991-03-18',
      gender: 'MALE',
      medicalRecordNumber: 'MWI017',
      phoneNumber: '(555) 234-5678'
    },
    appointmentTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    arrivalTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    chiefComplaint: 'Allergic reaction',
    status: 'WITH_STAFF',
    room: 5,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's2',
        name: 'Robert Kim',
        role: 'STAFF',
        title: 'PA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Urgent',
    appointmentColor: 'FF5722',
    establishedPatient: true
  },
  {
    id: '18',
    patientName: 'Betty Moore',
    patientInfo: {
      id: 'patient-18',
      firstName: 'Betty',
      lastName: 'Moore',
      dateOfBirth: '1948-06-12',
      gender: 'FEMALE',
      medicalRecordNumber: 'BMO018',
      phoneNumber: '(555) 345-6789',
      emailAddress: 'betty.moore@email.com'
    },
    appointmentTime: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), // 7 hours ago
    arrivalTime: new Date(Date.now() - 7.25 * 60 * 60 * 1000).toISOString(), // 7.25 hours ago
    chiefComplaint: 'Squamous cell carcinoma follow-up',
    status: 'ENCOUNTER_COMPLETED',
    room: 3,
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Follow-up',
    appointmentColor: '795548',
    establishedPatient: true
  },
  {
    id: '19',
    patientName: 'Kevin Taylor',
    patientInfo: {
      id: 'patient-19',
      firstName: 'Kevin',
      lastName: 'Taylor',
      dateOfBirth: '1987-12-05',
      gender: 'MALE',
      medicalRecordNumber: 'KTA019',
      phoneNumber: '(555) 456-7890'
    },
    appointmentTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Hidradenitis suppurativa treatment',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Treatment',
    appointmentColor: '9C27B0',
    establishedPatient: true
  },
  {
    id: '20',
    patientName: 'Helen Anderson',
    patientInfo: {
      id: 'patient-20',
      firstName: 'Helen',
      lastName: 'Anderson',
      dateOfBirth: '1979-04-22',
      gender: 'FEMALE',
      medicalRecordNumber: 'HAN020',
      phoneNumber: '(555) 567-8901',
      emailAddress: 'helen.anderson@email.com'
    },
    appointmentTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Vitiligo consultation',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Consultation',
    appointmentColor: '00BCD4',
    establishedPatient: false
  },
  {
    id: '21',
    patientName: 'Steven Clark',
    patientInfo: {
      id: 'patient-21',
      firstName: 'Steven',
      lastName: 'Clark',
      dateOfBirth: '1965-09-11',
      gender: 'MALE',
      medicalRecordNumber: 'SCL021',
      phoneNumber: '(555) 678-9012'
    },
    appointmentTime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
    arrivalTime: new Date(Date.now() - 8.5 * 60 * 60 * 1000).toISOString(), // 8.5 hours ago
    chiefComplaint: 'Atopic dermatitis management',
    status: 'ENCOUNTER_COMPLETED',
    room: 1,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Management',
    appointmentColor: '8BC34A',
    establishedPatient: true
  },
  {
    id: '22',
    patientName: 'Dorothy Lewis',
    patientInfo: {
      id: 'patient-22',
      firstName: 'Dorothy',
      lastName: 'Lewis',
      dateOfBirth: '1952-11-28',
      gender: 'FEMALE',
      medicalRecordNumber: 'DLE022',
      phoneNumber: '(555) 789-0123',
      emailAddress: 'dorothy.lewis@email.com'
    },
    appointmentTime: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(), // 7 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Rosacea treatment',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Treatment',
    appointmentColor: 'FF7043',
    establishedPatient: true
  },
  {
    id: '23',
    patientName: 'Edward Walker',
    patientInfo: {
      id: 'patient-23',
      firstName: 'Edward',
      lastName: 'Walker',
      dateOfBirth: '1993-01-07',
      gender: 'MALE',
      medicalRecordNumber: 'EWA023',
      phoneNumber: '(555) 890-1234'
    },
    appointmentTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Hair loss consultation',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Consultation',
    appointmentColor: '607D8B',
    establishedPatient: false
  },
  {
    id: '24',
    patientName: 'Sandra Hall',
    patientInfo: {
      id: 'patient-24',
      firstName: 'Sandra',
      lastName: 'Hall',
      dateOfBirth: '1971-08-16',
      gender: 'FEMALE',
      medicalRecordNumber: 'SHA024',
      phoneNumber: '(555) 901-2345',
      emailAddress: 'sandra.hall@email.com'
    },
    appointmentTime: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(), // 9 hours ago
    arrivalTime: new Date(Date.now() - 9.25 * 60 * 60 * 1000).toISOString(), // 9.25 hours ago
    chiefComplaint: 'Nail disorder treatment',
    status: 'ENCOUNTER_COMPLETED',
    room: 2,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Treatment',
    appointmentColor: 'FFC107',
    establishedPatient: true
  },
  {
    id: '25',
    patientName: 'Joseph Allen',
    patientInfo: {
      id: 'patient-25',
      firstName: 'Joseph',
      lastName: 'Allen',
      dateOfBirth: '1960-05-03',
      gender: 'MALE',
      medicalRecordNumber: 'JAL025',
      phoneNumber: '(555) 012-3456'
    },
    appointmentTime: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(), // 9 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Keratosis pilaris consultation',
    status: 'NOT_ARRIVED',
    room: undefined,
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
    appointmentColor: 'E91E63',
    establishedPatient: true
  },
  {
    id: '26',
    patientName: 'Lisa Young',
    patientInfo: {
      id: 'patient-26',
      firstName: 'Lisa',
      lastName: 'Young',
      dateOfBirth: '1985-02-19',
      gender: 'FEMALE',
      medicalRecordNumber: 'LYO026',
      phoneNumber: '(555) 123-4567',
      emailAddress: 'lisa.young@email.com'
    },
    appointmentTime: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(), // 10 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Laser hair removal',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Cosmetic',
    appointmentColor: 'FF4081',
    establishedPatient: true
  },
  {
    id: '27',
    patientName: 'Paul King',
    patientInfo: {
      id: 'patient-27',
      firstName: 'Paul',
      lastName: 'King',
      dateOfBirth: '1974-12-01',
      gender: 'MALE',
      medicalRecordNumber: 'PKI027',
      phoneNumber: '(555) 234-5678'
    },
    appointmentTime: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago
    arrivalTime: new Date(Date.now() - 10.5 * 60 * 60 * 1000).toISOString(), // 10.5 hours ago
    chiefComplaint: 'Contact dermatitis follow-up',
    status: 'ENCOUNTER_COMPLETED',
    room: 4,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Follow-up',
    appointmentColor: '4CAF50',
    establishedPatient: true
  },
  {
    id: '28',
    patientName: 'Karen Wright',
    patientInfo: {
      id: 'patient-28',
      firstName: 'Karen',
      lastName: 'Wright',
      dateOfBirth: '1958-07-26',
      gender: 'FEMALE',
      medicalRecordNumber: 'KWR028',
      phoneNumber: '(555) 345-6789',
      emailAddress: 'karen.wright@email.com'
    },
    appointmentTime: new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString(), // 11 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Skin tag removal',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Procedure',
    appointmentColor: '795548',
    establishedPatient: true
  },
  {
    id: '29',
    patientName: 'George Lopez',
    patientInfo: {
      id: 'patient-29',
      firstName: 'George',
      lastName: 'Lopez',
      dateOfBirth: '1996-10-14',
      gender: 'MALE',
      medicalRecordNumber: 'GLO029',
      phoneNumber: '(555) 456-7890'
    },
    appointmentTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours from now
    arrivalTime: undefined,
    chiefComplaint: 'Fungal infection treatment',
    status: 'NOT_ARRIVED',
    room: undefined,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Treatment',
    appointmentColor: '9C27B0',
    establishedPatient: true
  },
  {
    id: '30',
    patientName: 'Ruth Green',
    patientInfo: {
      id: 'patient-30',
      firstName: 'Ruth',
      lastName: 'Green',
      dateOfBirth: '1944-03-09',
      gender: 'FEMALE',
      medicalRecordNumber: 'RGR030',
      phoneNumber: '(555) 567-8901',
      emailAddress: 'ruth.green@email.com'
    },
    appointmentTime: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(), // 11 hours ago
    arrivalTime: new Date(Date.now() - 11.75 * 60 * 60 * 1000).toISOString(), // 11.75 hours ago
    chiefComplaint: 'Age-related skin changes consultation',
    status: 'ENCOUNTER_COMPLETED',
    room: 5,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Jennifer Martinez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Specialty Dermatology Center',
    appointmentType: 'Consultation',
    appointmentColor: 'CDDC39',
    establishedPatient: true
  }
]; 