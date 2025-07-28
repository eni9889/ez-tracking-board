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
  },
  {
    id: '7',
    patientName: 'David Anderson',
    patientInfo: {
      firstName: 'David',
      lastName: 'Anderson',
      dateOfBirth: '1972-04-12',
      gender: 'MALE',
      medicalRecordNumber: 'DAN007',
      phoneNumber: '(555) 234-5678'
    },
    appointmentTime: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 1.5 hours ago
    arrivalTime: new Date(Date.now() - 70 * 60 * 1000).toISOString(), // 70 min ago - danger!
    chiefComplaint: 'Suspicious mole on back',
    status: 'CHECKED_IN',
    room: 1,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Amanda Rodriguez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Urgent',
    appointmentColor: 'F44336',
    establishedPatient: true
  },
  {
    id: '8',
    patientName: 'Jennifer Brown',
    patientInfo: {
      firstName: 'Jennifer',
      lastName: 'Brown',
      dateOfBirth: '1988-09-03',
      gender: 'FEMALE',
      medicalRecordNumber: 'JBR008',
      phoneNumber: '(555) 345-6789',
      emailAddress: 'jennifer.brown@email.com'
    },
    appointmentTime: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min ago
    arrivalTime: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 min ago
    chiefComplaint: 'Rash on arms and legs',
    status: 'WITH_PROVIDER',
    room: 5,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's4',
        name: 'Lisa Chang',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'General',
    appointmentColor: 'FFCA28',
    establishedPatient: false
  },
  {
    id: '9',
    patientName: 'Thomas Lee',
    patientInfo: {
      firstName: 'Thomas',
      lastName: 'Lee',
      dateOfBirth: '1961-12-25',
      gender: 'MALE',
      medicalRecordNumber: 'TLE009',
      phoneNumber: '(555) 456-7891'
    },
    appointmentTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 min from now
    chiefComplaint: 'Basal cell carcinoma follow-up',
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
    appointmentType: 'Follow-up',
    appointmentColor: '4CAF50',
    establishedPatient: true
  },
  {
    id: '10',
    patientName: 'Patricia White',
    patientInfo: {
      firstName: 'Patricia',
      lastName: 'White',
      dateOfBirth: '1954-08-17',
      gender: 'FEMALE',
      medicalRecordNumber: 'PWH010',
      phoneNumber: '(555) 567-8912',
      emailAddress: 'patricia.white@email.com'
    },
    appointmentTime: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 min ago
    arrivalTime: new Date(Date.now() - 18 * 60 * 1000).toISOString(), // 18 min ago - danger!
    chiefComplaint: 'Melanoma screening high-risk patient',
    status: 'WITH_STAFF',
    room: 9,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Amanda Rodriguez',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's5',
        name: 'Kevin Martinez',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Screening',
    appointmentColor: '9C27B0',
    establishedPatient: true
  },
  {
    id: '11',
    patientName: 'Christopher Taylor',
    patientInfo: {
      firstName: 'Christopher',
      lastName: 'Taylor',
      dateOfBirth: '1999-02-14',
      gender: 'MALE',
      medicalRecordNumber: 'CTA011',
      phoneNumber: '(555) 678-9123'
    },
    appointmentTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
    arrivalTime: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3 min ago
    chiefComplaint: 'Severe acne treatment consultation',
    status: 'IN_ROOM',
    room: 2,
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
    appointmentColor: '2196F3',
    establishedPatient: false
  },
  {
    id: '12',
    patientName: 'Mary Johnson',
    patientInfo: {
      firstName: 'Mary',
      lastName: 'Johnson',
      dateOfBirth: '1976-05-20',
      gender: 'FEMALE',
      medicalRecordNumber: 'MJO012',
      phoneNumber: '(555) 789-0134',
      emailAddress: 'mary.johnson@email.com'
    },
    appointmentTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min from now
    chiefComplaint: 'Wart removal on hands',
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
    appointmentType: 'Procedure',
    appointmentColor: 'FF5722',
    establishedPatient: true
  },
  {
    id: '13',
    patientName: 'Daniel Garcia',
    patientInfo: {
      firstName: 'Daniel',
      lastName: 'Garcia',
      dateOfBirth: '1983-11-02',
      gender: 'MALE',
      medicalRecordNumber: 'DGA013',
      phoneNumber: '(555) 890-1245'
    },
    appointmentTime: new Date(Date.now() - 55 * 60 * 1000).toISOString(), // 55 min ago
    arrivalTime: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // 40 min ago - danger!
    chiefComplaint: 'Hidradenitis suppurativa flare',
    status: 'CHECKED_IN',
    room: 4,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Amanda Rodriguez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Urgent',
    appointmentColor: 'F44336',
    establishedPatient: true
  },
  {
    id: '14',
    patientName: 'Sarah Miller',
    patientInfo: {
      firstName: 'Sarah',
      lastName: 'Miller',
      dateOfBirth: '1990-07-08',
      gender: 'FEMALE',
      medicalRecordNumber: 'SMI014',
      phoneNumber: '(555) 901-2356',
      emailAddress: 'sarah.miller@email.com'
    },
    appointmentTime: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 min ago
    arrivalTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 min ago - danger!
    chiefComplaint: 'Contact dermatitis evaluation',
    status: 'WITH_STAFF',
    room: 8,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's6',
        name: 'Rachel Kim',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'General',
    appointmentColor: 'FFCA28',
    establishedPatient: false
  },
  {
    id: '15',
    patientName: 'Matthew Davis',
    patientInfo: {
      firstName: 'Matthew',
      lastName: 'Davis',
      dateOfBirth: '1968-01-15',
      gender: 'MALE',
      medicalRecordNumber: 'MDA015',
      phoneNumber: '(555) 012-3467'
    },
    appointmentTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    chiefComplaint: 'Skin biopsy results discussion',
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
    appointmentType: 'Follow-up',
    appointmentColor: '4CAF50',
    establishedPatient: true
  },
  {
    id: '16',
    patientName: 'Nancy Rodriguez',
    patientInfo: {
      firstName: 'Nancy',
      lastName: 'Rodriguez',
      dateOfBirth: '1956-10-30',
      gender: 'FEMALE',
      medicalRecordNumber: 'NRO016',
      phoneNumber: '(555) 123-4578',
      emailAddress: 'nancy.rodriguez@email.com'
    },
    appointmentTime: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // 40 min ago
    arrivalTime: new Date(Date.now() - 22 * 60 * 1000).toISOString(), // 22 min ago - danger!
    chiefComplaint: 'Age spots laser treatment consultation',
    status: 'CHECKED_IN',
    room: 6,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Amanda Rodriguez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Consultation',
    appointmentColor: '2196F3',
    establishedPatient: true
  },
  {
    id: '17',
    patientName: 'Mark Wilson',
    patientInfo: {
      firstName: 'Mark',
      lastName: 'Wilson',
      dateOfBirth: '1991-03-18',
      gender: 'MALE',
      medicalRecordNumber: 'MWI017',
      phoneNumber: '(555) 234-5689'
    },
    appointmentTime: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 min ago
    arrivalTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
    chiefComplaint: 'Athlete\'s foot resistant to treatment',
    status: 'IN_ROOM',
    room: 10,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's7',
        name: 'Amanda Torres',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Follow-up',
    appointmentColor: '4CAF50',
    establishedPatient: true
  },
  {
    id: '18',
    patientName: 'Betty Moore',
    patientInfo: {
      firstName: 'Betty',
      lastName: 'Moore',
      dateOfBirth: '1948-06-12',
      gender: 'FEMALE',
      medicalRecordNumber: 'BMO018',
      phoneNumber: '(555) 345-6790',
      emailAddress: 'betty.moore@email.com'
    },
    appointmentTime: new Date(Date.now() + 25 * 60 * 1000).toISOString(), // 25 min from now
    chiefComplaint: 'Squamous cell carcinoma check-up',
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
    appointmentType: 'Follow-up',
    appointmentColor: '4CAF50',
    establishedPatient: true
  },
  {
    id: '19',
    patientName: 'Kevin Taylor',
    patientInfo: {
      firstName: 'Kevin',
      lastName: 'Taylor',
      dateOfBirth: '1987-12-05',
      gender: 'MALE',
      medicalRecordNumber: 'KTA019',
      phoneNumber: '(555) 456-7892'
    },
    appointmentTime: new Date(Date.now() - 65 * 60 * 1000).toISOString(), // 65 min ago
    arrivalTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago - danger!
    chiefComplaint: 'Seborrheic keratosis removal',
    status: 'WITH_STAFF',
    room: 11,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Amanda Rodriguez',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's8',
        name: 'Michael Johnson',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Procedure',
    appointmentColor: 'FF5722',
    establishedPatient: true
  },
  {
    id: '20',
    patientName: 'Helen Anderson',
    patientInfo: {
      firstName: 'Helen',
      lastName: 'Anderson',
      dateOfBirth: '1979-04-22',
      gender: 'FEMALE',
      medicalRecordNumber: 'HAN020',
      phoneNumber: '(555) 567-8913',
      emailAddress: 'helen.anderson@email.com'
    },
    appointmentTime: new Date(Date.now() - 18 * 60 * 1000).toISOString(), // 18 min ago
    arrivalTime: new Date(Date.now() - 6 * 60 * 1000).toISOString(), // 6 min ago
    chiefComplaint: 'Vitiligo treatment follow-up',
    status: 'WITH_PROVIDER',
    room: 13,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 'np2',
        name: 'Susan Davis',
        role: 'SECONDARY_PROVIDER',
        title: 'NP'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Follow-up',
    appointmentColor: '4CAF50',
    establishedPatient: true
  },
  {
    id: '21',
    patientName: 'Steven Clark',
    patientInfo: {
      firstName: 'Steven',
      lastName: 'Clark',
      dateOfBirth: '1965-09-11',
      gender: 'MALE',
      medicalRecordNumber: 'SCL021',
      phoneNumber: '(555) 678-9124'
    },
    appointmentTime: new Date(Date.now() + 40 * 60 * 1000).toISOString(), // 40 min from now
    chiefComplaint: 'Cryotherapy for actinic keratosis',
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
    appointmentType: 'Procedure',
    appointmentColor: 'FF5722',
    establishedPatient: true
  },
  {
    id: '22',
    patientName: 'Dorothy Lewis',
    patientInfo: {
      firstName: 'Dorothy',
      lastName: 'Lewis',
      dateOfBirth: '1952-11-28',
      gender: 'FEMALE',
      medicalRecordNumber: 'DLE022',
      phoneNumber: '(555) 789-0135',
      emailAddress: 'dorothy.lewis@email.com'
    },
    appointmentTime: new Date(Date.now() - 50 * 60 * 1000).toISOString(), // 50 min ago
    arrivalTime: new Date(Date.now() - 32 * 60 * 1000).toISOString(), // 32 min ago - danger!
    chiefComplaint: 'Rosacea flare management',
    status: 'CHECKED_IN',
    room: 3,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Amanda Rodriguez',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Treatment',
    appointmentColor: 'FF9800',
    establishedPatient: true
  },
  {
    id: '23',
    patientName: 'Edward Walker',
    patientInfo: {
      firstName: 'Edward',
      lastName: 'Walker',
      dateOfBirth: '1993-01-07',
      gender: 'MALE',
      medicalRecordNumber: 'EWA023',
      phoneNumber: '(555) 890-1246'
    },
    appointmentTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 min ago
    arrivalTime: new Date(Date.now() - 4 * 60 * 1000).toISOString(), // 4 min ago
    chiefComplaint: 'Ingrown hair infection treatment',
    status: 'IN_ROOM',
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
    appointmentType: 'Treatment',
    appointmentColor: 'FF9800',
    establishedPatient: false
  },
  {
    id: '24',
    patientName: 'Sandra Hall',
    patientInfo: {
      firstName: 'Sandra',
      lastName: 'Hall',
      dateOfBirth: '1971-08-16',
      gender: 'FEMALE',
      medicalRecordNumber: 'SHA024',
      phoneNumber: '(555) 901-2357',
      emailAddress: 'sandra.hall@email.com'
    },
    appointmentTime: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 min from now
    chiefComplaint: 'Melasma laser treatment consultation',
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
    appointmentType: 'Consultation',
    appointmentColor: '2196F3',
    establishedPatient: true
  },
  {
    id: '25',
    patientName: 'Joseph Allen',
    patientInfo: {
      firstName: 'Joseph',
      lastName: 'Allen',
      dateOfBirth: '1960-05-03',
      gender: 'MALE',
      medicalRecordNumber: 'JAL025',
      phoneNumber: '(555) 012-3468'
    },
    appointmentTime: new Date(Date.now() - 75 * 60 * 1000).toISOString(), // 75 min ago
    arrivalTime: new Date(Date.now() - 55 * 60 * 1000).toISOString(), // 55 min ago - danger!
    chiefComplaint: 'Skin cancer screening annual',
    status: 'WITH_STAFF',
    room: 5,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Amanda Rodriguez',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's9',
        name: 'Jennifer Lopez',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Screening',
    appointmentColor: '9C27B0',
    establishedPatient: true
  },
  {
    id: '26',
    patientName: 'Lisa Young',
    patientInfo: {
      firstName: 'Lisa',
      lastName: 'Young',
      dateOfBirth: '1985-02-19',
      gender: 'FEMALE',
      medicalRecordNumber: 'LYO026',
      phoneNumber: '(555) 123-4579',
      emailAddress: 'lisa.young@email.com'
    },
    appointmentTime: new Date(Date.now() - 28 * 60 * 1000).toISOString(), // 28 min ago
    arrivalTime: new Date(Date.now() - 14 * 60 * 1000).toISOString(), // 14 min ago - danger!
    chiefComplaint: 'Chronic urticaria evaluation',
    status: 'CHECKED_IN',
    room: 7,
    providers: [
      {
        id: 'p2',
        name: 'Dr. Michael Chen',
        role: 'PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'General',
    appointmentColor: 'FFCA28',
    establishedPatient: false
  },
  {
    id: '27',
    patientName: 'Paul King',
    patientInfo: {
      firstName: 'Paul',
      lastName: 'King',
      dateOfBirth: '1974-12-01',
      gender: 'MALE',
      medicalRecordNumber: 'PKI027',
      phoneNumber: '(555) 234-5680'
    },
    appointmentTime: new Date(Date.now() + 50 * 60 * 1000).toISOString(), // 50 min from now
    chiefComplaint: 'Nail fungus treatment options',
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
    establishedPatient: true
  },
  {
    id: '28',
    patientName: 'Karen Wright',
    patientInfo: {
      firstName: 'Karen',
      lastName: 'Wright',
      dateOfBirth: '1958-07-26',
      gender: 'FEMALE',
      medicalRecordNumber: 'KWR028',
      phoneNumber: '(555) 345-6791',
      emailAddress: 'karen.wright@email.com'
    },
    appointmentTime: new Date(Date.now() - 85 * 60 * 1000).toISOString(), // 85 min ago
    arrivalTime: new Date(Date.now() - 65 * 60 * 1000).toISOString(), // 65 min ago - danger!
    chiefComplaint: 'Shingles post-herpetic neuralgia',
    status: 'WITH_STAFF',
    room: 9,
    providers: [
      {
        id: 'p3',
        name: 'Dr. Amanda Rodriguez',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 's10',
        name: 'Carlos Rivera',
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
    id: '29',
    patientName: 'George Lopez',
    patientInfo: {
      firstName: 'George',
      lastName: 'Lopez',
      dateOfBirth: '1996-10-14',
      gender: 'MALE',
      medicalRecordNumber: 'GLO029',
      phoneNumber: '(555) 456-7893'
    },
    appointmentTime: new Date(Date.now() - 6 * 60 * 1000).toISOString(), // 6 min ago
    arrivalTime: new Date(Date.now() - 1 * 60 * 1000).toISOString(), // 1 min ago
    chiefComplaint: 'Keloid scar treatment consultation',
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
        id: 's11',
        name: 'Nicole Thompson',
        role: 'STAFF',
        title: 'MA'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Consultation',
    appointmentColor: '2196F3',
    establishedPatient: false
  },
  {
    id: '30',
    patientName: 'Ruth Green',
    patientInfo: {
      firstName: 'Ruth',
      lastName: 'Green',
      dateOfBirth: '1944-03-09',
      gender: 'FEMALE',
      medicalRecordNumber: 'RGR030',
      phoneNumber: '(555) 567-8914',
      emailAddress: 'ruth.green@email.com'
    },
    appointmentTime: new Date(Date.now() + 35 * 60 * 1000).toISOString(), // 35 min from now
    chiefComplaint: 'Pre-operative consultation for Mohs surgery',
    status: 'SCHEDULED',
    room: 'N/A',
    providers: [
      {
        id: 'p1',
        name: 'Dr. Sarah Johnson',
        role: 'PROVIDER',
        title: 'MD'
      },
      {
        id: 'mohs1',
        name: 'Dr. Robert Stevens',
        role: 'COSIGNING_PROVIDER',
        title: 'MD'
      }
    ],
    clinicName: 'Main Dermatology Clinic',
    appointmentType: 'Procedure',
    appointmentColor: 'FF5722',
    establishedPatient: true
  }
]; 