import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Collapse,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Drawer,
  List,
  ListItem,
  Divider,
  useTheme
} from '@mui/material';
import {
  Psychology,
  ArrowBack,
  ExitToApp,
  Refresh,
  PlayArrow,
  Menu as MenuIcon,
  ExpandMore,
  ExpandLess,
  Assessment,
  CheckCircle,
  Warning,
  Schedule
} from '@mui/icons-material';
import useResponsive from '../hooks/useResponsive';

interface NoteCounts {
  all: number;
  clean: number;
  issues: number;
  unchecked: number;
  'issues-no-todos': number;
}

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  noteCounts: NoteCounts;
  selectedNotesCount?: number;
  loading?: boolean;
  autoRefreshing?: boolean;
  bulkProcessing?: boolean;
  onBack?: () => void;
  onRefresh?: () => void;
  onBulkForceRecheck?: () => void;
  onLogout?: () => void;
  showBackButton?: boolean;
  showStats?: boolean;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  noteCounts,
  selectedNotesCount = 0,
  loading = false,
  autoRefreshing = false,
  bulkProcessing = false,
  onBack,
  onRefresh,
  onBulkForceRecheck,
  onLogout,
  showBackButton = false,
  showStats = true
}) => {
  const { isMobile, isSmallMobile } = useResponsive();
  const theme = useTheme();
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isMobile) {
    // Return null for desktop - desktop will use original header
    return null;
  }

  const handleMenuClose = () => {
    setMenuOpen(false);
  };

  const StatCard = ({ 
    count, 
    label, 
    color, 
    icon 
  }: { 
    count: number; 
    label: string; 
    color: string; 
    icon: React.ReactNode;
  }) => (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      p: 1.5,
      backgroundColor: '#1a1a1a',
      border: '1px solid #2a2a2a',
      borderRadius: 2,
      minWidth: '70px',
      flex: 1
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        {icon}
        <Typography variant="h6" sx={{ 
          fontWeight: 700, 
          color: color,
          fontSize: isSmallMobile ? '1.1rem' : '1.25rem'
        }}>
          {count}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ 
        fontSize: isSmallMobile ? '0.65rem' : '0.7rem',
        opacity: 0.8,
        color: '#94a3b8',
        fontWeight: 500,
        textAlign: 'center',
        lineHeight: 1.2
      }}>
        {label}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ 
      backgroundColor: '#0a0a0a', 
      color: 'white',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      borderBottom: '1px solid #1a1a1a'
    }}>
      {/* Main Header Row */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
        minHeight: '64px'
      }}>
        {/* Left Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
          {showBackButton && onBack && (
            <Tooltip title="Back">
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
          )}
          
          <Psychology sx={{ 
            fontSize: isSmallMobile ? '1.5rem' : '1.75rem', 
            color: '#f8fafc',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
          }} />
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600, 
              lineHeight: 1.2,
              color: '#f8fafc',
              fontSize: isSmallMobile ? '1rem' : '1.1rem',
              letterSpacing: '-0.025em'
            }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ 
                opacity: 0.8,
                color: '#e2e8f0',
                fontSize: isSmallMobile ? '0.75rem' : '0.8rem',
                fontWeight: 400,
                lineHeight: 1.2
              }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right Section - Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Stats Toggle Button */}
          {showStats && (
            <Tooltip title={statsExpanded ? 'Hide stats' : 'Show stats'}>
              <IconButton
                onClick={() => setStatsExpanded(!statsExpanded)}
                sx={{ 
                  color: '#f8fafc',
                  backgroundColor: statsExpanded ? '#3b82f6' : '#2a2a2a',
                  border: '1px solid #3a3a3a',
                  borderRadius: 2,
                  p: 1,
                  '&:hover': {
                    backgroundColor: statsExpanded ? '#2563eb' : '#3a3a3a',
                    borderColor: '#4a4a4a'
                  }
                }}
              >
                {statsExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Tooltip>
          )}

          {/* Menu Button */}
          <Tooltip title="Menu">
            <IconButton
              onClick={() => setMenuOpen(true)}
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
              <MenuIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Collapsible Stats Section */}
      {showStats && (
        <Collapse in={statsExpanded}>
          <Box sx={{ 
            px: 2, 
            pb: 2,
            borderTop: '1px solid #2a2a2a'
          }}>
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: isSmallMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: 1,
              mt: 2
            }}>
              <StatCard
                count={noteCounts.all}
                label="Total"
                color="#f8fafc"
                icon={<Assessment sx={{ fontSize: '1rem', color: '#94a3b8' }} />}
              />
              <StatCard
                count={noteCounts.issues}
                label="Issues"
                color="#ef4444"
                icon={<Warning sx={{ fontSize: '1rem', color: '#ef4444' }} />}
              />
              <StatCard
                count={noteCounts.clean}
                label="Clean"
                color="#10b981"
                icon={<CheckCircle sx={{ fontSize: '1rem', color: '#10b981' }} />}
              />
              <StatCard
                count={noteCounts.unchecked}
                label="Unchecked"
                color="#fbbf24"
                icon={<Schedule sx={{ fontSize: '1rem', color: '#fbbf24' }} />}
              />
            </Box>
            
            {isSmallMobile && noteCounts['issues-no-todos'] > 0 && (
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                <StatCard
                  count={noteCounts['issues-no-todos']}
                  label="Issues (No ToDos)"
                  color="#dc2626"
                  icon={<Warning sx={{ fontSize: '1rem', color: '#dc2626' }} />}
                />
              </Box>
            )}
          </Box>
        </Collapse>
      )}

      {/* Mobile Menu Drawer */}
      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            width: 280,
            backgroundColor: '#1a1a1a',
            color: '#f8fafc'
          }
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #2a2a2a' }}>
          <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 600 }}>
            Actions
          </Typography>
        </Box>
        
        <List sx={{ p: 0 }}>
          {onRefresh && (
            <ListItem 
              onClick={() => {
                onRefresh();
                handleMenuClose();
              }}
              sx={{ 
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#2a2a2a' },
                py: 1.5
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {autoRefreshing ? (
                  <CircularProgress size={20} sx={{ color: '#f8fafc' }} />
                ) : (
                  <Refresh sx={{ color: '#f8fafc' }} />
                )}
              </ListItemIcon>
              <ListItemText 
                primary="Refresh" 
                primaryTypographyProps={{ 
                  color: '#f8fafc',
                  fontWeight: 500
                }}
              />
            </ListItem>
          )}

          {selectedNotesCount > 0 && onBulkForceRecheck && (
            <ListItem 
              onClick={() => {
                onBulkForceRecheck();
                handleMenuClose();
              }}
              sx={{ 
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#2a2a2a' },
                py: 1.5
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {bulkProcessing ? (
                  <CircularProgress size={20} sx={{ color: '#f59e0b' }} />
                ) : (
                  <PlayArrow sx={{ color: '#f59e0b' }} />
                )}
              </ListItemIcon>
              <ListItemText 
                primary={`Force Re-check (${selectedNotesCount})`}
                primaryTypographyProps={{ 
                  color: '#f8fafc',
                  fontWeight: 500
                }}
              />
            </ListItem>
          )}

          <Divider sx={{ backgroundColor: '#2a2a2a', my: 1 }} />

          {onLogout && (
            <ListItem 
              onClick={() => {
                onLogout();
                handleMenuClose();
              }}
              sx={{ 
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#dc2626' },
                py: 1.5
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <ExitToApp sx={{ color: '#ef4444' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Logout"
                primaryTypographyProps={{ 
                  color: '#ef4444',
                  fontWeight: 500
                }}
              />
            </ListItem>
          )}
        </List>
      </Drawer>
    </Box>
  );
};

export default MobileHeader;
