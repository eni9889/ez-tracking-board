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
      {/* Main Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
        minHeight: '64px'
      }}>
        {/* Left Section - Back Button */}
        <Tooltip title="Back to Note List">
          <IconButton
            onClick={onBack}
            sx={{ 
              color: '#f8fafc',
              backgroundColor: '#2a2a2a',
              border: '1px solid #3a3a3a',
              borderRadius: 2,
              p: 1,
              '&:hover': {
                backgroundColor: '#3a3a3a',
                borderColor: '#4a4a4a'
              }
            }}
          >
            <ArrowBack sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Tooltip>

        {/* Center Section - Patient Info */}
        <Box sx={{ 
          flex: 1, 
          mx: 2, 
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              backgroundColor: '#3b82f6',
              fontSize: '0.9rem',
              fontWeight: 700
            }}
          >
            {getPatientInitials(patientName)}
          </Avatar>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 700, 
              lineHeight: 1.2,
              color: '#f8fafc',
              fontSize: isSmallMobile ? '1rem' : '1.1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {patientName}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {noteSignedOff && (
                <Chip
                  icon={<CheckCircle />}
                  label="SIGNED"
                  size="small"
                  sx={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: '20px',
                    '& .MuiChip-icon': {
                      color: 'white',
                      fontSize: '0.8rem'
                    }
                  }}
                />
              )}
              
              <Typography variant="caption" sx={{ 
                color: '#94a3b8',
                fontSize: '0.75rem'
              }}>
                {aiNoteCheckerService.formatTimeAgo(dateOfService)}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Right Section - Menu */}
        <IconButton
          onClick={handleMenuOpen}
          sx={{ 
            color: '#f8fafc',
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            borderRadius: 2,
            p: 1,
            '&:hover': {
              backgroundColor: '#3a3a3a',
              borderColor: '#4a4a4a'
            }
          }}
        >
          <MoreVert sx={{ fontSize: '1.1rem' }} />
        </IconButton>
      </Box>

      {/* Navigation Bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 1,
        backgroundColor: '#1a1a1a',
        borderTop: '1px solid #2a2a2a'
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          backgroundColor: '#0f0f0f',
          border: '1px solid #2a2a2a',
          borderRadius: 3,
          px: 3,
          py: 1
        }}>
          <Tooltip title="Previous note">
            <IconButton
              onClick={onPrevious}
              disabled={currentIndex <= 0}
              sx={{ 
                color: currentIndex <= 0 ? '#64748b' : '#f8fafc',
                backgroundColor: currentIndex <= 0 ? 'transparent' : '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: 2,
                p: 0.75,
                '&:hover': { 
                  backgroundColor: currentIndex <= 0 ? 'transparent' : '#3a3a3a',
                },
                '&:disabled': {
                  color: '#64748b',
                  backgroundColor: 'transparent',
                }
              }}
            >
              <NavigateBefore sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
          
          <Box sx={{ 
            textAlign: 'center',
            px: 2,
            py: 0.5,
          }}>
            <Typography variant="body2" sx={{ 
              color: '#f8fafc',
              fontSize: '0.85rem',
              fontWeight: 600,
              lineHeight: 1.2
            }}>
              {currentIndex + 1} / {totalNotes}
            </Typography>
            {filterContext && filterContext !== 'all' && (
              <Typography variant="caption" sx={{ 
                color: '#94a3b8',
                fontSize: '0.7rem',
                display: 'block'
              }}>
                {getFilterLabel()} notes
              </Typography>
            )}
          </Box>
          
          <Tooltip title="Next note">
            <IconButton
              onClick={onNext}
              disabled={currentIndex >= totalNotes - 1}
              sx={{ 
                color: currentIndex >= totalNotes - 1 ? '#64748b' : '#f8fafc',
                backgroundColor: currentIndex >= totalNotes - 1 ? 'transparent' : '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: 2,
                p: 0.75,
                '&:hover': { 
                  backgroundColor: currentIndex >= totalNotes - 1 ? 'transparent' : '#3a3a3a',
                },
                '&:disabled': {
                  color: '#64748b',
                  backgroundColor: 'transparent',
                }
              }}
            >
              <NavigateNext sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
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

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            color: '#f8fafc',
            border: '1px solid #2a2a2a',
            minWidth: 200
          }
        }}
      >
        <MenuItem onClick={() => { onRunCheck(); handleMenuClose(); }}>
          <ListItemIcon>
            {checking ? (
              <CircularProgress size={20} sx={{ color: '#3b82f6' }} />
            ) : (
              <Psychology sx={{ color: '#3b82f6' }} />
            )}
          </ListItemIcon>
          <ListItemText 
            primary={checking ? 'Analyzing...' : 'Run AI Check'}
            secondary={forceNewCheck ? 'Force new check' : undefined}
          />
        </MenuItem>

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

        <Divider sx={{ backgroundColor: '#2a2a2a' }} />

        {canCreateToDo && !todoCreated && (
          <MenuItem onClick={() => { onCreateToDo?.(); handleMenuClose(); }}>
            <ListItemIcon>
              <Assignment sx={{ color: '#f59e0b' }} />
            </ListItemIcon>
            <ListItemText primary="Create ToDo" />
          </MenuItem>
        )}

        {todoCreated && (
          <MenuItem disabled>
            <ListItemIcon>
              <CheckCircle sx={{ color: '#10b981' }} />
            </ListItemIcon>
            <ListItemText 
              primary={`ToDo Created${todoCount > 1 ? ` (${todoCount})` : ''}`}
            />
          </MenuItem>
        )}

        {canSignOff && !noteSignedOff && (
          <MenuItem onClick={() => { onSignOff?.(); handleMenuClose(); }}>
            <ListItemIcon>
              <Edit sx={{ color: '#10b981' }} />
            </ListItemIcon>
            <ListItemText primary="Sign Off Note" />
          </MenuItem>
        )}

        <Divider sx={{ backgroundColor: '#2a2a2a' }} />

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
