import React, { useState, useRef } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Slide,
  useTheme
} from '@mui/material';
import {
  Psychology,
  CheckCircle,
  Assignment,
  Delete
} from '@mui/icons-material';
import NoteCard from './NoteCard';
import useResponsive from '../hooks/useResponsive';

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

interface SwipeableNoteCardProps {
  note: IncompleteNote;
  isSelected?: boolean;
  isChecking?: boolean;
  onSelect?: (encounterId: string, checked: boolean) => void;
  onCheck?: (note: IncompleteNote) => void;
  onView?: (note: IncompleteNote) => void;
  onQuickAction?: (note: IncompleteNote, action: 'check' | 'select' | 'todo') => void;
  showSelection?: boolean;
  expanded?: boolean;
  onToggleExpand?: (encounterId: string) => void;
}

const SwipeableNoteCard: React.FC<SwipeableNoteCardProps> = ({
  note,
  isSelected = false,
  isChecking = false,
  onSelect,
  onCheck,
  onView,
  onQuickAction,
  showSelection = false,
  expanded = false,
  onToggleExpand
}) => {
  const { isMobile } = useResponsive();
  const theme = useTheme();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const startX = useRef<number>(0);
  const currentX = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Only enable swipe on mobile
  if (!isMobile) {
    return (
      <NoteCard
        note={note}
        isSelected={isSelected}
        isChecking={isChecking}
        onSelect={onSelect}
        onCheck={onCheck}
        onView={onView}
        showSelection={showSelection}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
      />
    );
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsSwipeActive(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwipeActive) return;

    currentX.current = e.touches[0].clientX;
    const deltaX = currentX.current - startX.current;
    
    // Only allow horizontal swipes
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
      
      // Apply resistance for over-swipe
      const maxSwipe = 120;
      const resistance = 0.6;
      let adjustedDelta = deltaX;
      
      if (Math.abs(deltaX) > maxSwipe) {
        const overSwipe = Math.abs(deltaX) - maxSwipe;
        adjustedDelta = deltaX > 0 
          ? maxSwipe + (overSwipe * resistance)
          : -maxSwipe - (overSwipe * resistance);
      }
      
      setSwipeOffset(adjustedDelta);
      setSwipeDirection(deltaX > 0 ? 'right' : 'left');
    }
  };

  const handleTouchEnd = () => {
    setIsSwipeActive(false);
    
    const threshold = 80;
    const absOffset = Math.abs(swipeOffset);
    
    if (absOffset > threshold) {
      // Trigger action based on swipe direction
      if (swipeDirection === 'right') {
        // Right swipe - quick check
        onQuickAction?.(note, 'check');
      } else if (swipeDirection === 'left') {
        // Left swipe - select/toggle
        onQuickAction?.(note, 'select');
      }
    }
    
    // Reset swipe state
    setSwipeOffset(0);
    setSwipeDirection(null);
  };

  const getLeftActionColor = () => {
    return swipeOffset > 80 ? '#10b981' : '#64748b';
  };

  const getRightActionColor = () => {
    return swipeOffset < -80 ? '#3b82f6' : '#64748b';
  };

  const getLeftActionOpacity = () => {
    return Math.min(Math.abs(swipeOffset) / 80, 1);
  };

  const getRightActionOpacity = () => {
    return Math.min(Math.abs(swipeOffset) / 80, 1);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
        mb: 1
      }}
    >
      {/* Left Action (Swipe Right) - Quick Check */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 120,
          backgroundColor: getLeftActionColor(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: swipeOffset > 0 ? getLeftActionOpacity() : 0,
          transition: isSwipeActive ? 'none' : 'all 0.3s ease',
          zIndex: 1
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          color: 'white'
        }}>
          <Psychology sx={{ fontSize: '1.5rem', mb: 0.5 }} />
          <Typography variant="caption" sx={{ 
            fontWeight: 600,
            fontSize: '0.7rem',
            textAlign: 'center'
          }}>
            Quick Check
          </Typography>
        </Box>
      </Box>

      {/* Right Action (Swipe Left) - Select/Toggle */}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 120,
          backgroundColor: getRightActionColor(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: swipeOffset < 0 ? getRightActionOpacity() : 0,
          transition: isSwipeActive ? 'none' : 'all 0.3s ease',
          zIndex: 1
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          color: 'white'
        }}>
          {isSelected ? (
            <>
              <CheckCircle sx={{ fontSize: '1.5rem', mb: 0.5 }} />
              <Typography variant="caption" sx={{ 
                fontWeight: 600,
                fontSize: '0.7rem',
                textAlign: 'center'
              }}>
                Deselect
              </Typography>
            </>
          ) : (
            <>
              <Assignment sx={{ fontSize: '1.5rem', mb: 0.5 }} />
              <Typography variant="caption" sx={{ 
                fontWeight: 600,
                fontSize: '0.7rem',
                textAlign: 'center'
              }}>
                Select
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Main Card */}
      <Box
        ref={cardRef}
        sx={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwipeActive ? 'none' : 'transform 0.3s ease',
          position: 'relative',
          zIndex: 2,
          backgroundColor: 'white'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <NoteCard
          note={note}
          isSelected={isSelected}
          isChecking={isChecking}
          onSelect={onSelect}
          onCheck={onCheck}
          onView={onView}
          showSelection={showSelection}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
        />
      </Box>

      {/* Swipe Hint Overlay */}
      {!isSwipeActive && swipeOffset === 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.7rem',
            opacity: 0.7,
            zIndex: 3,
            pointerEvents: 'none'
          }}
        >
          ← Swipe →
        </Box>
      )}
    </Box>
  );
};

export default SwipeableNoteCard;
