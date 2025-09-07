import React, { useState } from 'react';
import {
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Box,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Add,
  Refresh,
  PlayArrow,
  Psychology,
  FilterList,
  Search
} from '@mui/icons-material';
import useResponsive from '../hooks/useResponsive';

interface MobileFABProps {
  selectedCount?: number;
  onRefresh?: () => void;
  onBulkCheck?: () => void;
  onQuickFilter?: () => void;
  refreshing?: boolean;
  bulkProcessing?: boolean;
}

const MobileFAB: React.FC<MobileFABProps> = ({
  selectedCount = 0,
  onRefresh,
  onBulkCheck,
  onQuickFilter,
  refreshing = false,
  bulkProcessing = false
}) => {
  const { isMobile } = useResponsive();
  const [open, setOpen] = useState(false);

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  const actions = [
    {
      icon: <Refresh />,
      name: 'Refresh',
      onClick: onRefresh,
      disabled: refreshing,
      show: !!onRefresh
    },
    {
      icon: (
        <Badge badgeContent={selectedCount} color="error" max={99}>
          <PlayArrow />
        </Badge>
      ),
      name: `Force Re-check (${selectedCount})`,
      onClick: onBulkCheck,
      disabled: bulkProcessing || selectedCount === 0,
      show: !!onBulkCheck && selectedCount > 0
    },
    {
      icon: <FilterList />,
      name: 'Quick Filter',
      onClick: onQuickFilter,
      show: !!onQuickFilter
    }
  ].filter(action => action.show);

  // If no actions available, don't show FAB
  if (actions.length === 0) {
    return null;
  }

  // If only one action, show simple FAB
  if (actions.length === 1) {
    const action = actions[0];
    return (
      <Tooltip title={action.name} placement="left">
        <Fab
          color="primary"
          onClick={action.onClick}
          disabled={action.disabled}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            backgroundColor: '#3b82f6',
            '&:hover': {
              backgroundColor: '#2563eb'
            },
            '&:disabled': {
              backgroundColor: '#94a3b8'
            }
          }}
        >
          {action.icon}
        </Fab>
      </Tooltip>
    );
  }

  // Multiple actions - use SpeedDial
  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
      <SpeedDial
        ariaLabel="Quick Actions"
        icon={<SpeedDialIcon />}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        direction="up"
        sx={{
          '& .MuiSpeedDial-fab': {
            backgroundColor: '#3b82f6',
            '&:hover': {
              backgroundColor: '#2563eb'
            }
          }
        }}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => {
              setOpen(false);
              action.onClick?.();
            }}
            disabled={action.disabled}
            sx={{
              '&:disabled': {
                opacity: 0.5
              }
            }}
          />
        ))}
      </SpeedDial>
    </Box>
  );
};

export default MobileFAB;
