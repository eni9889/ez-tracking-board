import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Alert,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  LocalHospital,
  ExitToApp,
  Refresh,
  Person,
  Schedule,
  CheckCircle,
  Login,
  MeetingRoom,
  PersonAdd,
  Group,
  PendingActions,
  PersonPin,
  Verified
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

  // Check if we're in mock data mode
  const isUsingMockData = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

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
    const statusConfig = {
      'SCHEDULED': { color: '#2196F3', background: '#E3F2FD', icon: Schedule, tooltip: 'Scheduled' },
      'CONFIRMED': { color: '#4CAF50', background: '#E8F5E8', icon: Verified, tooltip: 'Confirmed' },
      'CHECKED_IN': { color: '#FF9800', background: '#FFF3E0', icon: PersonPin, tooltip: 'Checked In' },
      'IN_ROOM': { color: '#9C27B0', background: '#F3E5F5', icon: MeetingRoom, tooltip: 'In Room' },
      'WITH_PROVIDER': { color: '#F44336', background: '#FFEBEE', icon: PersonAdd, tooltip: 'With Provider' },
      'WITH_STAFF': { color: '#607D8B', background: '#ECEFF1', icon: Group, tooltip: 'With Staff' },
      'PENDING_COSIGN': { color: '#795548', background: '#EFEBE9', icon: PendingActions, tooltip: 'Pending Cosign' },
      'ARRIVED': { color: '#FF9800', background: '#FFF3E0', icon: Login, tooltip: 'Arrived' }
    } as const;

    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { color: '#757575', background: '#F5F5F5', icon: Person, tooltip: status };

    const IconComponent = config.icon;

    return (
      <Tooltip title={config.tooltip} arrow>
        <Chip
          icon={<IconComponent sx={{ fontSize: '1.2rem !important' }} />}
          size="medium"
          sx={{
            backgroundColor: config.background,
            color: config.color,
            fontWeight: 'bold',
            minWidth: '60px',
            '& .MuiChip-icon': {
              marginLeft: '8px',
              marginRight: '-4px'
            }
          }}
        />
      </Tooltip>
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

  const dangerCount = sortedEncounters.filter(e => patientTrackingService.isWaitingTooLong(e.arrivalTime)).length;
  const occupiedRooms = sortedEncounters.filter(e => e.room !== 'N/A' && e.room !== 0).length;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
      {/* Compact Header with integrated summary */}
      <Box sx={{ 
        backgroundColor: '#1976d2', 
        color: 'white', 
        px: 3, 
        py: 1.5,
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalHospital sx={{ fontSize: '2rem' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
              EZ Patient Tracking Board
              {isUsingMockData && (
                <Chip 
                  label="DEMO MODE" 
                  size="small" 
                  sx={{ 
                    ml: 1, 
                    backgroundColor: '#ff9800', 
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '0.7rem'
                  }} 
                />
              )}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })} • Updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
          </Box>
        </Box>

        {/* Integrated Summary Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', lineHeight: 1 }}>
              {sortedEncounters.length}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.8rem', opacity: 0.9 }}>
              Total Patients
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', lineHeight: 1, color: '#ffeb3b' }}>
              {dangerCount}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.8rem', opacity: 0.9 }}>
                             Waiting &gt;10min
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', lineHeight: 1, color: '#4caf50' }}>
              {occupiedRooms}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.8rem', opacity: 0.9 }}>
              Rooms Occupied
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={fetchEncounters} 
                disabled={loading}
                sx={{ color: 'white' }}
              >
                <Refresh sx={{ fontSize: '1.5rem' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Logout">
              <IconButton onClick={handleLogout} sx={{ color: 'white' }}>
                <ExitToApp sx={{ fontSize: '1.5rem' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mx: 3, mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* Compact Table */}
      <Box sx={{ flex: 1, overflow: 'hidden', px: 2, py: 1 }}>
        <TableContainer 
          component={Paper} 
          sx={{ 
            height: '100%',
            boxShadow: 2,
            '& .MuiTable-root': {
              minWidth: 'unset'
            }
          }}
        >
                     <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', minWidth: '1200px' }}>
            <TableHead>
              <TableRow sx={{ '& th': { backgroundColor: '#f8f9fa', fontWeight: 'bold', py: 1.5 } }}>
                <TableCell sx={{ width: '80px', textAlign: 'center', fontSize: '1rem' }}>Room</TableCell>
                <TableCell sx={{ width: '220px', fontSize: '1rem' }}>Patient</TableCell>
                <TableCell sx={{ width: '140px', fontSize: '1rem' }}>Time</TableCell>
                <TableCell sx={{ width: '80px', fontSize: '1rem', textAlign: 'center' }}>Status</TableCell>
                <TableCell sx={{ width: '200px', fontSize: '1rem' }}>Provider</TableCell>
                <TableCell sx={{ width: '120px', fontSize: '1rem' }}>Visit Length</TableCell>
                <TableCell sx={{ width: '300px', fontSize: '1rem' }}>Chief Complaint</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography variant="h6">Loading patients...</Typography>
                  </TableCell>
                </TableRow>
              ) : sortedEncounters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography variant="h6">No patients currently in clinic</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedEncounters.map((encounter) => {
                  const isWaitingTooLong = patientTrackingService.isWaitingTooLong(encounter.arrivalTime);
                  const isDangerStatus = encounter.status === 'CHECKED_IN' || encounter.status === 'WITH_STAFF';
                  const shouldHighlight = isWaitingTooLong && isDangerStatus;

                  return (
                    <TableRow 
                      key={encounter.id} 
                      sx={getRowStyling(encounter)}
                    >
                      {/* Room - Compact */}
                      <TableCell sx={{ textAlign: 'center', py: 1.5 }}>
                        <Typography variant="h4" sx={{ 
                          fontWeight: 'bold', 
                          color: '#1976d2',
                          lineHeight: 1
                        }}>
                          {encounter.room !== 'N/A' && encounter.room !== 0 ? encounter.room : '-'}
                        </Typography>
                      </TableCell>

                                             {/* Patient - Compact */}
                       <TableCell sx={{ py: 1.5 }}>
                         <Box>
                           <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                             {encounter.patientInfo.firstName?.charAt(0)}. {encounter.patientInfo.lastName}
                           </Typography>
                           <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                             {encounter.patientInfo.gender} • {encounter.appointmentType}
                           </Typography>
                         </Box>
                       </TableCell>

                                             {/* Time - Compact */}
                       <TableCell sx={{ py: 1.5 }}>
                         <Box>
                           <Typography 
                             variant="h6" 
                             sx={{ 
                               fontWeight: 'bold',
                               lineHeight: 1.2,
                               fontSize: '1.1rem',
                               color: shouldHighlight ? 'error.main' : 'text.primary'
                             }}
                           >
                             {patientTrackingService.formatAppointmentTime(encounter.appointmentTime)}
                           </Typography>
                           {encounter.arrivalTime && (
                             <Typography 
                               variant="body2" 
                               sx={{ 
                                 fontSize: '0.9rem',
                                 color: shouldHighlight ? 'error.main' : 'text.secondary'
                               }}
                             >
                               Arrived: {patientTrackingService.formatAppointmentTime(encounter.arrivalTime)}
                             </Typography>
                           )}
                         </Box>
                       </TableCell>

                                             {/* Status - Compact */}
                       <TableCell sx={{ py: 1.5, textAlign: 'center' }}>
                         {getStatusChip(encounter.status)}
                       </TableCell>

                      {/* Provider - Compact */}
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                          {patientTrackingService.getAllStaff(encounter.providers)}
                        </Typography>
                      </TableCell>

                      {/* Visit Length - Compact */}
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography 
                          variant="body1"
                          sx={{
                            fontWeight: shouldHighlight ? 'bold' : 'normal',
                            fontSize: shouldHighlight ? '1rem' : '0.95rem',
                            color: shouldHighlight ? 'error.main' : 'text.primary'
                          }}
                        >
                                                     {patientTrackingService.calculateWaitTime(encounter.arrivalTime)}
                        </Typography>
                      </TableCell>

                                             {/* Chief Complaint - Compact */}
                       <TableCell sx={{ py: 1.5 }}>
                         <Typography variant="body1" sx={{ 
                           fontSize: '1rem',
                           overflow: 'hidden',
                           textOverflow: 'ellipsis',
                           whiteSpace: 'nowrap'
                         }}>
                           {encounter.chiefComplaint}
                         </Typography>
                       </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default Dashboard; 