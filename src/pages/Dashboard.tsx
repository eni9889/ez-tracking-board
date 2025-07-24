import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  SelectChangeEvent,
  AppBar,
  Toolbar
} from '@mui/material';
import {
  Refresh,
  Today,
  ExitToApp,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { PatientCard } from '../components/PatientCard';
import patientTrackingService from '../services/patientTracking.service';
import { SchedulerData, AppointmentStatus, ClinicInfo } from '../types/api.types';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [appointments, setAppointments] = useState<SchedulerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<string>('');
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [useMockData, setUseMockData] = useState(false);

  // Load clinics on mount
  useEffect(() => {
    const loadClinics = async () => {
      if (!user?.clinicIds || user.clinicIds.length === 0) {
        // Use mock clinics if user has no clinics
        setClinics([
          { id: '1', name: 'Main Dermatology Clinic' },
          { id: '2', name: 'West Side Clinic' }
        ]);
        setSelectedClinic('1');
        return;
      }

      try {
        const practiceInfo = await patientTrackingService.getPracticeInfo();
        const userClinics = practiceInfo.clinics.filter(clinic => 
          user.clinicIds.includes(clinic.id)
        );
        setClinics(userClinics);
        if (userClinics.length > 0) {
          setSelectedClinic(userClinics[0].id);
        }
      } catch (error) {
        console.error('Failed to load clinics:', error);
        // Use mock clinics on error
        setClinics([
          { id: '1', name: 'Main Dermatology Clinic' },
          { id: '2', name: 'West Side Clinic' }
        ]);
        setSelectedClinic('1');
      }
    };

    loadClinics();
  }, [user]);

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    if (!selectedClinic) return;

    setLoading(true);
    setError(null);

          try {
        let data: SchedulerData[];
        if (useMockData) {
          // Use mock data for testing
          data = patientTrackingService.generateMockSchedulerData(20);
        } else {
          // Fetch enhanced data that includes encounter information
          data = await patientTrackingService.getEnhancedSchedulerData(selectedClinic, new Date());
        }
        setAppointments(data);
        setLastUpdate(new Date());
      } catch (error: any) {
        console.error('Failed to fetch appointments:', error);
        setError('Failed to load appointments. Using mock data instead.');
        // Fall back to mock data
        const mockData = patientTrackingService.generateMockSchedulerData(20);
        setAppointments(mockData);
        setUseMockData(true);
      } finally {
        setLoading(false);
      }
  }, [selectedClinic, useMockData, user]);

  // Initial fetch and polling
  useEffect(() => {
    fetchAppointments();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchAppointments, 30000);

    return () => clearInterval(interval);
  }, [fetchAppointments]);

  // Filter appointments
  const filteredAppointments = appointments.filter(apt => {
    if (statusFilter === 'ALL') return true;
    return apt.status === statusFilter;
  });

  // Count by status
  const statusCounts = appointments.reduce((acc, apt) => {
    acc[apt.status] = (acc[apt.status] || 0) + 1;
    return acc;
  }, {} as Record<AppointmentStatus, number>);

  const handleClinicChange = (event: SelectChangeEvent) => {
    setSelectedClinic(event.target.value);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value as AppointmentStatus | 'ALL');
  };

  const handleEditAppointment = (appointment: SchedulerData) => {
    // TODO: Implement edit functionality
    console.log('Edit appointment:', appointment);
  };

  const toggleMockData = () => {
    setUseMockData(!useMockData);
  };

  return (
    <>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            EZ Patient Tracking Dashboard
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            Welcome, {user?.firstName} {user?.lastName}
          </Typography>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={logout}>
              <ExitToApp />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Header Section */}
        <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Today color="primary" />
              <Typography variant="h5">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </Typography>
            </Box>

            <Box display="flex" gap={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Clinic</InputLabel>
                <Select
                  value={selectedClinic}
                  onChange={handleClinicChange}
                  label="Clinic"
                >
                  {clinics.map(clinic => (
                    <MenuItem key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={handleStatusFilterChange}
                  label="Status Filter"
                >
                  <MenuItem value="ALL">All Status</MenuItem>
                  {Object.values(AppointmentStatus).map(status => (
                    <MenuItem key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Tooltip title="Refresh">
                <IconButton onClick={fetchAppointments} disabled={loading}>
                  <Refresh />
                </IconButton>
              </Tooltip>

              {process.env.NODE_ENV === 'development' && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={toggleMockData}
                  color={useMockData ? 'warning' : 'primary'}
                >
                  {useMockData ? 'Using Mock Data' : 'Using Live Data'}
                </Button>
              )}
            </Box>
          </Box>

          {/* Status Summary */}
          <Box display="flex" gap={1} mt={2} flexWrap="wrap">
            <Chip
              label={`Total: ${appointments.length}`}
              size="small"
              color="default"
              variant={statusFilter === 'ALL' ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter('ALL')}
            />
            {Object.values(AppointmentStatus).map(status => {
              const count = statusCounts[status] || 0;
              if (count === 0) return null;
              return (
                <Chip
                  key={status}
                  label={`${status.replace(/_/g, ' ')}: ${count}`}
                  size="small"
                  color={statusFilter === status ? 'primary' : 'default'}
                  variant={statusFilter === status ? 'filled' : 'outlined'}
                  onClick={() => setStatusFilter(status)}
                />
              );
            })}
          </Box>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Development Info */}
        {process.env.NODE_ENV === 'development' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Development Mode:</strong> This dashboard is designed to work with the EZDerm API. 
              {useMockData 
                ? ' Currently displaying mock patient data for demonstration purposes.' 
                : ' Connected to live API data.'
              }
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Use the "Using Live/Mock Data" button to toggle between real API calls and mock data for testing.
            </Typography>
          </Alert>
        )}

        {/* Loading State */}
        {loading && appointments.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
            <CircularProgress />
          </Box>
        ) : filteredAppointments.length === 0 ? (
          <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No appointments found for the selected criteria
            </Typography>
          </Paper>
        ) : (
          <>
            {/* Patient Cards */}
            <Box>
              {filteredAppointments.map(appointment => (
                <PatientCard
                  key={appointment.id}
                  appointment={appointment}
                  onEdit={handleEditAppointment}
                />
              ))}
            </Box>

            {/* Last Update */}
            <Box mt={3} mb={2} textAlign="center">
              <Typography variant="caption" color="text.secondary">
                Last updated: {format(lastUpdate, 'h:mm:ss a')}
                {!useMockData ? ' • Enhanced with encounter data' : ' • Using mock data'}
                {process.env.NODE_ENV === 'development' && ' • Development Mode'}
              </Typography>
            </Box>
          </>
        )}
      </Container>
    </>
  );
};

export default Dashboard; 