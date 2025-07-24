import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  AccessTime,
  Person,
  MeetingRoom,
  LocalHospital,
  CheckCircle,
  Schedule,
  Edit
} from '@mui/icons-material';
import { format } from 'date-fns';
import { SchedulerData, AppointmentStatus } from '../types/api.types';

interface PatientCardProps {
  appointment: SchedulerData;
  onEdit?: (appointment: SchedulerData) => void;
}

const getStatusColor = (status: AppointmentStatus): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status) {
    case AppointmentStatus.SCHEDULED:
      return 'default';
    case AppointmentStatus.CHECKED_IN:
      return 'info';
    case AppointmentStatus.IN_ROOM:
      return 'warning';
    case AppointmentStatus.WITH_PROVIDER:
      return 'primary';
    case AppointmentStatus.CHECKED_OUT:
      return 'success';
    case AppointmentStatus.CANCELLED:
    case AppointmentStatus.NO_SHOW:
      return 'error';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: AppointmentStatus) => {
  switch (status) {
    case AppointmentStatus.SCHEDULED:
      return <Schedule />;
    case AppointmentStatus.CHECKED_IN:
      return <Person />;
    case AppointmentStatus.IN_ROOM:
      return <MeetingRoom />;
    case AppointmentStatus.WITH_PROVIDER:
      return <LocalHospital />;
    case AppointmentStatus.CHECKED_OUT:
      return <CheckCircle />;
    default:
      return <AccessTime />;
  }
};

const formatWaitTime = (checkInTime?: string): string => {
  if (!checkInTime) return '';
  const waitMinutes = Math.floor((Date.now() - new Date(checkInTime).getTime()) / 60000);
  if (waitMinutes < 60) return `${waitMinutes}m`;
  return `${Math.floor(waitMinutes / 60)}h ${waitMinutes % 60}m`;
};

export const PatientCard: React.FC<PatientCardProps> = ({ appointment, onEdit }) => {
  const { patientInfo, providerInfo, status, roomNumber, checkInTime } = appointment;
  const appointmentTime = new Date(appointment.dateOfService);
  const waitTime = formatWaitTime(checkInTime);
  const roomDisplay = roomNumber || (appointment.room && appointment.room > 0 ? appointment.room.toString() : null);

  return (
    <Card
      sx={{
        mb: 2,
        borderLeft: 6,
        borderColor: `${getStatusColor(status)}.main`,
        '&:hover': {
          boxShadow: 3,
          bgcolor: 'action.hover'
        }
      }}
    >
      <CardContent>
        <Box
          display="flex"
          flexDirection={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          gap={2}
        >
          <Box display="flex" alignItems="center" gap={2} flex="1 1 auto" minWidth="200px">
            <Avatar sx={{ bgcolor: `${getStatusColor(status)}.main` }}>
              {patientInfo.firstName[0]}{patientInfo.lastName[0]}
            </Avatar>
            <Box>
              <Typography variant="h6" component="div">
                {patientInfo.firstName} {patientInfo.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                MRN: {patientInfo.mrn}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1} minWidth="100px">
            <AccessTime fontSize="small" color="action" />
            <Box>
              <Typography variant="body2" fontWeight="bold">
                {format(appointmentTime, 'h:mm a')}
              </Typography>
              {waitTime && status !== AppointmentStatus.SCHEDULED && (
                <Typography variant="caption" color="text.secondary">
                  Wait: {waitTime}
                </Typography>
              )}
            </Box>
          </Box>

          <Box minWidth="140px">
            <Chip
              icon={getStatusIcon(status)}
              label={status.replace(/_/g, ' ')}
              color={getStatusColor(status)}
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>

          {roomDisplay && (
            <Box display="flex" alignItems="center" gap={1} minWidth="80px">
              <MeetingRoom fontSize="small" color="action" />
              <Typography variant="body2">Room {roomDisplay}</Typography>
            </Box>
          )}

          {providerInfo && (
            <Box display="flex" alignItems="center" gap={1} minWidth="120px">
              <LocalHospital fontSize="small" color="action" />
              <Typography variant="body2">
                {providerInfo.title} {providerInfo.lastName}
              </Typography>
            </Box>
          )}

          {onEdit && (
            <Box>
              <Tooltip title="Edit appointment">
                <IconButton
                  size="small"
                  onClick={() => onEdit(appointment)}
                  color="primary"
                >
                  <Edit />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        {appointment.chiefComplaint && (
          <Box mt={1}>
            <Typography variant="caption" color="text.secondary">
              Chief Complaint: {appointment.chiefComplaint}
            </Typography>
          </Box>
        )}

        {/* Enhanced encounter information */}
        <Box display="flex" flexWrap="wrap" gap={2} mt={1}>
          {appointment.checkInTime && (
            <Typography variant="caption" color="text.secondary">
              Checked In: {format(new Date(appointment.checkInTime), 'h:mm a')}
            </Typography>
          )}
          {appointment.roomTime && (
            <Typography variant="caption" color="text.secondary">
              In Room: {format(new Date(appointment.roomTime), 'h:mm a')}
            </Typography>
          )}
          {appointment.providerTime && (
            <Typography variant="caption" color="text.secondary">
              With Provider: {format(new Date(appointment.providerTime), 'h:mm a')}
            </Typography>
          )}
          {appointment.checkOutTime && (
            <Typography variant="caption" color="text.secondary">
              Checked Out: {format(new Date(appointment.checkOutTime), 'h:mm a')}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}; 