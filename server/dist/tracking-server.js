"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = require("dotenv");
const database_1 = require("./database");
const vitalSignsService_1 = require("./vitalSignsService");
// Load environment variables
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '5001', 10);
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' }
});
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/', limiter);
// Store tokens in memory (in production, use Redis or a database)
const tokenStore = new Map();
// EZDerm API endpoints
const EZDERM_LOGIN_URL = 'https://login.ezinfra.net/api/login';
const EZDERM_API_BASE = 'https://srvprod.ezinfra.net';
// Constants
const TOKEN_EXPIRY_MS = 600000; // 10 minutes
const DEFAULT_CLINIC_ID = '44b62760-50a1-488c-92ed-e0c7aa3cde92';
const DEFAULT_PRACTICE_ID = '4cc96922-4d83-4183-863b-748d69de621f';
const ACTIVE_STATUSES = [
    'SCHEDULED',
    'CONFIRMED',
    'MESSAGE_LEFT',
    'CHECKED_IN',
    'IN_ROOM',
    'WITH_PROVIDER',
    'WITH_STAFF',
    'READY_FOR_STAFF',
    'PENDING_COSIGN'
];
// Utility functions
const formatDateWithOffset = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00-0400`;
};
const isTokenExpired = (tokens) => {
    return Date.now() - tokens.timestamp > TOKEN_EXPIRY_MS;
};
const transformEZDermEncounter = (encounter) => {
    return {
        id: encounter.id,
        patientName: `${encounter.patientInfo.firstName} ${encounter.patientInfo.lastName}`,
        patientInfo: {
            firstName: encounter.patientInfo.firstName,
            lastName: encounter.patientInfo.lastName,
            dateOfBirth: encounter.patientInfo.dateOfBirth,
            gender: encounter.patientInfo.gender,
            medicalRecordNumber: encounter.patientInfo.medicalRecordNumber,
            ...(encounter.patientInfo.phoneNumber && { phoneNumber: encounter.patientInfo.phoneNumber }),
            ...(encounter.patientInfo.emailAddress && { emailAddress: encounter.patientInfo.emailAddress })
        },
        appointmentTime: encounter.dateOfService,
        ...(encounter.dateOfArrival && { arrivalTime: encounter.dateOfArrival }),
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
    };
};
// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }
        // Prepare EZDerm login request
        const loginData = {
            username,
            password,
            application: 'EZDERM',
            timeZoneId: 'America/Detroit',
            clientVersion: '4.28.0'
        };
        // Make request to EZDerm login API
        const loginResponse = await axios_1.default.post(EZDERM_LOGIN_URL, loginData, {
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
        const tokenData = {
            accessToken,
            refreshToken,
            serverUrl: servers.app,
            timestamp: Date.now()
        };
        tokenStore.set(username, tokenData);
        // Return success response
        res.json({
            success: true,
            username,
            serverUrl: servers.app
        });
    }
    catch (error) {
        console.error('Login error:', error.response?.data || error.message);
        res.status(401).json({
            error: 'Invalid credentials or login failed',
            details: error.response?.data?.message || error.message
        });
        return;
    }
});
// Get encounters endpoint
app.post('/api/encounters', async (req, res) => {
    try {
        const { username, dateRangeStart, dateRangeEnd, clinicId, providerIds } = req.body;
        if (!username) {
            res.status(400).json({ error: 'Username is required' });
            return;
        }
        // Get stored tokens
        const userTokens = tokenStore.get(username);
        if (!userTokens) {
            res.status(401).json({ error: 'User not authenticated. Please login first.' });
            return;
        }
        // Check if token is expired
        if (isTokenExpired(userTokens)) {
            tokenStore.delete(username);
            res.status(401).json({ error: 'Session expired. Please login again.' });
            return;
        }
        // Get today's date for default range
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        // Prepare request data exactly like the curl command
        const encounterData = {
            dateOfServiceRangeHigh: dateRangeEnd || formatDateWithOffset(tomorrow),
            clinicId: clinicId || DEFAULT_CLINIC_ID,
            providerIds: providerIds || [],
            practiceId: DEFAULT_PRACTICE_ID,
            dateOfServiceRangeLow: dateRangeStart || formatDateWithOffset(today),
            lightBean: true,
            dateSelection: 'SPECIFY_RANGE'
        };
        console.log('Sending request to EZDerm API:', encounterData);
        // Make request to EZDerm encounters API
        const encountersResponse = await axios_1.default.post(`${userTokens.serverUrl}ezderm-webservice/rest/encounter/getByFilter`, encounterData, {
            headers: {
                'Host': 'srvprod.ezinfra.net',
                'accept': 'application/json',
                'content-type': 'application/json',
                'authorization': `Bearer ${userTokens.accessToken}`,
                'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
                'accept-language': 'en-US;q=1.0'
            }
        });
        // Process and format the encounters data
        const allEncounters = encountersResponse.data.map(transformEZDermEncounter);
        // Filter to only show patients currently in clinic (not checked out)
        const activeEncounters = allEncounters.filter(encounter => {
            console.log('encounter.status', encounter.status);
            return ACTIVE_STATUSES.includes(encounter.status);
        });
        // Sort by appointment time in ascending order
        const sortedEncounters = activeEncounters.sort((a, b) => {
            const timeA = new Date(a.appointmentTime).getTime();
            const timeB = new Date(b.appointmentTime).getTime();
            return timeA - timeB;
        });
        console.log(`Found ${sortedEncounters.length} active patients out of ${allEncounters.length} total`);
        res.json({ encounters: sortedEncounters });
    }
    catch (error) {
        console.error('Encounters error:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            const { username } = req.body;
            if (username) {
                tokenStore.delete(username);
            }
            res.status(401).json({ error: 'Authentication failed. Please login again.' });
            return;
        }
        res.status(500).json({
            error: 'Failed to fetch encounters',
            details: error.response?.data?.message || error.message
        });
        return;
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
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});
// Vital signs management endpoints
// Process vital signs carryforward for specific encounter
app.post('/api/vital-signs/process/:encounterId', async (req, res) => {
    try {
        const encounterId = req.params.encounterId;
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Username is required in request body' });
        }
        if (!encounterId) {
            return res.status(400).json({ error: 'Encounter ID is required' });
        }
        // Get stored tokens
        const userTokens = tokenStore.get(username);
        if (!userTokens) {
            return res.status(401).json({ error: 'User not authenticated. Please login first.' });
        }
        // Check if token is expired
        if (isTokenExpired(userTokens)) {
            tokenStore.delete(username);
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }
        // Note: For now, we'll create a mock encounter for testing
        // In a real implementation, you would fetch the specific encounter from EZDerm API
        const mockEncounter = {
            id: encounterId,
            status: 'READY_FOR_STAFF',
            establishedPatient: true,
            patientInfo: {
                id: 'test-patient-id',
                firstName: 'Test',
                lastName: 'Patient',
                dateOfBirth: '1990-01-01'
            }
        };
        const result = await vitalSignsService_1.vitalSignsService.processVitalSignsCarryforward(mockEncounter, userTokens.accessToken);
        if (result) {
            res.json({
                success: true,
                message: `Vital signs carryforward processed for encounter ${encounterId}`,
                encounterId
            });
            return;
        }
        else {
            res.status(400).json({
                success: false,
                message: 'Encounter not eligible for vital signs carryforward or already processed',
                encounterId
            });
            return;
        }
    }
    catch (error) {
        console.error('Error processing vital signs for encounter:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
});
// Process vital signs carryforward for all eligible encounters
app.post('/api/vital-signs/process-all', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Username is required in request body' });
        }
        // Get stored tokens
        const userTokens = tokenStore.get(username);
        if (!userTokens) {
            return res.status(401).json({ error: 'User not authenticated. Please login first.' });
        }
        // Check if token is expired
        if (isTokenExpired(userTokens)) {
            tokenStore.delete(username);
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }
        // Note: For now, we'll use mock encounters for testing
        // In a real implementation, you would fetch all today's encounters from EZDerm API
        const mockEncounters = [
            {
                id: 'encounter-1',
                status: 'READY_FOR_STAFF',
                establishedPatient: true,
                patientInfo: {
                    id: 'patient-1',
                    firstName: 'John',
                    lastName: 'Doe',
                    dateOfBirth: '1985-03-15'
                }
            },
            {
                id: 'encounter-2',
                status: 'READY_FOR_STAFF',
                establishedPatient: true,
                patientInfo: {
                    id: 'patient-2',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    dateOfBirth: '1990-07-22'
                }
            }
        ];
        const result = await vitalSignsService_1.vitalSignsService.processMultipleEncounters(mockEncounters, userTokens.accessToken);
        res.json({
            success: true,
            message: 'Vital signs carryforward processing completed',
            ...result
        });
        return;
    }
    catch (error) {
        console.error('Error processing vital signs for all encounters:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
});
// Get vital signs processing statistics
app.get('/api/vital-signs/stats', async (req, res) => {
    try {
        const stats = await vitalSignsService_1.vitalSignsService.getProcessingStats();
        res.json(stats);
    }
    catch (error) {
        console.error('Error fetching vital signs statistics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// Start server with database initialization
async function startServer() {
    try {
        // Initialize database
        await database_1.vitalSignsDb.initialize();
        console.log('💾 Database initialized successfully');
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🏥 EZDerm API Base: ${EZDERM_API_BASE}`);
            console.log(`🩺 Vital signs carryforward enabled`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🔄 Gracefully shutting down...');
    await database_1.vitalSignsDb.close();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('🔄 Gracefully shutting down...');
    await database_1.vitalSignsDb.close();
    process.exit(0);
});
startServer();
//# sourceMappingURL=tracking-server.js.map