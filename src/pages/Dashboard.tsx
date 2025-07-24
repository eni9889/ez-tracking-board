import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import patientTrackingService from '../services/patientTracking.service';
import {
  Box,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  AppBar,
  Toolbar,
  Button,
  Avatar,
  Tooltip,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  ExitToApp,
  Refresh,
  Person,
  Phone,
  AccessTime,
  MeetingRoom,
  Search,
  LocalHospital
} from '@mui/icons-material';
import { Encounter } from '../types/api.types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchEncounters = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await patientTrackingService.getEncounters();
      setEncounters(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch patient data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEncounters();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchEncounters, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getStatusChip = (status: string) => {
    return (
      <Chip
        label={status.replace('_', ' ')}
        size="small"
        sx={{
          backgroundColor: patientTrackingService.getStatusColor(status),
          color: 'white',
          fontWeight: 'bold'
        }}
      />
    );
  };

  const filteredEncounters = encounters.filter(encounter =>
    encounter.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    encounter.patientInfo.medicalRecordNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    encounter.chiefComplaint.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <LocalHospital sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            EZ Patient Tracking Board
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            Welcome, {user?.username}
          </Typography>
          <Button color="inherit" onClick={handleLogout} startIcon={<ExitToApp />}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Current Patients in Clinic
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Today: {new Date().toLocaleDateString()} • Last updated: {lastRefresh.toLocaleTimeString()}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 300 }}
              />
              <Tooltip title="Refresh">
                <IconButton onClick={fetchEncounters} disabled={loading}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>MRN</TableCell>
                    <TableCell>Chief Complaint</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Room</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Wait Time</TableCell>
                    <TableCell>Contact</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEncounters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No patients found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEncounters.map((encounter) => (
                      <TableRow key={encounter.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AccessTime fontSize="small" color="action" />
                            {patientTrackingService.formatAppointmentTime(encounter.appointmentTime)}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                              {encounter.patientInfo.firstName[0]}{encounter.patientInfo.lastName[0]}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {encounter.patientName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {encounter.patientInfo.gender}, DOB: {new Date(encounter.patientInfo.dateOfBirth).toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {encounter.patientInfo.medicalRecordNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {encounter.chiefComplaint}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {getStatusChip(encounter.status)}
                        </TableCell>
                        <TableCell>
                          {encounter.room !== 'N/A' && encounter.room !== 0 ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <MeetingRoom fontSize="small" color="action" />
                              <Typography variant="body2" fontWeight="bold">
                                {encounter.room}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {patientTrackingService.getPrimaryProvider(encounter.providers)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color={encounter.arrivalTime ? 'text.primary' : 'text.secondary'}>
                            {patientTrackingService.calculateWaitTime(encounter.arrivalTime)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {encounter.patientInfo.phoneNumber && (
                            <Tooltip title={encounter.patientInfo.phoneNumber}>
                              <IconButton size="small">
                                <Phone fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Total patients: {filteredEncounters.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {Object.entries({
                'SCHEDULED': 0,
                'CHECKED_IN': 0,
                'IN_ROOM': 0,
                'WITH_PROVIDER': 0
              }).map(([status]) => {
                const count = filteredEncounters.filter(e => e.status === status).length;
                return count > 0 ? (
                  <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getStatusChip(status)}
                    <Typography variant="body2">{count}</Typography>
                  </Box>
                ) : null;
              })}
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Dashboard; 