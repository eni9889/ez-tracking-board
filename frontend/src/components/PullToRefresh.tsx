import React, { useState, useRef, useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import useResponsive from '../hooks/useResponsive';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
  threshold?: number;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  threshold = 80
}) => {
  const { isMobile } = useResponsive();
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  // Reset states when refresh completes
  useEffect(() => {
    if (!isRefreshing && !isPulling) {
      setPullDistance(0);
    }
  }, [isRefreshing, isPulling]);

  // Only enable on mobile devices
  if (!isMobile || disabled) {
    return <>{children}</>;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    currentY.current = e.touches[0].clientY;
    const distance = Math.max(0, currentY.current - startY.current);
    
    if (distance > 0) {
      // Prevent default scrolling when pulling down
      e.preventDefault();
      // Apply resistance - gets harder to pull as distance increases
      const resistanceFactor = Math.min(1, distance / (threshold * 2));
      const adjustedDistance = distance * (1 - resistanceFactor * 0.6);
      setPullDistance(Math.min(adjustedDistance, threshold * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  const getRefreshIndicatorOpacity = () => {
    if (isRefreshing) return 1;
    return Math.min(pullDistance / threshold, 1);
  };

  const getRefreshIndicatorScale = () => {
    if (isRefreshing) return 1;
    return Math.min(pullDistance / threshold, 1);
  };

  const shouldShowRefreshText = pullDistance >= threshold || isRefreshing;

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        overflow: 'auto',
        position: 'relative',
        WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(pullDistance, isRefreshing ? 60 : 0),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          borderBottom: pullDistance > 0 || isRefreshing ? '1px solid #e2e8f0' : 'none',
          transition: isRefreshing ? 'height 0.3s ease' : 'none',
          zIndex: 10,
          opacity: getRefreshIndicatorOpacity(),
          transform: `scale(${getRefreshIndicatorScale()})`
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 1,
          py: 1
        }}>
          {isRefreshing ? (
            <CircularProgress size={24} sx={{ color: '#3b82f6' }} />
          ) : (
            <Refresh 
              sx={{ 
                fontSize: '1.5rem', 
                color: '#3b82f6',
                transform: `rotate(${Math.min(pullDistance / threshold * 180, 180)}deg)`,
                transition: 'transform 0.1s ease'
              }} 
            />
          )}
          <Typography 
            variant="caption" 
            sx={{ 
              color: '#64748b',
              fontWeight: 600,
              fontSize: '0.75rem',
              opacity: shouldShowRefreshText ? 1 : 0,
              transition: 'opacity 0.2s ease'
            }}
          >
            {isRefreshing ? 'Refreshing...' : 
             pullDistance >= threshold ? 'Release to refresh' : 
             'Pull to refresh'}
          </Typography>
        </Box>
      </Box>

      {/* Content with top padding when pulling/refreshing */}
      <Box
        sx={{
          paddingTop: `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px`,
          transition: isRefreshing ? 'padding-top 0.3s ease' : 'none',
          minHeight: '100%'
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default PullToRefresh;
