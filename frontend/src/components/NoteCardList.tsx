import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Checkbox,
  FormControlLabel,
  Collapse,
  Alert,
  Divider
} from '@mui/material';
import {
  Assignment,
  ExpandMore,
  ExpandLess,
  SelectAll,
  Psychology
} from '@mui/icons-material';
import NoteCard from './NoteCard';
import SwipeableNoteCard from './SwipeableNoteCard';
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

interface NoteCardListProps {
  notes: IncompleteNote[];
  selectedNotes: Set<string>;
  checkingNotes: Set<string>;
  onSelectNote: (encounterId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onCheckNote: (note: IncompleteNote) => void;
  onViewNote: (note: IncompleteNote) => void;
  bulkProcessing?: boolean;
  currentFilter?: string;
}

const NoteCardList: React.FC<NoteCardListProps> = ({
  notes,
  selectedNotes,
  checkingNotes,
  onSelectNote,
  onSelectAll,
  onCheckNote,
  onViewNote,
  bulkProcessing = false,
  currentFilter = 'all'
}) => {
  const { isMobile } = useResponsive();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  const handleToggleExpand = (encounterId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(encounterId)) {
        newSet.delete(encounterId);
      } else {
        newSet.add(encounterId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    if (expandedCards.size === notes.length) {
      setExpandedCards(new Set());
    } else {
      setExpandedCards(new Set(notes.map(note => note.encounterId)));
    }
  };

  const handleQuickAction = (note: IncompleteNote, action: 'check' | 'select' | 'todo') => {
    switch (action) {
      case 'check':
        onCheckNote(note);
        break;
      case 'select':
        onSelectNote(note.encounterId, !selectedNotes.has(note.encounterId));
        break;
      case 'todo':
        // Future: Handle quick todo creation
        break;
    }
  };

  const allSelected = selectedNotes.size === notes.length && notes.length > 0;
  const someSelected = selectedNotes.size > 0 && selectedNotes.size < notes.length;

  if (notes.length === 0) {
    return (
      <Box sx={{ 
        p: 4, 
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: 2,
        border: '1px solid #e2e8f0'
      }}>
        <Assignment sx={{ fontSize: '3rem', color: '#cbd5e1', mb: 2 }} />
        <Typography variant="h6" sx={{ 
          color: '#64748b',
          fontWeight: 600,
          mb: 1
        }}>
          No notes found
        </Typography>
        <Typography variant="body2" sx={{ 
          color: '#94a3b8',
          fontSize: '0.9rem'
        }}>
          {currentFilter === 'all' 
            ? 'All notes have been completed, signed, or are less than 2 hours old'
            : `No ${
                currentFilter === 'clean' ? 'clean' :
                currentFilter === 'issues' ? 'notes with issues' :
                currentFilter === 'unchecked' ? 'unchecked' :
                currentFilter === 'issues-no-todos' ? 'notes with issues without ToDos' :
                ''
              } notes found. Try switching to another filter.`
          }
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Bulk Actions Header */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="text"
          onClick={() => setShowBulkActions(!showBulkActions)}
          startIcon={showBulkActions ? <ExpandLess /> : <ExpandMore />}
          sx={{
            color: '#64748b',
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'none',
            p: 1,
            minHeight: 'auto'
          }}
        >
          Bulk Actions {selectedNotes.size > 0 && `(${selectedNotes.size} selected)`}
        </Button>

        <Collapse in={showBulkActions}>
          <Box sx={{ 
            mt: 1, 
            p: 2, 
            backgroundColor: '#f8fafc',
            borderRadius: 2,
            border: '1px solid #e2e8f0'
          }}>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    disabled={bulkProcessing}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    Select All ({notes.length})
                  </Typography>
                }
              />

              <Button
                variant="outlined"
                size="small"
                startIcon={<SelectAll />}
                onClick={handleExpandAll}
                sx={{
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  borderColor: '#e2e8f0',
                  color: '#64748b'
                }}
              >
                {expandedCards.size === notes.length ? 'Collapse All' : 'Expand All'}
              </Button>
            </Stack>

            {selectedNotes.size > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Alert 
                  severity="info" 
                  sx={{ 
                    fontSize: '0.8rem',
                    '& .MuiAlert-message': { p: 0 }
                  }}
                >
                  {selectedNotes.size} note{selectedNotes.size !== 1 ? 's' : ''} selected. 
                  Use the floating action button to perform bulk operations.
                </Alert>
              </>
            )}
          </Box>
        </Collapse>
      </Box>

      {/* Note Cards */}
      <Stack spacing={0}>
        {notes.map((note) => (
          <SwipeableNoteCard
            key={note.encounterId}
            note={note}
            isSelected={selectedNotes.has(note.encounterId)}
            isChecking={checkingNotes.has(note.encounterId)}
            onSelect={onSelectNote}
            onCheck={onCheckNote}
            onView={onViewNote}
            onQuickAction={handleQuickAction}
            showSelection={showBulkActions}
            expanded={expandedCards.has(note.encounterId)}
            onToggleExpand={handleToggleExpand}
          />
        ))}
      </Stack>

      {/* Summary Footer */}
      <Box sx={{ 
        mt: 3, 
        p: 2, 
        backgroundColor: '#f8fafc',
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        textAlign: 'center'
      }}>
        <Typography variant="body2" sx={{ 
          color: '#64748b',
          fontSize: '0.85rem'
        }}>
          Showing {notes.length} note{notes.length !== 1 ? 's' : ''}
          {selectedNotes.size > 0 && (
            <> • {selectedNotes.size} selected</>
          )}
        </Typography>
        
        {notes.length > 10 && (
          <Typography variant="caption" sx={{ 
            color: '#94a3b8',
            fontSize: '0.75rem',
            display: 'block',
            mt: 0.5
          }}>
            Pull down to refresh • Tap cards to view details
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default NoteCardList;
