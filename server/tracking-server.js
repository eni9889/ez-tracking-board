const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/', limiter);

// Store tokens in memory (in production, use Redis or a database)
const tokenStore = new Map();

// EZDerm API endpoints
const EZDERM_LOGIN_URL = 'https://login.ezinfra.net/api/login';
const EZDERM_API_BASE = 'https://srvprod.ezinfra.net';

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Make request to EZDerm login API
    const loginResponse = await axios.post(EZDERM_LOGIN_URL, {
      username,
      password,
      application: 'EZDERM',
      timeZoneId: 'America/Detroit',
      clientVersion: '4.28.0'
    }, {
      headers: {
        'Host': 'login.ezinfra.net',
        'accept': 'application/json',
        'content-type': 'application/json',
        'user-agent': 'ezDerm/4.28.0 (com.ezderm.ezderm; build:132.19; macOS(Catalyst) 15.5.0) Alamofire/5.10.2',
        'accept-language': 'en-US;q=1.0'
      }
    });

    const { accessToken, refreshToken, servers } = loginResponse.data;

    // Store tokens with username as key
    tokenStore.set(username, {
      accessToken,
      refreshToken,
      serverUrl: servers.app,
      timestamp: Date.now()
    });

    // Return success response
    res.json({
      success: true,
      username,
      serverUrl: servers.app
    });

  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    res.status(401).json({ 
      error: 'Invalid credentials or login failed',
      details: error.response?.data?.message || error.message 
    });
  }
});

// Get encounters endpoint
app.post('/api/encounters', async (req, res) => {
  try {
    const { username, dateRangeStart, dateRangeEnd, clinicId, providerIds } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Get stored tokens
    const userTokens = tokenStore.get(username);
    if (!userTokens) {
      return res.status(401).json({ error: 'User not authenticated. Please login first.' });
    }

    // Check if token is expired (10 minutes)
    if (Date.now() - userTokens.timestamp > 600000) {
      tokenStore.delete(username);
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    // Format dates with timezone offset like in the curl example
    const formatDateWithOffset = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00-0400`;
    };

    // Get today's date for default range
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Prepare request data exactly like the curl command
    const encounterData = {
      dateOfServiceRangeHigh: dateRangeEnd || formatDateWithOffset(tomorrow),
      clinicId: clinicId || '44b62760-50a1-488c-92ed-e0c7aa3cde92',
      providerIds: providerIds || [],
      practiceId: '4cc96922-4d83-4183-863b-748d69de621f',
      dateOfServiceRangeLow: dateRangeStart || formatDateWithOffset(today),
      lightBean: true,
      dateSelection: 'SPECIFY_RANGE'
    };

    console.log('Sending request to EZDerm API:', encounterData);

    // Make request to EZDerm encounters API
    const encountersResponse = await axios.post(
      `${userTokens.serverUrl}ezderm-webservice/rest/encounter/getByFilter`,
      encounterData,
      {
        headers: {
          'Host': 'srvprod.ezinfra.net',
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': `Bearer ${userTokens.accessToken}`,
          'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
          'accept-language': 'en-US;q=1.0'
        }
      }
    );

    // Process and format the encounters data
    const allEncounters = encountersResponse.data.map(encounter => ({
      id: encounter.id,
      patientName: `${encounter.patientInfo.firstName} ${encounter.patientInfo.lastName}`,
      patientInfo: {
        firstName: encounter.patientInfo.firstName,
        lastName: encounter.patientInfo.lastName,
        dateOfBirth: encounter.patientInfo.dateOfBirth,
        gender: encounter.patientInfo.gender,
        medicalRecordNumber: encounter.patientInfo.medicalRecordNumber,
        phoneNumber: encounter.patientInfo.phoneNumber,
        emailAddress: encounter.patientInfo.emailAddress
      },
      appointmentTime: encounter.dateOfService,
      arrivalTime: encounter.dateOfArrival,
      chiefComplaint: encounter.chiefComplaintName,
      status: encounter.status,
      room: encounter.room || 'N/A',
      providers: encounter.encounterRoleInfoList.map(role => ({
        id: role.providerId,
        name: `${role.firstName} ${role.lastName}`,
        role: role.encounterRoleType,
        title: role.title || ''
      })),
      clinicName: encounter.clinicName,
      appointmentType: encounter.appointmentType.name,
      appointmentColor: encounter.appointmentType.color,
      establishedPatient: encounter.establishedPatient
    }));

    // Filter to only show patients currently in clinic (not checked out)
    const activeStatuses = ['CHECKED_IN', 'IN_ROOM', 'WITH_PROVIDER', 'WITH_STAFF', 'READY_FOR_STAFF'];
    const activeEncounters = allEncounters.filter(encounter => {
      console.log('encounter.status', encounter.status);
      return activeStatuses.includes(encounter.status);
    });

    // Sort by appointment time in ascending order
    const sortedEncounters = activeEncounters.sort((a, b) => {
      const timeA = new Date(a.appointmentTime).getTime();
      const timeB = new Date(b.appointmentTime).getTime();
      return timeA - timeB;
    });

    console.log(`Found ${sortedEncounters.length} active patients out of ${allEncounters.length} total`);

    res.json({ encounters: sortedEncounters });

  } catch (error) {
    console.error('Encounters error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      tokenStore.delete(username);
      return res.status(401).json({ error: 'Authentication failed. Please login again.' });
    }

    res.status(500).json({ 
      error: 'Failed to fetch encounters',
      details: error.response?.data?.message || error.message 
    });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  const { username } = req.body;
  if (username) {
    tokenStore.delete(username);
  }
  res.json({ success: true });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 