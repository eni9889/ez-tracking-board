import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Avatar,
  Stack,
  Tooltip,
  Checkbox,
  Collapse,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Psychology,
  Person,
  Schedule,
  Assignment,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  ExpandMore,
  ExpandLess,
  Circle
} from '@mui/icons-material';
import aiNoteCheckerService from '../services/aiNoteChecker.service';

interface IncompleteNote {
  encounterId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  dateOfService: string;
  status: string;
  lastCheckStatus?: string | null;
  lastCheckDate?: string | null;
  issuesFound?: boolean;
  todoCreated?: boolean;
  todoCount?: number;
  hasValidIssues?: boolean;
}

interface NoteCardProps {
  note: IncompleteNote;
  isSelected?: boolean;
  isChecking?: boolean;
  onSelect?: (encounterId: string, checked: boolean) => void;
  onCheck?: (note: IncompleteNote) => void;
  onView?: (note: IncompleteNote) => void;
  showSelection?: boolean;
  expanded?: boolean;
  onToggleExpand?: (encounterId: string) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isSelected = false,
  isChecking = false,
  onSelect,
  onCheck,
  onView,
  showSelection = false,
  expanded = false,
  onToggleExpand
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_COSIGN': return '#f59e0b';
      case 'CHECKED_OUT': return '#3b82f6';
      case 'WITH_PROVIDER': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  const getAIStatusInfo = () => {
    if (isChecking) {
      return {
        icon: <Psychology sx={{ color: '#3b82f6' }} />,
        label: 'Checking...',
        color: '#3b82f6',
        bgColor: '#dbeafe'
      };
    }

    if (!note.lastCheckStatus) {
      return {
        icon: <Circle sx={{ color: '#94a3b8' }} />,
        label: 'Not Checked',
        color: '#64748b',
        bgColor: '#f1f5f9'
      };
    }

    if (note.lastCheckStatus === 'error') {
      return {
        icon: <ErrorIcon sx={{ color: '#ef4444' }} />,
        label: 'Error',
        color: '#ef4444',
        bgColor: '#fef2f2'
      };
    }

    if (note.issuesFound) {
      return {
        icon: <Warning sx={{ color: '#f59e0b' }} />,
        label: 'Issues Found',
        color: '#f59e0b',
        bgColor: '#fefbeb'
      };
    }

    return {
      icon: <CheckCircle sx={{ color: '#10b981' }} />,
      label: 'Clean',
      color: '#10b981',
      bgColor: '#f0fdf4'
    };
  };

  const aiStatus = getAIStatusInfo();

  const getPatientInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input[type="checkbox"]')) {
      return;
    }
    onView?.(note);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand?.(note.encounterId);
  };

  return (
    <Card
      sx={{
        mb: 1,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
        backgroundColor: isSelected ? '#f0f9ff' : 'white',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          transform: 'translateY(-1px)'
        },
        '&:active': {
          transform: 'translateY(0)'
        }
      }}
      onClick={handleCardClick}
    >
      {/* Progress bar for checking state */}
      {isChecking && (
        <LinearProgress 
          sx={{ 
            height: 2,
            backgroundColor: '#e2e8f0',
            '& .MuiLinearProgress-bar': {
              backgroundColor: '#3b82f6'
            }
          }} 
        />
      )}

      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header Row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.5 }}>
          {/* Patient Avatar */}
          <Avatar
            sx={{
              width: 48,
              height: 48,
              backgroundColor: getStatusColor(note.status),
              fontSize: '1rem',
              fontWeight: 700
            }}
          >
            {getPatientInitials(note.patientName)}
          </Avatar>

          {/* Main Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 700,
                fontSize: '1.1rem',
                lineHeight: 1.2,
                color: '#1e293b'
              }}>
                {note.patientName}
              </Typography>
              {showSelection && (
                <Checkbox
                  size="small"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelect?.(note.encounterId, e.target.checked);
                  }}
                  sx={{ ml: 'auto', p: 0.5 }}
                />
              )}
            </Box>

            <Typography variant="body2" sx={{ 
              color: '#64748b',
              fontSize: '0.9rem',
              mb: 0.5,
              lineHeight: 1.3
            }}>
              {note.chiefComplaint}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={note.status}
                size="small"
                sx={{
                  backgroundColor: `${getStatusColor(note.status)}15`,
                  color: getStatusColor(note.status),
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: '24px'
                }}
              />
              <Typography variant="caption" sx={{ 
                color: '#94a3b8',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}>
                <Schedule sx={{ fontSize: '0.9rem' }} />
                {aiNoteCheckerService.formatTimeAgo(note.dateOfService)}
              </Typography>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Run AI Check">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onCheck?.(note);
                }}
                disabled={isChecking}
                sx={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  width: 36,
                  height: 36,
                  '&:hover': {
                    backgroundColor: '#2563eb'
                  },
                  '&:disabled': {
                    backgroundColor: '#94a3b8'
                  }
                }}
              >
                <Psychology sx={{ fontSize: '1.1rem' }} />
              </IconButton>
            </Tooltip>

            {onToggleExpand && (
              <IconButton
                size="small"
                onClick={handleExpandClick}
                sx={{
                  color: '#64748b',
                  width: 32,
                  height: 32,
                  '&:hover': {
                    backgroundColor: '#f1f5f9'
                  }
                }}
              >
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            )}
          </Box>
        </Box>

        {/* AI Status Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: expanded ? 1 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                backgroundColor: aiStatus.bgColor,
                border: `1px solid ${aiStatus.color}30`
              }}
            >
              {aiStatus.icon}
              <Typography variant="body2" sx={{ 
                fontWeight: 600,
                color: aiStatus.color,
                fontSize: '0.85rem'
              }}>
                {aiStatus.label}
              </Typography>
            </Box>

            {note.lastCheckDate && !isChecking && (
              <Typography variant="caption" sx={{ 
                color: '#94a3b8',
                fontSize: '0.75rem'
              }}>
                {aiNoteCheckerService.formatTimeAgo(note.lastCheckDate)}
              </Typography>
            )}
          </Box>

          {/* ToDo Status */}
          {note.todoCreated && (
            <Chip
              icon={<Assignment />}
              label={note.todoCount && note.todoCount > 1 ? `${note.todoCount} ToDos` : 'ToDo'}
              size="small"
              sx={{
                backgroundColor: '#10b98115',
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.75rem',
                '& .MuiChip-icon': {
                  color: '#10b981'
                }
              }}
            />
          )}
        </Box>

        {/* Expanded Details */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            <Box>
              <Typography variant="caption" sx={{ 
                color: '#64748b',
                fontWeight: 600,
                textTransform: 'uppercase',
                fontSize: '0.7rem',
                letterSpacing: '0.05em'
              }}>
                Encounter Details
              </Typography>
              <Typography variant="body2" sx={{ 
                color: '#374151',
                fontSize: '0.85rem',
                mt: 0.5
              }}>
                ID: {note.encounterId.substring(0, 8)}...
              </Typography>
            </Box>

            {note.lastCheckStatus === 'completed' && note.issuesFound && (
              <Box>
                <Typography variant="caption" sx={{ 
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                  letterSpacing: '0.05em'
                }}>
                  Issues Status
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Warning sx={{ fontSize: '1rem', color: '#f59e0b' }} />
                  <Typography variant="body2" sx={{ 
                    color: '#f59e0b',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}>
                    {note.hasValidIssues ? 'Valid issues found' : 'All issues marked invalid'}
                  </Typography>
                </Box>
              </Box>
            )}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default NoteCard;
