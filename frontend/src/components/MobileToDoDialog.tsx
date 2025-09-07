import React from 'react';
import {
  Typography,
  Box,
  Stack,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Assignment,
  CheckCircleOutline,
  ErrorOutline,
  Person,
  CalendarToday,
  Description,
  Warning,
  CheckCircle
} from '@mui/icons-material';
import MobileDialog, { MobileDialogContent, MobileDialogActions } from './MobileDialog';
import useResponsive from '../hooks/useResponsive';

interface ToDoPreviewData {
  patientName: string;
  dateOfService: string;
  assignedToName: string;
  issues: Array<{
    issue: string;
    assessment: string;
    details: {
      correction: string;
    };
  }>;
}

interface MobileToDoDialogProps {
  open: boolean;
  onClose: () => void;
  modalState: 'preview' | 'loading' | 'success' | 'error';
  modalError: string | null;
  modalSuccess: string | null;
  previewData: ToDoPreviewData | null;
  onCreateToDo: () => void;
  onRetry: () => void;
  loading?: boolean;
}

const MobileToDoDialog: React.FC<MobileToDoDialogProps> = ({
  open,
  onClose,
  modalState,
  modalError,
  modalSuccess,
  previewData,
  onCreateToDo,
  onRetry,
  loading = false
}) => {
  const { isMobile } = useResponsive();

  const handleClose = () => {
    // Prevent closing during loading
    if (modalState !== 'loading') {
      onClose();
    }
  };

  const renderPreviewContent = () => {
    if (!previewData) return null;

    return (
      <Stack spacing={isMobile ? 2 : 3}>
        {/* Encounter Info */}
        <Paper
          sx={{
            p: isMobile ? 2 : 2.5,
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 2
          }}
        >
          <Typography variant="h6" sx={{ 
            fontWeight: 700, 
            mb: 2, 
            color: 'primary.main',
            fontSize: isMobile ? '1rem' : '1.1rem'
          }}>
            Encounter Details
          </Typography>
          
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Patient:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                {previewData.patientName}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarToday sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Date:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                {previewData.dateOfService}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assignment sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Assigned to:
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                {previewData.assignedToName}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Issues List */}
        <Paper
          sx={{
            border: '1px solid #fbbf24',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <Box sx={{ 
            p: isMobile ? 2 : 2.5, 
            backgroundColor: '#fef3c7',
            borderBottom: '1px solid #fbbf24'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Warning sx={{ color: '#d97706', fontSize: '1.2rem' }} />
              <Typography variant="h6" sx={{ 
                fontWeight: 700, 
                color: '#d97706',
                fontSize: isMobile ? '1rem' : '1.1rem'
              }}>
                Issues Found ({previewData.issues.length})
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ 
              color: '#92400e', 
              fontSize: '0.85rem',
              lineHeight: 1.4
            }}>
              The following issues will be included in the ToDo:
            </Typography>
          </Box>

          <List sx={{ p: 0 }}>
            {previewData.issues.map((issue, index) => (
              <React.Fragment key={index}>
                <ListItem
                  sx={{
                    alignItems: 'flex-start',
                    py: isMobile ? 2 : 1.5,
                    px: isMobile ? 2 : 2.5
                  }}
                >
                  <ListItemIcon sx={{ mt: 0.5, minWidth: 36 }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: '#f59e0b',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}
                    >
                      {index + 1}
                    </Box>
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ mb: 1 }}>
                        <Chip
                          label={issue.issue.replace(/_/g, ' ')}
                          color="warning"
                          size="small"
                          sx={{ 
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            mb: 1
                          }}
                        />
                        <Typography variant="body2" sx={{ 
                          fontWeight: 600, 
                          fontSize: '0.85rem',
                          lineHeight: 1.3
                        }}>
                          {issue.assessment}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.8rem',
                        lineHeight: 1.4,
                        mt: 0.5
                      }}>
                        {issue.details.correction}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < previewData.issues.length - 1 && (
                  <Divider sx={{ mx: 2 }} />
                )}
              </React.Fragment>
            ))}
          </List>
        </Paper>

        {/* Action Info */}
        <Alert 
          severity="info" 
          sx={{ 
            fontSize: '0.85rem',
            '& .MuiAlert-message': {
              lineHeight: 1.4
            }
          }}
        >
          This will create a ToDo in EZDerm that can be tracked and resolved by the assigned provider.
        </Alert>
      </Stack>
    );
  };

  const renderLoadingContent = () => (
    <Box sx={{ 
      textAlign: 'center', 
      py: isMobile ? 4 : 6,
      px: 2
    }}>
      <CircularProgress 
        size={isMobile ? 56 : 64} 
        sx={{ mb: 3, color: 'primary.main' }} 
      />
      <Typography variant="h6" sx={{ 
        mb: 1, 
        fontWeight: 600,
        fontSize: isMobile ? '1.1rem' : '1.25rem'
      }}>
        Creating ToDo...
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{
        fontSize: isMobile ? '0.9rem' : '1rem',
        lineHeight: 1.5
      }}>
        Please wait while we create the ToDo in EZDerm...
      </Typography>
    </Box>
  );

  const renderSuccessContent = () => (
    <Box sx={{ 
      textAlign: 'center', 
      py: isMobile ? 4 : 6,
      px: 2
    }}>
      <CheckCircleOutline 
        color="success" 
        sx={{ 
          fontSize: isMobile ? '4rem' : '5rem', 
          mb: 2 
        }} 
      />
      <Typography variant="h5" sx={{ 
        mb: 1, 
        color: 'success.main',
        fontWeight: 700,
        fontSize: isMobile ? '1.3rem' : '1.5rem'
      }}>
        Success!
      </Typography>
      {modalSuccess && (
        <Typography variant="body1" sx={{ 
          mb: 2,
          fontSize: isMobile ? '0.9rem' : '1rem',
          lineHeight: 1.5
        }}>
          {modalSuccess}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{
        fontSize: isMobile ? '0.85rem' : '0.9rem',
        lineHeight: 1.4
      }}>
        The ToDo has been successfully created and assigned. You can now close this dialog.
      </Typography>
    </Box>
  );

  const renderErrorContent = () => (
    <Box sx={{ 
      textAlign: 'center', 
      py: isMobile ? 4 : 6,
      px: 2
    }}>
      <ErrorOutline 
        color="error" 
        sx={{ 
          fontSize: isMobile ? '4rem' : '5rem', 
          mb: 2 
        }} 
      />
      <Typography variant="h5" sx={{ 
        mb: 2, 
        color: 'error.main',
        fontWeight: 700,
        fontSize: isMobile ? '1.3rem' : '1.5rem'
      }}>
        Error
      </Typography>
      {modalError && (
        <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
          {modalError}
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{
        fontSize: isMobile ? '0.85rem' : '0.9rem',
        lineHeight: 1.4
      }}>
        There was an error creating the ToDo. Please try again or contact support if the problem persists.
      </Typography>
    </Box>
  );

  const getTitle = () => {
    switch (modalState) {
      case 'preview':
        return 'Confirm ToDo Creation';
      case 'loading':
        return 'Creating ToDo...';
      case 'success':
        return 'ToDo Created Successfully!';
      case 'error':
        return 'Failed to Create ToDo';
      default:
        return 'ToDo Creation';
    }
  };

  const getIcon = () => {
    switch (modalState) {
      case 'preview':
        return <Assignment color="warning" />;
      case 'loading':
        return <CircularProgress size={24} />;
      case 'success':
        return <CheckCircleOutline color="success" />;
      case 'error':
        return <ErrorOutline color="error" />;
      default:
        return <Assignment color="primary" />;
    }
  };

  return (
    <MobileDialog
      open={open}
      onClose={handleClose}
      title={getTitle()}
      icon={getIcon()}
      showCloseButton={modalState !== 'loading'}
      mobileFullScreen={modalState === 'preview'}
      desktopMaxWidth="md"
    >
      <MobileDialogContent scrollable={modalState === 'preview'}>
        {modalState === 'preview' && (
          <>
            <Typography variant="body1" sx={{ 
              mb: 3, 
              color: 'text.secondary',
              fontSize: isMobile ? '0.9rem' : '1rem',
              lineHeight: 1.5
            }}>
              You are about to create a ToDo in EZDerm for the note deficiencies found. Please review the details below:
            </Typography>
            {renderPreviewContent()}
          </>
        )}
        {modalState === 'loading' && renderLoadingContent()}
        {modalState === 'success' && renderSuccessContent()}
        {modalState === 'error' && renderErrorContent()}
      </MobileDialogContent>

      {modalState === 'preview' && (
        <MobileDialogActions orientation={isMobile ? 'vertical' : 'horizontal'}>
          <Button
            onClick={handleClose}
            color="inherit"
            sx={{
              color: '#64748b',
              '&:hover': { backgroundColor: '#f1f5f9' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={onCreateToDo}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Assignment />}
            sx={{
              backgroundColor: '#f59e0b',
              '&:hover': { backgroundColor: '#d97706' }
            }}
          >
            {loading ? 'Creating...' : 'Create ToDo'}
          </Button>
        </MobileDialogActions>
      )}

      {modalState === 'success' && (
        <MobileDialogActions>
          <Button
            onClick={handleClose}
            variant="contained"
            color="success"
            startIcon={<CheckCircle />}
            sx={{ width: isMobile ? '100%' : 'auto' }}
          >
            Done
          </Button>
        </MobileDialogActions>
      )}

      {modalState === 'error' && (
        <MobileDialogActions orientation={isMobile ? 'vertical' : 'horizontal'}>
          <Button
            onClick={onRetry}
            color="inherit"
            sx={{
              color: '#64748b',
              '&:hover': { backgroundColor: '#f1f5f9' }
            }}
          >
            Try Again
          </Button>
          <Button
            onClick={handleClose}
            variant="contained"
            color="error"
          >
            Close
          </Button>
        </MobileDialogActions>
      )}
    </MobileDialog>
  );
};

export default MobileToDoDialog;
