import React, { useState, useEffect, useCallback } from 'react';
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
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  LocalHospital,
  ExitToApp,
  Refresh,
  Psychology,
  Person,
  PersonOutline,
  Badge,
  MedicalServices
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import patientTrackingService from '../services/patientTracking.service';
import authService from '../services/auth.service';
import { Encounter } from '../types/api.types';

const Dashboard: React.FC = () => {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null); // Used for session monitoring

  const { logout } = useAuth();
  const navigate = useNavigate();

  // Check if we're in mock data mode
  const isUsingMockData = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';



  const fetchEncounters = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await patientTrackingService.getEncounters();
      
      // Simply update the data without animations
      setEncounters(data.filter(enc => enc && enc.id)); // Safety filter
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch patient data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Sort encounters by room number
  const sortedEncounters = encounters.sort((a, b) => {
    // Convert room to number, handle undefined, 'N/A' and 0 as no room assigned
    const getRoomNumber = (room: string | number | undefined) => {
      if (!room || room === 'N/A' || room === 0 || room === '0' || room === 'TBD') return 999; // Put unassigned rooms at end
      return typeof room === 'string' ? parseInt(room) || 999 : room;
    };
    
    const roomA = getRoomNumber(a.room);
    const roomB = getRoomNumber(b.room);
    
    return roomA - roomB;
  });

  useEffect(() => {
    fetchEncounters(false);
    
    // Refresh data every 10 seconds
    const interval = setInterval(() => fetchEncounters(true), 10000);
    
    // Set up session monitoring every minute
    const sessionCheckInterval = setInterval(async () => {
      try {
        console.log('🔍 Dashboard: Checking session status...');
        const sessionInfo = authService.getSessionInfo();
        console.log('📊 Session info:', sessionInfo);
        
        setSessionTimeRemaining(sessionInfo.timeRemaining);
        
        if (sessionInfo.timeRemaining !== null && sessionInfo.timeRemaining < 60 * 60 * 1000) { // 1 hour
          console.log('⚠️ Session expiring soon, attempting token refresh...');
          const refreshed = await authService.attemptTokenRefresh();
          if (!refreshed) {
            console.log('❌ Token refresh failed - clinic dashboard needs attention');
            setError('Session expired. Dashboard will attempt to reconnect automatically.');
          } else {
            console.log('✅ Token refresh successful - clinic dashboard stays online');
            setError(null); // Clear any previous errors
          }
        }
      } catch (error) {
        console.error('💥 Session check error:', error);
      }
    }, 60 * 1000); // Check every minute
    
    return () => {
      clearInterval(interval);
      clearInterval(sessionCheckInterval);
    };
  }, [fetchEncounters]);

  const handleLogout = async () => {
    try {
      console.log('🏥 Manual logout requested for clinic dashboard');
      await authService.manualLogout(); // Clear stored credentials
      await logout(); // Clear auth context
      navigate('/login');
    } catch (error) {
      console.error('Manual logout error:', error);
      // Force navigation even if logout fails
      navigate('/login');
    }
  };

  const getStatusText = (status: string) => {
    const statusConfig = {
      'SCHEDULED': { color: '#2196F3', background: '#E3F2FD', text: 'Scheduled' },
      'CONFIRMED': { color: '#4CAF50', background: '#E8F5E8', text: 'Confirmed' },
      'CHECKED_IN': { color: '#FF9800', background: '#FFF3E0', text: 'Checked In' },
      'IN_ROOM': { color: '#9C27B0', background: '#F3E5F5', text: 'In Room' },
      'WITH_PROVIDER': { color: '#F44336', background: '#FFEBEE', text: 'W/Provider' },
      'WITH_STAFF': { color: '#607D8B', background: '#ECEFF1', text: 'W/Staff' },
      'READY_FOR_STAFF': { color: '#00C853', background: '#E8F5E8', text: 'Ready' },
      'PENDING_COSIGN': { color: '#795548', background: '#EFEBE9', text: 'Pending Cosign' },
      'ARRIVED': { color: '#FF9800', background: '#FFF3E0', text: 'Arrived' }
    } as const;

    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { color: '#757575', background: '#F5F5F5', text: status };

    return (
      <Chip
        label={config.text}
        size="medium"
        sx={{
          backgroundColor: config.background,
          color: config.color,
          border: `1px solid ${config.color}`,
          fontWeight: 'bold',
          minWidth: '160px',
          height: '48px',
          fontSize: '1.5rem'
        }}
      />
    );
  };

  const getPatientInitials = (firstName: string, lastName: string) => {
    const firstInitial = firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
    return `${firstInitial}.${lastInitial}.`;
  };

  const getProviderIcon = (role: string) => {
    const iconProps = { sx: { fontSize: '1.5rem', mr: 0.5, minWidth: '24px', display: 'flex', alignItems: 'center' } };
    
    switch (role) {
      case 'PROVIDER':
        return <MedicalServices {...iconProps} />;
      case 'SECONDARY_PROVIDER':
        return <Person {...iconProps} />;
      case 'COSIGNING_PROVIDER':
        return <Badge {...iconProps} />;
      case 'STAFF':
        return <PersonOutline {...iconProps} />;
      default:
        return <Person {...iconProps} />;
    }
  };

  // Get row styling based on wait time and status only
  const getRowStyling = (encounter: Encounter) => {
    const isWaitingTooLong = patientTrackingService.isWaitingTooLong(encounter.arrivalTime);
    const isDangerStatus = encounter.status === 'CHECKED_IN' || encounter.status === 'WITH_STAFF';
    const shouldHighlight = isWaitingTooLong && isDangerStatus;
    
    return {
      backgroundColor: 'inherit',
      borderLeft: shouldHighlight ? '5px solid #f44336' : 'none',
      transition: 'all 0.3s ease-in-out',
      '&:hover': {
        backgroundColor: '#f5f5f5'
      }
    };
  };

  const getProviderTitle = (provider: any) => {
    const [firstName, lastName] = provider.name.split(' ');

    return firstName[0] + '.' + lastName + (provider.title ? `, ${provider.title.replace('Medical Assistant', 'MA')}` : '');
  };

  // Calculate stats from current encounters
  const dangerCount = encounters.filter(e => patientTrackingService.isWaitingTooLong(e.arrivalTime)).length;
  const occupiedRooms = encounters.filter(e => e.room !== 'N/A' && e.room !== 0).length;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
      {/* Compact Header with integrated summary */}
      <Box sx={{ 
        backgroundColor: '#0a0a0a', 
        color: 'white', 
        px: 3, 
        py: 1.5,
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        borderBottom: '1px solid #1a1a1a'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalHospital sx={{ 
            fontSize: '2rem', 
            color: '#f8fafc',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
          }} />
          <Box>
            <Typography variant="h5" sx={{ 
              fontWeight: 600, 
              lineHeight: 1.2,
              color: '#f8fafc',
              letterSpacing: '-0.025em'
            }}>
              DCC - Flint
              {isUsingMockData && (
                <Chip 
                  label="DEMO MODE" 
                  size="small" 
                  sx={{ 
                    ml: 1, 
                    backgroundColor: '#dc2626', 
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    border: '1px solid #ef4444',
                    '&:hover': {
                      backgroundColor: '#b91c1c'
                    }
                  }} 
                />
              )}
            </Typography>
            <Typography variant="body2" sx={{ 
              opacity: 0.8,
              color: '#e2e8f0',
              fontSize: '0.875rem',
              fontWeight: 400
            }}>
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
          <Box sx={{ 
            textAlign: 'center',
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a'
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              lineHeight: 1,
              color: '#f8fafc',
              fontSize: '1.875rem'
            }}>
              {encounters.length}
            </Typography>
            <Typography variant="caption" sx={{ 
              fontSize: '0.75rem', 
              opacity: 0.8,
              color: '#94a3b8',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Total Patients
            </Typography>
          </Box>
          <Box sx={{ 
            textAlign: 'center',
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a'
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              lineHeight: 1, 
              color: '#fbbf24',
              fontSize: '1.875rem'
            }}>
              {dangerCount}
            </Typography>
            <Typography variant="caption" sx={{ 
              fontSize: '0.75rem', 
              opacity: 0.8,
              color: '#94a3b8',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Waiting &gt;10min
            </Typography>
          </Box>
          <Box sx={{ 
            textAlign: 'center',
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a'
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              lineHeight: 1, 
              color: '#10b981',
              fontSize: '1.875rem'
            }}>
              {occupiedRooms}
            </Typography>
            <Typography variant="caption" sx={{ 
              fontSize: '0.75rem', 
              opacity: 0.8,
              color: '#94a3b8',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Rooms Occupied
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Tooltip title="AI Note Checker">
              <IconButton 
                onClick={() => navigate('/ai-note-checker')}
                sx={{ 
                  color: '#f8fafc',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: 2,
                  p: 1.5,
                  '&:hover': {
                    backgroundColor: '#2a2a2a',
                    borderColor: '#3a3a3a'
                  }
                }}
              >
                <Psychology sx={{ fontSize: '1.25rem' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={() => fetchEncounters(true)} 
                disabled={loading || refreshing}
                sx={{ 
                  color: '#f8fafc',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: 2,
                  p: 1.5,
                  '&:hover': {
                    backgroundColor: '#2a2a2a',
                    borderColor: '#3a3a3a'
                  },
                  '&:disabled': {
                    color: '#64748b',
                    backgroundColor: '#0f0f0f',
                    borderColor: '#1a1a1a'
                  }
                }}
              >
                {refreshing ? (
                  <CircularProgress size={20} sx={{ color: '#f8fafc' }} />
                ) : (
                  <Refresh sx={{ fontSize: '1.25rem' }} />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Logout">
              <IconButton 
                onClick={handleLogout} 
                sx={{ 
                  color: '#f8fafc',
                  backgroundColor: '#dc2626',
                  border: '1px solid #ef4444',
                  borderRadius: 2,
                  p: 1.5,
                  '&:hover': {
                    backgroundColor: '#b91c1c',
                    borderColor: '#dc2626'
                  }
                }}
              >
                <ExitToApp sx={{ fontSize: '1.25rem' }} />
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

      {/* Two Column Layout */}
      <Box sx={{ flex: 1, overflow: 'hidden', px: 1, py: 0.5 }}>
        <Box sx={{ display: 'flex', gap: 1, height: '100%' }}>
      
      {/* Left Column */}
      <Box sx={{ flex: 1 }}>
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
              <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow sx={{ '& th': { backgroundColor: '#f8f9fa', fontWeight: 'bold', py: 1.5 } }}>
                    <TableCell sx={{ width: '60px', textAlign: 'center', fontSize: '1.6rem' }}>Room</TableCell>
                    <TableCell sx={{ width: '90px', fontSize: '1.6rem' }}>Patient</TableCell>
                    <TableCell sx={{ width: '80px', fontSize: '1.6rem' }}>Time</TableCell>
                    <TableCell sx={{ width: '110px', fontSize: '1.6rem', textAlign: 'center' }}>Status</TableCell>
                    <TableCell sx={{ width: '150px', fontSize: '1.6rem' }}>Provider</TableCell>
                    <TableCell sx={{ width: '90px', fontSize: '1.6rem' }}>Visit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedEncounters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <Typography variant="h6" color="text.secondary" sx={{ fontSize: '1.4rem' }}>No patients currently in clinic</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedEncounters.slice(0, Math.ceil(sortedEncounters.length / 2)).map((encounter) => {
                      const isWaitingTooLong = patientTrackingService.isWaitingTooLong(encounter.arrivalTime);
                      const isDangerStatus = encounter.status === 'CHECKED_IN' || encounter.status === 'WITH_STAFF';
                      const shouldHighlight = isWaitingTooLong && isDangerStatus;

                                     return (
                       <TableRow 
                         key={encounter.id}
                         sx={getRowStyling(encounter)}
                       >
                      {/* Room - Compact */}
                      <TableCell sx={{ textAlign: 'center', height: '130px', verticalAlign: 'middle' }}>
                        <Typography variant="h4" sx={{ 
                          fontWeight: 'bold', 
                          color: '#1976d2',
                          lineHeight: 1,
                          fontSize: '3.5rem'
                        }}>
                          {encounter.room !== 'N/A' && encounter.room !== 0 ? encounter.room : '-'}
                        </Typography>
                      </TableCell>

                      {/* Patient - Compact */}
                      <TableCell sx={{ height: '130px', verticalAlign: 'middle' }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1, fontSize: '2rem' }}>
                            {getPatientInitials(encounter.patientInfo.firstName, encounter.patientInfo.lastName)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.3rem' }}>
                            {encounter.patientInfo.gender}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Time - Compact */}
                      <TableCell sx={{ height: '130px', verticalAlign: 'middle' }}>
                        <Box>
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontWeight: 'bold',
                              lineHeight: 1,
                              fontSize: '1.6rem',
                              color: 'black'
                            }}
                          >
                            {patientTrackingService.formatAppointmentTime(encounter.appointmentTime)}
                          </Typography>
                          {encounter.arrivalTime && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontSize: '1.3rem',
                                color: 'text.secondary'
                              }}
                            >
                            {patientTrackingService.formatAppointmentTime(encounter.arrivalTime)}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Status - Compact */}
                      <TableCell sx={{ height: '130px', verticalAlign: 'middle', textAlign: 'center' }}>
                        {getStatusText(encounter.status)}
                      </TableCell>

                      {/* Provider - Compact */}
                      <TableCell sx={{ height: '130px', verticalAlign: 'middle' }}>
                        <Box>
                          {encounter.providers && encounter.providers.length > 0 ? (
                            encounter.providers
                              .sort((a: any, b: any) => {
                                const roleOrder = ['PROVIDER', 'SECONDARY_PROVIDER', 'COSIGNING_PROVIDER', 'STAFF'];
                                const aIndex = roleOrder.indexOf(a.role);
                                const bIndex = roleOrder.indexOf(b.role);
                                return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
                              })
                              .map((provider: any, index: number) => (
                                <Box 
                                  key={index} 
                                  sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    mb: index < encounter.providers.length - 1 ? 0.8 : 0
                                  }}
                                >
                                  {getProviderIcon(provider.role)}
                                  <Typography 
                                    variant="body1" 
                                    sx={{ 
                                      fontWeight: 'bold', 
                                      fontSize: '1.5rem',
                                      lineHeight: 1.25,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {getProviderTitle(provider)}
                                  </Typography>
                                </Box>
                              ))
                          ) : (
                            <Typography variant="body1" sx={{ 
                              fontWeight: 'bold', 
                              fontSize: '1.5rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              No staff assigned
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Visit Length - Compact */}
                      <TableCell sx={{ height: '130px', verticalAlign: 'middle' }}>
                        <Typography 
                          variant="body1"
                          sx={{
                            fontWeight: 'bold',
                            fontSize: '2rem',
                            color: shouldHighlight ? 'error.main' : 'text.primary'
                          }}
                        >
                          {patientTrackingService.calculateWaitTime(encounter.arrivalTime)}
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

      {/* Right Column */}
      <Box sx={{ flex: 1 }}>
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
          <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={{ '& th': { backgroundColor: '#f8f9fa', fontWeight: 'bold', py: 1.5 } }}>
                <TableCell sx={{ width: '60px', textAlign: 'center', fontSize: '1.6rem' }}>Room</TableCell>
                <TableCell sx={{ width: '90px', fontSize: '1.6rem' }}>Patient</TableCell>
                <TableCell sx={{ width: '80px', fontSize: '1.6rem' }}>Time</TableCell>
                <TableCell sx={{ width: '110px', fontSize: '1.6rem', textAlign: 'center' }}>Status</TableCell>
                <TableCell sx={{ width: '150px', fontSize: '1.6rem' }}>Provider</TableCell>
                <TableCell sx={{ width: '90px', fontSize: '1.6rem' }}>Visit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedEncounters.length <= 1 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography variant="h6" color="text.secondary" sx={{ fontSize: '1.4rem' }}>
                      {sortedEncounters.length === 0 ? 'No patients currently in clinic' : 'Additional patients will appear here'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedEncounters.slice(Math.ceil(sortedEncounters.length / 2)).map((encounter) => {
                  const isWaitingTooLong = patientTrackingService.isWaitingTooLong(encounter.arrivalTime);
                  const isDangerStatus = encounter.status === 'CHECKED_IN' || encounter.status === 'WITH_STAFF';
                  const shouldHighlight = isWaitingTooLong && isDangerStatus;

                  return (
                    <TableRow 
                      key={encounter.id}
                      sx={getRowStyling(encounter)}
                    >
                     {/* Room - Compact */}
                     <TableCell sx={{ textAlign: 'center', height: '130px', verticalAlign: 'middle' }}>
                       <Typography variant="h4" sx={{ 
                         fontWeight: 'bold', 
                         color: '#1976d2',
                         lineHeight: 1,
                         fontSize: '3.5rem'
                       }}>
                         {encounter.room !== 'N/A' && encounter.room !== 0 ? encounter.room : '-'}
                       </Typography>
                     </TableCell>

                     {/* Patient - Compact */}
                     <TableCell sx={{ height: '130px', verticalAlign: 'middle' }}>
                       <Box>
                         <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1, fontSize: '2rem' }}>
                           {getPatientInitials(encounter.patientInfo.firstName, encounter.patientInfo.lastName)}
                         </Typography>
                         <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.3rem' }}>
                           {encounter.patientInfo.gender}
                         </Typography>
                       </Box>
                     </TableCell>

                     {/* Time - Compact */}
                     <TableCell sx={{ height: '130px', verticalAlign: 'middle' }}>
                       <Box>
                         <Typography 
                           variant="body1" 
                           sx={{ 
                             fontWeight: 'bold',
                             lineHeight: 1,
                             fontSize: '1.6rem',
                             color: 'black'
                           }}
                         >
                           {patientTrackingService.formatAppointmentTime(encounter.appointmentTime)}
                         </Typography>
                         {encounter.arrivalTime && (
                           <Typography 
                             variant="body2" 
                             sx={{ 
                               fontSize: '1.3rem',
                               color: 'text.secondary'
                             }}
                           >
                             {patientTrackingService.formatAppointmentTime(encounter.arrivalTime)}
                           </Typography>
                         )}
                       </Box>
                     </TableCell>

                     {/* Status - Compact */}
                     <TableCell sx={{ height: '130px', verticalAlign: 'middle', textAlign: 'center' }}>
                       {getStatusText(encounter.status)}
                     </TableCell>

                    {/* Provider - Compact */}
                    <TableCell sx={{ height: '130px', verticalAlign: 'middle' }}>
                      <Box>
                        {encounter.providers && encounter.providers.length > 0 ? (
                          encounter.providers
                            .sort((a: any, b: any) => {
                              const roleOrder = ['PROVIDER', 'SECONDARY_PROVIDER', 'COSIGNING_PROVIDER', 'STAFF'];
                              const aIndex = roleOrder.indexOf(a.role);
                              const bIndex = roleOrder.indexOf(b.role);
                              return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
                            })
                            .map((provider: any, index: number) => (
                              <Box 
                                key={index} 
                                sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center',
                                  mb: index < encounter.providers.length - 1 ? 0.8 : 0
                                }}
                              >
                                {getProviderIcon(provider.role)}
                                <Typography 
                                  variant="body1" 
                                  sx={{ 
                                    fontWeight: 'bold', 
                                    fontSize: '1.5rem',
                                    lineHeight: 1.25,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {getProviderTitle(provider)}
                                </Typography>
                              </Box>
                            ))
                        ) : (
                          <Typography variant="body1" sx={{ 
                            fontWeight: 'bold', 
                            fontSize: '1.5rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            No staff assigned
                          </Typography>
                        )}
                      </Box>
                    </TableCell>

                    {/* Visit Length - Compact */}
                    <TableCell sx={{ height: '130px', verticalAlign: 'middle' }}>
                      <Typography 
                        variant="body1"
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '2rem',
                          color: shouldHighlight ? 'error.main' : 'text.primary'
                        }}
                      >
                        {patientTrackingService.calculateWaitTime(encounter.arrivalTime)}
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
      </Box>
    </Box>
  );
};

export default Dashboard; 