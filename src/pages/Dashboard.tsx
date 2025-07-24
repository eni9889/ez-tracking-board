import React, { useState, useEffect } from 'react';
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
  AppBar,
  Toolbar,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  LocalHospital,
  ExitToApp,
  Refresh,
  Person
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import patientTrackingService from '../services/patientTracking.service';
import { Encounter } from '../types/api.types';

const Dashboard: React.FC = () => {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  // Sort encounters by room number
  const sortedEncounters = [...encounters].sort((a, b) => {
    // Convert room to number, handle 'N/A' and 0 as no room assigned
    const getRoomNumber = (room: string | number) => {
      if (room === 'N/A' || room === 0 || room === '0') return 999; // Put unassigned rooms at end
      return typeof room === 'string' ? parseInt(room) || 999 : room;
    };
    
    const roomA = getRoomNumber(a.room);
    const roomB = getRoomNumber(b.room);
    
    return roomA - roomB;
  });

  useEffect(() => {
    fetchEncounters();
    
    // Refresh data every 5 seconds
    const interval = setInterval(fetchEncounters, 5000);
    
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
        size="medium"
        sx={{
          backgroundColor: patientTrackingService.getStatusColor(status),
          color: 'white',
          fontWeight: 'bold',
          fontSize: '1rem'
        }}
      />
    );
  };

  // Get row styling based on wait time and status
  const getRowStyling = (encounter: Encounter) => {
    const isWaitingTooLong = patientTrackingService.isWaitingTooLong(encounter.arrivalTime);
    const isDangerStatus = encounter.status === 'CHECKED_IN' || encounter.status === 'WITH_STAFF';
    const shouldHighlight = isWaitingTooLong && isDangerStatus;
    
    return {
      backgroundColor: shouldHighlight ? '#ffebee' : 'inherit',
      borderLeft: shouldHighlight ? '5px solid #f44336' : 'none',
      '&:hover': {
        backgroundColor: shouldHighlight ? '#ffcdd2' : '#f5f5f5'
      }
    };
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ backgroundColor: '#1976d2' }}>
        <Toolbar sx={{ minHeight: '80px !important' }}>
          <LocalHospital sx={{ mr: 2, fontSize: '2rem' }} />
          <Typography variant="h4" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            EZ Patient Tracking Board
          </Typography>
          <Typography variant="h6" sx={{ mr: 3 }}>
            Welcome, {user?.username}
          </Typography>
          <Button 
            color="inherit" 
            onClick={handleLogout} 
            startIcon={<ExitToApp />}
            sx={{ fontSize: '1.1rem', padding: '12px 24px' }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ mt: 4, px: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Box>
              <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                Current Patients in Clinic
              </Typography>
              <Typography variant="h6" color="text.secondary">
                Today: {new Date().toLocaleDateString()} • Last updated: {lastRefresh.toLocaleTimeString()}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Tooltip title="Refresh">
                <IconButton 
                  onClick={fetchEncounters} 
                  disabled={loading}
                  size="large"
                  sx={{ backgroundColor: '#f5f5f5', mr: 2 }}
                >
                  <Refresh sx={{ fontSize: '2rem' }} />
                </IconButton>
              </Tooltip>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                {sortedEncounters.length} Patients
              </Typography>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, fontSize: '1.1rem' }}>
              {error}
            </Alert>
          )}

          {loading && sortedEncounters.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
              <CircularProgress size={60} />
            </Box>
          ) : (
            <TableContainer>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell sx={{ fontSize: '1.3rem', fontWeight: 'bold', padding: '20px' }}>Room</TableCell>
                    <TableCell sx={{ fontSize: '1.3rem', fontWeight: 'bold', padding: '20px' }}>Time</TableCell>
                    <TableCell sx={{ fontSize: '1.3rem', fontWeight: 'bold', padding: '20px' }}>Patient</TableCell>
                    <TableCell sx={{ fontSize: '1.3rem', fontWeight: 'bold', padding: '20px' }}>Chief Complaint</TableCell>
                    <TableCell sx={{ fontSize: '1.3rem', fontWeight: 'bold', padding: '20px' }}>Status</TableCell>
                    <TableCell sx={{ fontSize: '1.3rem', fontWeight: 'bold', padding: '20px' }}>Staff</TableCell>
                    <TableCell sx={{ fontSize: '1.3rem', fontWeight: 'bold', padding: '20px' }}>Wait Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedEncounters.map((encounter) => (
                    <TableRow
                      key={encounter.id}
                      sx={getRowStyling(encounter)}
                    >
                      <TableCell sx={{ fontSize: '2rem', padding: '20px', fontWeight: 'bold', textAlign: 'center', minWidth: '100px' }}>
                        <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                          {encounter.room !== 'N/A' && encounter.room !== 0 ? encounter.room : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '1.2rem', padding: '20px', fontWeight: '500' }}>
                        <Typography 
                          variant="h6" 
                          component="div"
                          color={(() => {
                            const isWaitingTooLong = patientTrackingService.isWaitingTooLong(encounter.arrivalTime);
                            const isDangerStatus = encounter.status === 'CHECKED_IN' || encounter.status === 'WITH_STAFF';
                            return (isWaitingTooLong && isDangerStatus) ? 'error' : 'text.primary';
                          })()}
                        >
                          {patientTrackingService.formatAppointmentTime(encounter.appointmentTime)}
                        </Typography>
                        {encounter.arrivalTime && (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: '1rem',
                              color: (() => {
                                const isWaitingTooLong = patientTrackingService.isWaitingTooLong(encounter.arrivalTime);
                                const isDangerStatus = encounter.status === 'CHECKED_IN' || encounter.status === 'WITH_STAFF';
                                return (isWaitingTooLong && isDangerStatus) ? 'error.main' : 'text.secondary';
                              })()
                            }}
                          >
                            Arrived: {patientTrackingService.formatAppointmentTime(encounter.arrivalTime)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '1.2rem', padding: '20px' }}>
                        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                          {encounter.patientInfo.firstName} {encounter.patientInfo.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1rem' }}>
                          {new Date(encounter.patientInfo.dateOfBirth).toLocaleDateString()} • {encounter.patientInfo.gender}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '1.1rem', padding: '20px' }}>
                        <Typography variant="body1">
                          {encounter.chiefComplaint}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ padding: '20px' }}>
                        {getStatusChip(encounter.status)}
                      </TableCell>
                      <TableCell sx={{ fontSize: '1.1rem', padding: '20px' }}>
                        <Typography 
                          variant="body1" 
                          component="div"
                          style={{ whiteSpace: 'pre-line' }}
                        >
                          {patientTrackingService.getAllStaff(encounter.providers)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '1.2rem', padding: '20px' }}>
                        <Typography 
                          variant="h6" 
                          color={patientTrackingService.isWaitingTooLong(encounter.arrivalTime) ? 'error' : 'text.primary'}
                          sx={{ 
                            fontWeight: patientTrackingService.isWaitingTooLong(encounter.arrivalTime) ? 'bold' : '500',
                            fontSize: patientTrackingService.isWaitingTooLong(encounter.arrivalTime) ? '1.4rem' : '1.2rem'
                          }}
                        >
                          {patientTrackingService.calculateWaitTime(encounter.arrivalTime)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && sortedEncounters.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Person sx={{ fontSize: '4rem', color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" color="text.secondary">
                No patients currently in clinic
              </Typography>
            </Box>
          )}

          {/* Status Summary */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 3 }}>
            {['CHECKED_IN', 'IN_ROOM', 'WITH_PROVIDER'].map((status) => {
              const count = sortedEncounters.filter(e => e.status === status).length;
              return (
                <Paper key={status} elevation={2} sx={{ p: 3, textAlign: 'center', minWidth: 150 }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: patientTrackingService.getStatusColor(status) }}>
                    {count}
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    {status.replace('_', ' ')}
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Dashboard; 