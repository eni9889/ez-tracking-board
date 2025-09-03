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
  const [previousEncounters, setPreviousEncounters] = useState<Encounter[]>([]);
  const [changedRows, setChangedRows] = useState<Set<string>>(new Set());
  const [newRows, setNewRows] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null); // Used for session monitoring
  const [deletingRows, setDeletingRows] = useState<Set<string>>(new Set());

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
      
      // Compare with previous data to identify changes
      if (isRefresh) {
        setEncounters(currentEncounters => {
          if (currentEncounters.length > 0) {
            const newChangedRows = new Set<string>();
            const newNewRows = new Set<string>();
            const toDeleteRows = new Set<string>();
            
            // Find new and changed patients
            data.forEach(newEncounter => {
              const oldEncounter = currentEncounters.find(old => old.id === newEncounter.id);
              if (!oldEncounter) {
                // New patient
                newNewRows.add(newEncounter.id);
              } else {
                // Check for changes in key fields
                if (
                  oldEncounter.status !== newEncounter.status ||
                  oldEncounter.room !== newEncounter.room ||
                  oldEncounter.arrivalTime !== newEncounter.arrivalTime ||
                  JSON.stringify(oldEncounter.providers) !== JSON.stringify(newEncounter.providers)
                ) {
                  newChangedRows.add(newEncounter.id);
                }
              }
            });
            
            // Find patients that were removed
            currentEncounters.forEach(oldEncounter => {
              if (!data.find(newEnc => newEnc.id === oldEncounter.id)) {
                toDeleteRows.add(oldEncounter.id);
              }
            });
            
            // Handle deletions with animation
            if (toDeleteRows.size > 0) {
              setDeletingRows(toDeleteRows);
              // Wait for deletion animation, then update data
              setTimeout(() => {
                setEncounters(data);
                setDeletingRows(new Set());
                setNewRows(newNewRows);
                setChangedRows(newChangedRows);
                setPreviousEncounters(data);
              }, 500);
              return currentEncounters; // Keep current data during animation
            } else {
              // No deletions, update immediately
              setNewRows(newNewRows);
              setChangedRows(newChangedRows);
              setPreviousEncounters(currentEncounters);
              
              // Clear animations after their duration
              setTimeout(() => {
                setNewRows(new Set());
                setChangedRows(new Set());
              }, 2000);
              
              return data;
            }
          }
          return data;
        });
      } else {
        setEncounters(data);
      }
      
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch patient data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Sort encounters by room number, including those being deleted for animation
  const getAllEncounters = () => {
    const currentEncounters = [...encounters];
    
    // Add encounters that are being deleted for animation purposes
    if (deletingRows.size > 0 && previousEncounters.length > 0) {
      const deletingEncounters = previousEncounters.filter(enc => deletingRows.has(enc.id));
      currentEncounters.push(...deletingEncounters);
    }
    
    return currentEncounters;
  };

  const sortedEncounters = getAllEncounters().sort((a, b) => {
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
          minWidth: '140px',
          height: '42px',
          fontSize: '1.3rem'
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

  // Get row styling based on wait time, status, and changes
  const getRowStyling = (encounter: Encounter) => {
    const isWaitingTooLong = patientTrackingService.isWaitingTooLong(encounter.arrivalTime);
    const isDangerStatus = encounter.status === 'CHECKED_IN' || encounter.status === 'WITH_STAFF';
    const shouldHighlight = isWaitingTooLong && isDangerStatus;
    const isChanged = changedRows.has(encounter.id);
    const isNew = newRows.has(encounter.id);
    const isDeleting = deletingRows.has(encounter.id);
    
    // Priority: Deleting > New > Changed > Danger > Normal
    let backgroundColor, borderLeft, animation;
    
    if (isDeleting) {
      backgroundColor = '#ffebee';
      borderLeft = '5px solid #f44336';
      animation = 'slideOut 0.5s ease-in-out forwards';
    } else if (isNew) {
      backgroundColor = '#e3f2fd';
      borderLeft = '5px solid #2196f3';
      animation = 'slideIn 0.5s ease-in-out';
    } else if (isChanged) {
      backgroundColor = '#e8f5e8';
      borderLeft = '5px solid #4caf50';
      animation = 'pulse 2s ease-in-out';
    } else if (shouldHighlight) {
      backgroundColor = 'inherit';
      borderLeft = '5px solid #f44336';
      animation = 'none';
    } else {
      backgroundColor = 'inherit';
      borderLeft = 'none';
      animation = 'none';
    }
    
    return {
      backgroundColor,
      borderLeft,
      transition: 'all 0.3s ease-in-out',
      animation,
      '@keyframes slideIn': {
        '0%': {
          opacity: 0,
          transform: 'translateX(-20px) scale(0.95)',
          backgroundColor: '#bbdefb'
        },
        '100%': {
          opacity: 1,
          transform: 'translateX(0) scale(1)',
          backgroundColor: '#e3f2fd'
        }
      },
      '@keyframes slideOut': {
        '0%': {
          opacity: 1,
          transform: 'translateX(0) scale(1)',
          backgroundColor: '#ffebee'
        },
        '100%': {
          opacity: 0,
          transform: 'translateX(20px) scale(0.95)',
          backgroundColor: '#ffcdd2'
        }
      },
      '@keyframes pulse': {
        '0%': {
          backgroundColor: '#c8e6c9',
          transform: 'scale(1)'
        },
        '50%': {
          backgroundColor: '#e8f5e8',
          transform: 'scale(1.01)'
        },
        '100%': {
          backgroundColor: '#e8f5e8',
          transform: 'scale(1)'
        }
      },
      '&:hover': {
        backgroundColor: isDeleting
          ? '#ffcdd2'
          : isNew
            ? '#bbdefb'
            : isChanged
              ? '#dcedc8'
              : '#f5f5f5'
      }
    };
  };

  const getProviderTitle = (provider: any) => {
    const [firstName, lastName] = provider.name.split(' ');

    return firstName[0] + '.' + lastName + (provider.title ? `, ${provider.title.replace('Medical Assistant', 'MA')}` : '');
  };

  // Calculate stats only from current encounters (excluding those being deleted)
  const currentEncountersForStats = encounters.filter(e => !deletingRows.has(e.id));
  const dangerCount = currentEncountersForStats.filter(e => patientTrackingService.isWaitingTooLong(e.arrivalTime)).length;
  const occupiedRooms = currentEncountersForStats.filter(e => e.room !== 'N/A' && e.room !== 0).length;

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
              DCC - Flint
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
              {currentEncountersForStats.length}
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
          
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="AI Note Checker">
              <IconButton 
                onClick={() => navigate('/ai-note-checker')}
                sx={{ color: 'white' }}
              >
                <Psychology sx={{ fontSize: '1.5rem' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={() => fetchEncounters(true)} 
                disabled={loading || refreshing}
                sx={{ color: 'white' }}
              >
                {refreshing ? (
                  <CircularProgress size={24} sx={{ color: 'white' }} />
                ) : (
                  <Refresh sx={{ fontSize: '1.5rem' }} />
                )}
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
                  <TableRow sx={{ '& th': { backgroundColor: '#f8f9fa', fontWeight: 'bold', py: 1 } }}>
                    <TableCell sx={{ width: '60px', textAlign: 'center', fontSize: '1.4rem' }}>Room</TableCell>
                    <TableCell sx={{ width: '90px', fontSize: '1.4rem' }}>Patient</TableCell>
                    <TableCell sx={{ width: '80px', fontSize: '1.4rem' }}>Time</TableCell>
                    <TableCell sx={{ width: '110px', fontSize: '1.4rem', textAlign: 'center' }}>Status</TableCell>
                    <TableCell sx={{ width: '150px', fontSize: '1.4rem' }}>Provider</TableCell>
                    <TableCell sx={{ width: '90px', fontSize: '1.4rem' }}>Visit</TableCell>
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
                      <TableCell sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="h4" sx={{ 
                          fontWeight: 'bold', 
                          color: '#1976d2',
                          lineHeight: 1,
                          fontSize: '3rem'
                        }}>
                          {encounter.room !== 'N/A' && encounter.room !== 0 ? encounter.room : '-'}
                        </Typography>
                      </TableCell>

                      {/* Patient - Compact */}
                      <TableCell sx={{ py: 1 }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1, fontSize: '1.8rem' }}>
                            {getPatientInitials(encounter.patientInfo.firstName, encounter.patientInfo.lastName)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                            {encounter.patientInfo.gender}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Time - Compact */}
                      <TableCell sx={{ py: 1 }}>
                        <Box>
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontWeight: 'bold',
                              lineHeight: 1,
                              fontSize: '1.4rem',
                              color: 'black'
                            }}
                          >
                            {patientTrackingService.formatAppointmentTime(encounter.appointmentTime)}
                          </Typography>
                          {encounter.arrivalTime && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontSize: '1.1rem',
                                color: 'text.secondary'
                              }}
                            >
                            {patientTrackingService.formatAppointmentTime(encounter.arrivalTime)}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Status - Compact */}
                      <TableCell sx={{ py: 1.5, textAlign: 'center' }}>
                        {getStatusText(encounter.status)}
                      </TableCell>

                      {/* Provider - Compact */}
                      <TableCell sx={{ py: 1 }}>
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
                                      fontSize: '1.3rem',
                                      lineHeight: 1
                                    }}
                                  >
                                    {getProviderTitle(provider)}
                                  </Typography>
                                </Box>
                              ))
                          ) : (
                            <Typography variant="body1" sx={{ fontWeight: 'bold', fontSize: '1.3rem' }}>
                              No staff assigned
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Visit Length - Compact */}
                      <TableCell sx={{ py: 1 }}>
                        <Typography 
                          variant="body1"
                          sx={{
                            fontWeight: 'bold',
                            fontSize: '1.4rem',
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
              <TableRow sx={{ '& th': { backgroundColor: '#f8f9fa', fontWeight: 'bold', py: 1 } }}>
                <TableCell sx={{ width: '60px', textAlign: 'center', fontSize: '1.4rem' }}>Room</TableCell>
                <TableCell sx={{ width: '90px', fontSize: '1.4rem' }}>Patient</TableCell>
                <TableCell sx={{ width: '80px', fontSize: '1.4rem' }}>Time</TableCell>
                <TableCell sx={{ width: '110px', fontSize: '1.4rem', textAlign: 'center' }}>Status</TableCell>
                <TableCell sx={{ width: '150px', fontSize: '1.4rem' }}>Provider</TableCell>
                <TableCell sx={{ width: '90px', fontSize: '1.4rem' }}>Visit</TableCell>
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
                     <TableCell sx={{ textAlign: 'center', py: 1 }}>
                       <Typography variant="h4" sx={{ 
                         fontWeight: 'bold', 
                         color: '#1976d2',
                         lineHeight: 1,
                         fontSize: '3rem'
                       }}>
                         {encounter.room !== 'N/A' && encounter.room !== 0 ? encounter.room : '-'}
                       </Typography>
                     </TableCell>

                     {/* Patient - Compact */}
                     <TableCell sx={{ py: 1 }}>
                       <Box>
                         <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1, fontSize: '1.8rem' }}>
                           {getPatientInitials(encounter.patientInfo.firstName, encounter.patientInfo.lastName)}
                         </Typography>
                         <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                           {encounter.patientInfo.gender}
                         </Typography>
                       </Box>
                     </TableCell>

                     {/* Time - Compact */}
                     <TableCell sx={{ py: 1 }}>
                       <Box>
                         <Typography 
                           variant="body1" 
                           sx={{ 
                             fontWeight: 'bold',
                             lineHeight: 1,
                             fontSize: '1.4rem',
                             color: 'black'
                           }}
                         >
                           {patientTrackingService.formatAppointmentTime(encounter.appointmentTime)}
                         </Typography>
                         {encounter.arrivalTime && (
                           <Typography 
                             variant="body2" 
                             sx={{ 
                               fontSize: '1.1rem',
                               color: 'text.secondary'
                             }}
                           >
                             {patientTrackingService.formatAppointmentTime(encounter.arrivalTime)}
                           </Typography>
                         )}
                       </Box>
                     </TableCell>

                     {/* Status - Compact */}
                     <TableCell sx={{ py: 1.5, textAlign: 'center' }}>
                       {getStatusText(encounter.status)}
                     </TableCell>

                    {/* Provider - Compact */}
                    <TableCell sx={{ py: 1 }}>
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
                                    fontSize: '1.3rem',
                                    lineHeight: 1
                                  }}
                                >
                                  {getProviderTitle(provider)}
                                </Typography>
                              </Box>
                            ))
                        ) : (
                          <Typography variant="body1" sx={{ fontWeight: 'bold', fontSize: '1.3rem' }}>
                            No staff assigned
                          </Typography>
                        )}
                      </Box>
                    </TableCell>

                    {/* Visit Length - Compact */}
                    <TableCell sx={{ py: 1 }}>
                      <Typography 
                        variant="body1"
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '1.4rem',
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