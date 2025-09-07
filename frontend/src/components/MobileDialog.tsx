import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogProps,
  IconButton,
  Typography,
  Box,
  Slide,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import useResponsive from '../hooks/useResponsive';

// Slide transition for mobile
const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface MobileDialogProps extends Omit<DialogProps, 'fullScreen' | 'fullWidth' | 'maxWidth'> {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  showCloseButton?: boolean;
  mobileFullScreen?: boolean;
  desktopMaxWidth?: DialogProps['maxWidth'];
  desktopFullWidth?: boolean;
}

const MobileDialog: React.FC<MobileDialogProps> = ({
  children,
  title,
  subtitle,
  icon,
  showCloseButton = true,
  mobileFullScreen = true,
  desktopMaxWidth = 'sm',
  desktopFullWidth = true,
  onClose,
  ...dialogProps
}) => {
  const { isMobile } = useResponsive();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Mobile configuration
  const mobileProps = {
    fullScreen: mobileFullScreen,
    TransitionComponent: SlideTransition,
    PaperProps: {
      sx: {
        margin: 0,
        maxHeight: '100vh',
        borderRadius: mobileFullScreen ? 0 : 3,
        ...(mobileFullScreen && {
          height: '100vh',
          maxWidth: '100vw'
        })
      }
    }
  };

  // Desktop configuration
  const desktopProps = {
    maxWidth: desktopMaxWidth,
    fullWidth: desktopFullWidth,
    PaperProps: {
      sx: {
        borderRadius: 2,
        minWidth: '400px'
      }
    }
  };

  const handleClose = (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
    // Prevent closing on backdrop click for mobile to avoid accidental dismissal
    if (isMobile && reason === 'backdropClick') {
      return;
    }
    onClose?.(event, reason);
  };

  return (
    <Dialog
      {...dialogProps}
      {...(isMobile ? mobileProps : desktopProps)}
      onClose={handleClose}
    >
      {/* Custom Title with Close Button */}
      {(title || showCloseButton) && (
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            py: isMobile ? 2 : 1.5,
            px: isMobile ? 2 : 3,
            backgroundColor: isMobile ? '#f8fafc' : 'transparent',
            borderBottom: isMobile ? '1px solid #e2e8f0' : 'none',
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}
        >
          {(title || icon) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
              {icon}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                {title && (
                  <Typography 
                    variant={isMobile ? 'h6' : 'h6'} 
                    component="h2"
                    sx={{ 
                      fontWeight: 700,
                      fontSize: isMobile ? '1.1rem' : '1.25rem',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {title}
                  </Typography>
                )}
                {subtitle && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: '0.85rem',
                      mt: 0.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {subtitle}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
          
          {showCloseButton && (
            <IconButton
              onClick={(e) => onClose?.(e, 'escapeKeyDown')}
              sx={{
                color: 'text.secondary',
                backgroundColor: isMobile ? 'background.paper' : 'transparent',
                border: isMobile ? '1px solid' : 'none',
                borderColor: 'divider',
                borderRadius: 2,
                width: isMobile ? 40 : 32,
                height: isMobile ? 40 : 32,
                '&:hover': {
                  backgroundColor: isMobile ? 'action.hover' : 'action.hover',
                  borderColor: isMobile ? 'action.disabled' : undefined
                }
              }}
            >
              <Close sx={{ fontSize: isMobile ? '1.1rem' : '1rem' }} />
            </IconButton>
          )}
        </DialogTitle>
      )}

      {children}
    </Dialog>
  );
};

// Enhanced DialogContent for mobile
interface MobileDialogContentProps {
  children: React.ReactNode;
  noPadding?: boolean;
  scrollable?: boolean;
}

export const MobileDialogContent: React.FC<MobileDialogContentProps> = ({
  children,
  noPadding = false,
  scrollable = true
}) => {
  const { isMobile } = useResponsive();

  return (
    <DialogContent
      sx={{
        px: noPadding ? 0 : (isMobile ? 2 : 3),
        py: noPadding ? 0 : (isMobile ? 2 : 2),
        overflow: scrollable ? 'auto' : 'visible',
        // Ensure proper scrolling on mobile
        ...(isMobile && scrollable && {
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        })
      }}
    >
      {children}
    </DialogContent>
  );
};

// Enhanced DialogActions for mobile
interface MobileDialogActionsProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  sticky?: boolean;
}

export const MobileDialogActions: React.FC<MobileDialogActionsProps> = ({
  children,
  orientation = 'horizontal',
  sticky = true
}) => {
  const { isMobile } = useResponsive();
  const shouldStack = isMobile && orientation === 'vertical';

  return (
    <DialogActions
      sx={{
        flexDirection: shouldStack ? 'column-reverse' : 'row',
        gap: isMobile ? 1.5 : 1,
        p: isMobile ? 2 : 2,
        backgroundColor: isMobile ? '#f8fafc' : 'transparent',
        borderTop: isMobile ? '1px solid #e2e8f0' : 'none',
        ...(sticky && isMobile && {
          position: 'sticky',
          bottom: 0,
          zIndex: 1
        }),
        // Full width buttons on mobile when stacked
        ...(shouldStack && {
          '& .MuiButton-root': {
            width: '100%',
            minHeight: '48px', // Touch-friendly height
            fontSize: '1rem',
            fontWeight: 600
          }
        }),
        // Enhanced button styling for horizontal layout on mobile
        ...(!shouldStack && isMobile && {
          '& .MuiButton-root': {
            minHeight: '44px', // Touch-friendly height
            px: 3,
            fontSize: '0.9rem',
            fontWeight: 600,
            flex: 1 // Equal width buttons
          }
        })
      }}
    >
      {children}
    </DialogActions>
  );
};

export default MobileDialog;
