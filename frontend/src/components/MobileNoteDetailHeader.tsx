import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Stack,
  Collapse
} from '@mui/material';
import {
  ArrowBack,
  Psychology,
  Refresh,
  Assignment,
  Edit,
  NavigateBefore,
  NavigateNext,
  MoreVert,
  CheckCircle,
  Person,
  Schedule,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import useResponsive from '../hooks/useResponsive';
import aiNoteCheckerService from '../services/aiNoteChecker.service';

interface MobileNoteDetailHeaderProps {
  // Patient and note info
  patientName: string;
  chiefComplaint: string;
  dateOfService: string;
  noteSignedOff?: boolean;
  signOffInfo?: string | null;
  
  // Navigation
  currentIndex: number;
  totalNotes: number;
  filterContext?: string;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  
  // Actions
  onRunCheck: () => void;
  onCreateToDo?: () => void;
  onSignOff?: () => void;
  onRefresh: () => void;
  
  // State
  checking?: boolean;
  loading?: boolean;
  forceNewCheck?: boolean;
  onForceNewCheckChange?: (checked: boolean) => void;
  
  // ToDo status
  todoCreated?: boolean;
  todoCount?: number;
  
  // Capabilities
  canSignOff?: boolean;
  canCreateToDo?: boolean;
}

const MobileNoteDetailHeader: React.FC<MobileNoteDetailHeaderProps> = ({
  patientName,
  chiefComplaint,
  dateOfService,
  noteSignedOff = false,
  signOffInfo,
  currentIndex,
  totalNotes,
  filterContext,
  onBack,
  onPrevious,
  onNext,
  onRunCheck,
  onCreateToDo,
  onSignOff,
  onRefresh,
  checking = false,
  loading = false,
  forceNewCheck = false,
  onForceNewCheckChange,
  todoCreated = false,
  todoCount = 0,
  canSignOff = false,
  canCreateToDo = false
}) => {
  const { isMobile, isSmallMobile } = useResponsive();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const getPatientInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getFilterLabel = () => {
    switch (filterContext) {
      case 'issues': return 'with issues';
      case 'clean': return 'clean';
      case 'unchecked': return 'unchecked';
      case 'issues-no-todos': return 'with issues (no ToDos)';
      default: return '';
    }
  };

  return (
    <Box sx={{ 
      backgroundColor: '#0a0a0a', 
      color: 'white',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      borderBottom: '1px solid #1a1a1a'
    }}>
      {/* Compact Main Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1,
        minHeight: '56px'
      }}>
        {/* Left Section - Back Button */}
        <Tooltip title="Back to Note List">
          <IconButton
            onClick={onBack}
            size="small"
            sx={{ 
              color: '#f8fafc',
              backgroundColor: '#2a2a2a',
              border: '1px solid #3a3a3a',
              borderRadius: 2,
              p: 0.75,
              minWidth: '36px',
              minHeight: '36px',
              '&:hover': {
                backgroundColor: '#3a3a3a',
                borderColor: '#4a4a4a'
              }
            }}
          >
            <ArrowBack sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Tooltip>

        {/* Center Section - Compact Patient Info */}
        <Box sx={{ 
          flex: 1, 
          mx: 1.5, 
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              backgroundColor: '#3b82f6',
              fontSize: '0.8rem',
              fontWeight: 700
            }}
          >
            {getPatientInitials(patientName)}
          </Avatar>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1" sx={{ 
                fontWeight: 700, 
                lineHeight: 1.2,
                color: '#f8fafc',
                fontSize: '0.95rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}>
                {patientName}
              </Typography>
              
              {noteSignedOff && (
                <Chip
                  icon={<CheckCircle />}
                  label="SIGNED"
                  size="small"
                  sx={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                    height: '18px',
                    '& .MuiChip-icon': {
                      color: 'white',
                      fontSize: '0.7rem'
                    }
                  }}
                />
              )}
            </Box>
            
            <Typography variant="caption" sx={{ 
              color: '#94a3b8',
              fontSize: '0.75rem',
              lineHeight: 1,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {chiefComplaint}
            </Typography>
            <Typography variant="caption" sx={{ 
              color: '#94a3b8',
              fontSize: '0.7rem',
              lineHeight: 1,
              display: 'block',
              opacity: 0.8,
              mt: 0.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              Service: {aiNoteCheckerService.formatTimeAgo(dateOfService)} • {aiNoteCheckerService.formatDate(dateOfService)}
            </Typography>
          </Box>
        </Box>

        {/* Filter Context Indicator */}
        {filterContext && filterContext !== 'all' && (
          <Box sx={{
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            borderRadius: 1,
            px: 1,
            py: 0.25,
            mr: 1
          }}>
            <Typography variant="caption" sx={{ 
              color: '#94a3b8',
              fontSize: '0.65rem',
              fontWeight: 600
            }}>
              {getFilterLabel()}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Compact Navigation & Actions Bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
        backgroundColor: '#1a1a1a',
        borderTop: '1px solid #2a2a2a',
        gap: 1
      }}>
        {/* Navigation Controls */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          backgroundColor: '#0f0f0f',
          border: '1px solid #2a2a2a',
          borderRadius: 2,
          px: 2,
          py: 0.75
        }}>
          <Tooltip title="Previous note">
            <IconButton
              onClick={onPrevious}
              disabled={currentIndex <= 0}
              size="small"
              sx={{ 
                color: currentIndex <= 0 ? '#64748b' : '#f8fafc',
                p: 0.5,
                '&:disabled': {
                  color: '#64748b',
                }
              }}
            >
              <NavigateBefore sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
          
          <Box sx={{ 
            textAlign: 'center',
            px: 1,
            minWidth: '60px'
          }}>
            <Typography variant="caption" sx={{ 
              color: '#f8fafc',
              fontSize: '0.8rem',
              fontWeight: 600,
              lineHeight: 1
            }}>
              {currentIndex + 1}/{totalNotes}
            </Typography>
          </Box>
          
          <Tooltip title="Next note">
            <IconButton
              onClick={onNext}
              disabled={currentIndex >= totalNotes - 1}
              size="small"
              sx={{ 
                color: currentIndex >= totalNotes - 1 ? '#64748b' : '#f8fafc',
                p: 0.5,
                '&:disabled': {
                  color: '#64748b',
                }
              }}
            >
              <NavigateNext sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Quick Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* AI Check Button */}
          <Tooltip title={checking ? 'Analyzing...' : 'Run AI Check'}>
            <IconButton
              onClick={onRunCheck}
              disabled={checking}
              size="small"
              sx={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: '1px solid #2563eb',
                borderRadius: 2,
                p: 0.75,
                minWidth: '36px',
                minHeight: '36px',
                '&:hover': {
                  backgroundColor: '#2563eb',
                },
                '&:disabled': {
                  backgroundColor: '#64748b',
                  borderColor: '#475569',
                }
              }}
            >
              {checking ? (
                <CircularProgress size={16} sx={{ color: 'white' }} />
              ) : (
                <Psychology sx={{ fontSize: '1rem' }} />
              )}
            </IconButton>
          </Tooltip>

          {/* Create ToDo Button - only show if there are issues and no ToDo created */}
          {canCreateToDo && !todoCreated && (
            <Tooltip title="Create ToDo">
              <IconButton
                onClick={onCreateToDo}
                size="small"
                sx={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: '1px solid #d97706',
                  borderRadius: 2,
                  p: 0.75,
                  minWidth: '36px',
                  minHeight: '36px',
                  '&:hover': {
                    backgroundColor: '#d97706',
                  }
                }}
              >
                <Assignment sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Tooltip>
          )}

          {/* ToDo Created Indicator */}
          {todoCreated && (
            <Tooltip title={`ToDo Created${todoCount > 1 ? ` (${todoCount})` : ''}`}>
              <Box sx={{
                backgroundColor: '#10b981',
                color: 'white',
                border: '1px solid #059669',
                borderRadius: 2,
                p: 0.75,
                minWidth: '36px',
                minHeight: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle sx={{ fontSize: '1rem' }} />
              </Box>
            </Tooltip>
          )}

          {/* Sign Off Button - only show if user can sign off and note isn't signed off */}
          {canSignOff && !noteSignedOff && (
            <Tooltip title="Sign Off Note">
              <IconButton
                onClick={onSignOff}
                size="small"
                sx={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: '1px solid #059669',
                  borderRadius: 2,
                  p: 0.75,
                  minWidth: '36px',
                  minHeight: '36px',
                  '&:hover': {
                    backgroundColor: '#059669',
                  }
                }}
              >
                <Edit sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Menu Button for overflow actions */}
          <IconButton
            onClick={handleMenuOpen}
            size="small"
            sx={{ 
              color: '#f8fafc',
              backgroundColor: '#2a2a2a',
              border: '1px solid #3a3a3a',
              borderRadius: 2,
              p: 0.75,
              minWidth: '36px',
              minHeight: '36px',
              '&:hover': {
                backgroundColor: '#3a3a3a',
              }
            }}
          >
            <MoreVert sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Box>
      </Box>

      {/* Expandable Details */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Button
          onClick={() => setShowDetails(!showDetails)}
          startIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
          sx={{
            color: '#94a3b8',
            fontSize: '0.8rem',
            fontWeight: 500,
            textTransform: 'none',
            p: 0.5,
            minHeight: 'auto'
          }}
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </Button>

        <Collapse in={showDetails}>
          <Box sx={{ 
            mt: 1, 
            p: 2, 
            backgroundColor: '#1a1a1a',
            borderRadius: 2,
            border: '1px solid #2a2a2a'
          }}>
            <Typography variant="body2" sx={{ 
              color: '#e2e8f0',
              fontSize: '0.85rem',
              mb: 1,
              lineHeight: 1.4
            }}>
              <strong>Chief Complaint:</strong> {chiefComplaint}
            </Typography>
            
            {signOffInfo && (
              <Typography variant="body2" sx={{ 
                color: '#10b981',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre-line',
                mt: 1,
                p: 1,
                backgroundColor: '#0f1f0f',
                borderRadius: 1,
                border: '1px solid #10b98130'
              }}>
                {signOffInfo}
              </Typography>
            )}
          </Box>
        </Collapse>
      </Box>

      {/* Actions Menu - Secondary Actions Only */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            color: '#f8fafc',
            border: '1px solid #2a2a2a',
            minWidth: 180
          }
        }}
      >
        {onForceNewCheckChange && (
          <MenuItem>
            <FormControlLabel
              control={
                <Checkbox
                  checked={forceNewCheck}
                  onChange={(e) => onForceNewCheckChange(e.target.checked)}
                  size="small"
                  sx={{ 
                    color: '#94a3b8', 
                    '&.Mui-checked': { color: '#3b82f6' }
                  }}
                />
              }
              label="Force New Check"
              sx={{ 
                color: '#e2e8f0', 
                fontSize: '0.85rem',
                '& .MuiFormControlLabel-label': { fontSize: '0.85rem' }
              }}
            />
          </MenuItem>
        )}

        {onForceNewCheckChange && <Divider sx={{ backgroundColor: '#2a2a2a' }} />}

        <MenuItem onClick={() => { onRefresh(); handleMenuClose(); }}>
          <ListItemIcon>
            {loading ? (
              <CircularProgress size={20} sx={{ color: '#64748b' }} />
            ) : (
              <Refresh sx={{ color: '#64748b' }} />
            )}
          </ListItemIcon>
          <ListItemText primary="Refresh" />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default MobileNoteDetailHeader;
