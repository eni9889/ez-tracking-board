import React from 'react';
import {
  Typography,
  Box,
  Alert,
  CircularProgress,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Divider
} from '@mui/material';
import {
  Edit,
  Person,
  CalendarToday,
  CheckCircle,
  Warning,
  Security
} from '@mui/icons-material';
import MobileDialog, { MobileDialogContent, MobileDialogActions } from './MobileDialog';
import useResponsive from '../hooks/useResponsive';

interface MobileSignOffDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  patientName: string;
  dateOfService: string;
  signingOff?: boolean;
}

const MobileSignOffDialog: React.FC<MobileSignOffDialogProps> = ({
  open,
  onClose,
  onConfirm,
  patientName,
  dateOfService,
  signingOff = false
}) => {
  const { isMobile } = useResponsive();

  const handleClose = () => {
    if (!signingOff) {
      onClose();
    }
  };

  return (
    <MobileDialog
      open={open}
      onClose={handleClose}
      title="Sign Off Note"
      icon={<Edit sx={{ color: '#10b981' }} />}
      showCloseButton={!signingOff}
      mobileFullScreen={false}
      desktopMaxWidth="sm"
    >
      <MobileDialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ 
            mb: 2,
            fontSize: isMobile ? '0.9rem' : '1rem',
            lineHeight: 1.5,
            color: 'text.secondary'
          }}>
            Are you sure you want to sign off this note?
          </Typography>
          
          {/* Note Details */}
          <Paper
            sx={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 2,
              p: isMobile ? 2 : 2.5,
              mb: 2
            }}
          >
            <Typography variant="h6" sx={{ 
              fontWeight: 700, 
              mb: 2, 
              color: '#059669',
              fontSize: isMobile ? '1rem' : '1.1rem'
            }}>
              Note Information
            </Typography>
            
            <List sx={{ p: 0 }}>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Person sx={{ color: '#059669', fontSize: '1.1rem' }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600, 
                        fontSize: '0.85rem',
                        color: '#065f46'
                      }}>
                        Patient:
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontSize: '0.85rem',
                        color: '#065f46'
                      }}>
                        {patientName}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CalendarToday sx={{ color: '#059669', fontSize: '1.1rem' }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600, 
                        fontSize: '0.85rem',
                        color: '#065f46'
                      }}>
                        Date of Service:
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontSize: '0.85rem',
                        color: '#065f46'
                      }}>
                        {dateOfService}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            </List>
          </Paper>

          {/* Warning Information */}
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2,
              fontSize: '0.85rem',
              '& .MuiAlert-message': {
                lineHeight: 1.4
              }
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Important:
            </Typography>
            Once signed off, this note will be finalized in the EZDerm system and cannot be easily modified.
          </Alert>

          {/* Security Notice */}
          <Paper
            sx={{
              backgroundColor: '#fafafa',
              border: '1px solid #e0e0e0',
              borderRadius: 2,
              p: isMobile ? 1.5 : 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Security sx={{ color: '#666', fontSize: '1rem' }} />
              <Typography variant="body2" sx={{ 
                fontWeight: 600,
                fontSize: '0.8rem',
                color: '#666'
              }}>
                Digital Signature
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ 
              color: '#666',
              fontSize: '0.75rem',
              lineHeight: 1.3,
              display: 'block'
            }}>
              By signing off, you are electronically signing this note and confirming its accuracy and completeness.
            </Typography>
          </Paper>
        </Box>
      </MobileDialogContent>

      <MobileDialogActions orientation={isMobile ? 'vertical' : 'horizontal'}>
        <Button
          onClick={handleClose}
          disabled={signingOff}
          sx={{
            color: '#64748b',
            '&:hover': { backgroundColor: '#f1f5f9' },
            '&:disabled': { color: '#94a3b8' }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={signingOff}
          startIcon={signingOff ? <CircularProgress size={16} color="inherit" /> : <Edit />}
          sx={{
            backgroundColor: '#10b981',
            color: 'white',
            border: '1px solid #059669',
            '&:hover': {
              backgroundColor: '#059669',
              borderColor: '#047857'
            },
            '&:disabled': {
              backgroundColor: '#64748b',
              borderColor: '#475569',
              color: '#e2e8f0'
            }
          }}
        >
          {signingOff ? 'Signing Off...' : 'Sign Off Note'}
        </Button>
      </MobileDialogActions>
    </MobileDialog>
  );
};

export default MobileSignOffDialog;
