import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Tooltip,
  IconButton,
  CircularProgress,
  Grid,
  Checkbox,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Psychology,
  Refresh,
  Assignment,
  ArrowBack,

  PlayArrow
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEncounters } from '../contexts/EncountersContext';
import aiNoteCheckerService from '../services/aiNoteChecker.service';

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
}

type FilterType = 'all' | 'clean' | 'issues' | 'unchecked' | 'issues-no-todos';

const AINoteChecker: React.FC = () => {
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    encounters: incompleteNotes, 
    loading, 
    error, 
    lastRefresh, 
    loadEncounters, 
    refreshEncounters 
  } = useEncounters();

  // Check if we're in mock data mode
  const isUsingMockData = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

  useEffect(() => {
    loadEncounters();
    
    // Auto-refresh every 30 seconds to pick up background job results
    const refreshInterval = setInterval(async () => {
      console.log('🔄 Auto-refreshing note check results...');
      setAutoRefreshing(true);
      await refreshEncounters();
      setAutoRefreshing(false);
    }, 30000); // 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [loadEncounters, refreshEncounters]);

  // Filter notes based on current filter
  const getFilteredNotes = (): IncompleteNote[] => {
    switch (currentFilter) {
      case 'clean':
        return incompleteNotes.filter(note => 
          note.lastCheckStatus === 'completed' && !note.issuesFound
        );
      case 'issues':
        return incompleteNotes.filter(note => 
          note.lastCheckStatus === 'completed' && note.issuesFound
        );
      case 'unchecked':
        return incompleteNotes.filter(note => 
          !note.lastCheckStatus || note.lastCheckStatus === 'pending'
        );
      case 'issues-no-todos':
        return incompleteNotes.filter(note => 
          note.lastCheckStatus === 'completed' && note.issuesFound && !note.todoCreated
        );
      case 'all':
      default:
        return incompleteNotes;
    }
  };

  const filteredNotes = getFilteredNotes();

  // Count notes for each filter
  const getNoteCounts = () => {
    return {
      all: incompleteNotes.length,
      clean: incompleteNotes.filter(note => 
        note.lastCheckStatus === 'completed' && !note.issuesFound
      ).length,
      issues: incompleteNotes.filter(note => 
        note.lastCheckStatus === 'completed' && note.issuesFound
      ).length,
      unchecked: incompleteNotes.filter(note => 
        !note.lastCheckStatus || note.lastCheckStatus === 'pending'
      ).length,
      'issues-no-todos': incompleteNotes.filter(note => 
        note.lastCheckStatus === 'completed' && note.issuesFound && !note.todoCreated
      ).length,
    };
  };

  const noteCounts = getNoteCounts();



  const handleCheckNote = async (note: IncompleteNote) => {
    setChecking(prev => new Set(prev).add(note.encounterId));
    
    try {
      await aiNoteCheckerService.checkSingleNote(
        note.encounterId,
        note.patientId,
        note.patientName,
        note.chiefComplaint,
        note.dateOfService
      );
      
      // Refresh the notes list to show updated status
      await refreshEncounters();
    } catch (err: any) {
      console.error('Error checking note:', err);
      setLocalError(err.message || 'Failed to check note');
    } finally {
      setChecking(prev => {
        const newSet = new Set(prev);
        newSet.delete(note.encounterId);
        return newSet;
      });
    }
  };

  const handleViewNote = (note: IncompleteNote) => {
    navigate(`/ai-note-checker/${note.encounterId}`, {
      state: { 
        note,
        currentFilter,
        filteredNotes
      }
    });
  };

  // Selection handlers
  const handleSelectNote = (encounterId: string, checked: boolean) => {
    setSelectedNotes(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(encounterId);
      } else {
        newSet.delete(encounterId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotes(new Set(filteredNotes.map(note => note.encounterId)));
    } else {
      setSelectedNotes(new Set());
    }
  };

  // Bulk force re-check functionality - ENQUEUE JOBS, don't run synchronously
  const handleBulkForceRecheck = async () => {
    if (selectedNotes.size === 0) {
      setLocalError('Please select at least one note to re-check');
      return;
    }

    setBulkProcessing(true);
    setLocalError(null);

    try {
      const selectedNotesArray = incompleteNotes.filter(note => 
        selectedNotes.has(note.encounterId)
      );

      // Enqueue all selected notes as jobs - this is the correct approach
      const jobs = selectedNotesArray.map(note => ({
        encounterId: note.encounterId,
        patientId: note.patientId,
        patientName: note.patientName,
        chiefComplaint: note.chiefComplaint,
        dateOfService: note.dateOfService,
        force: true // Force re-check flag
      }));

      // Call the backend to enqueue all jobs at once
      await aiNoteCheckerService.enqueueBulkForceRecheck(jobs);

      // Clear selection after enqueuing
      setSelectedNotes(new Set());

      // Show success message
      setLocalError(null);
      console.log(`✅ Enqueued ${jobs.length} notes for force re-check`);

    } catch (err: any) {
      console.error('Error enqueuing bulk re-check jobs:', err);
      setLocalError(err.message || 'Failed to enqueue bulk re-check jobs');
    } finally {
      setBulkProcessing(false);
    }
  };

  const getStatusChip = (note: IncompleteNote) => {
    if (checking.has(note.encounterId)) {
      return (
        <Chip
          icon={<CircularProgress size={16} />}
          label="Checking..."
          color="info"
          size="small"
        />
      );
    }

    if (!note.lastCheckStatus) {
      return (
        <Chip
          label="Not Checked"
          color="default"
          size="small"
        />
      );
    }

    if (note.lastCheckStatus === 'error') {
      return (
        <Chip
          label="Error"
          color="error"
          size="small"
        />
      );
    }

    if (note.issuesFound) {
      return (
        <Chip
          label="Issues Found"
          color="warning"
          size="small"
        />
      );
    }

    return (
      <Chip
        label="Clean"
        color="success"
        size="small"
      />
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <Box sx={{ 
        backgroundColor: '#1976d2', 
        color: 'white', 
        px: 3, 
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}>
        <IconButton
          color="inherit"
          onClick={() => navigate('/dashboard')}
          sx={{ mr: 1 }}
        >
          <ArrowBack />
        </IconButton>
        <Assignment sx={{ fontSize: '1.5rem' }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold', flex: 1 }}>
          AI Note Checker - Incomplete Notes
        </Typography>
        <Typography variant="caption" sx={{ mr: 2, opacity: 0.8 }}>
          Showing notes &gt; 2 hours old with status: PENDING_COSIGN, CHECKED_OUT, WITH_PROVIDER
        </Typography>
        {lastRefresh && (
          <Typography variant="caption" sx={{ mr: 2, opacity: 0.7 }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
            {autoRefreshing && (
              <Typography component="span" sx={{ ml: 1, opacity: 0.8 }}>
                🔄
              </Typography>
            )}
          </Typography>
        )}
        <Button
          variant="outlined"
          color="inherit"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
          onClick={refreshEncounters}
          disabled={loading}
          size="small"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
        
        {selectedNotes.size > 0 && (
          <Button
            variant="contained"
            color="warning"
            startIcon={bulkProcessing ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
            onClick={handleBulkForceRecheck}
            disabled={bulkProcessing || loading}
            size="small"
            sx={{ ml: 1 }}
          >
            {bulkProcessing ? 'Processing...' : `Force Re-check (${selectedNotes.size})`}
          </Button>
        )}
      </Box>

      {/* Status Info */}
      <Box sx={{ px: 3, py: 2, backgroundColor: 'white', borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Total Notes: <strong>{incompleteNotes.length}</strong>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Checked: <strong>{incompleteNotes.filter(n => n.lastCheckStatus).length}</strong>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="body2" color="text.secondary">
              With Issues: <strong>{incompleteNotes.filter(n => n.issuesFound).length}</strong>
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Last Refresh: <strong>{lastRefresh ? lastRefresh.toLocaleTimeString() : 'Never'}</strong>
            </Typography>
          </Grid>
        </Grid>
      </Box>

      {/* Filter Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'white' }}>
        <Tabs 
          value={currentFilter} 
          onChange={(_, newValue) => setCurrentFilter(newValue as FilterType)}
          sx={{ px: 3 }}
        >
          <Tab 
            label={
              <Badge badgeContent={noteCounts.all} color="default" max={999}>
                All Notes
              </Badge>
            } 
            value="all" 
          />
          <Tab 
            label={
              <Badge badgeContent={noteCounts.clean} color="success" max={999}>
                Clean Notes
              </Badge>
            } 
            value="clean" 
          />
          <Tab 
            label={
              <Badge badgeContent={noteCounts.issues} color="error" max={999}>
                Notes with Issues
              </Badge>
            } 
            value="issues" 
          />
          <Tab 
            label={
              <Badge badgeContent={noteCounts.unchecked} color="warning" max={999}>
                Unchecked Notes
              </Badge>
            } 
            value="unchecked" 
          />
          <Tab 
            label={
              <Badge badgeContent={noteCounts['issues-no-todos']} color="error" max={999}>
                Issues Without ToDos
              </Badge>
            } 
            value="issues-no-todos" 
          />
        </Tabs>
      </Box>

      {/* Error Alerts */}
      {error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="error">
            {error}
          </Alert>
        </Box>
      )}
      {localError && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="error" onClose={() => setLocalError(null)}>
            {localError}
          </Alert>
        </Box>
      )}

      {/* Mock Data Warning */}
      {isUsingMockData && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="info">
            <strong>Development Mode:</strong> Using mock data. Set REACT_APP_USE_MOCK_DATA=false to use real EZDerm API.
          </Alert>
        </Box>
      )}

      {/* Notes Table */}
      <Box sx={{ flex: 1, px: 3, py: 2 }}>
        <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', width: 50 }}>
                    <Checkbox
                      checked={selectedNotes.size === filteredNotes.length && filteredNotes.length > 0}
                      indeterminate={selectedNotes.size > 0 && selectedNotes.size < filteredNotes.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={bulkProcessing}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                    Patient
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                    Chief Complaint
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                    Date of Service
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                    AI Check Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }} align="center">
                    ToDo Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }} align="center">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredNotes.map((note) => (
                  <TableRow 
                    key={note.encounterId} 
                    hover 
                    selected={selectedNotes.has(note.encounterId)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedNotes.has(note.encounterId)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectNote(note.encounterId, e.target.checked);
                        }}
                        disabled={bulkProcessing}
                      />
                    </TableCell>
                    <TableCell 
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleViewNote(note)}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {note.patientName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {note.status}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleViewNote(note)}
                    >
                      <Typography variant="body2">
                        {note.chiefComplaint}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleViewNote(note)}
                    >
                      <Typography variant="body2">
                        {aiNoteCheckerService.formatTimeAgo(note.dateOfService)}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleViewNote(note)}
                    >
                      <Chip
                        label={note.status}
                        size="small"
                        color={
                          note.status === 'PENDING_COSIGN' ? 'warning' :
                          note.status === 'CHECKED_OUT' ? 'info' :
                          note.status === 'WITH_PROVIDER' ? 'primary' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell 
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleViewNote(note)}
                    >
                      {getStatusChip(note)}
                      {note.lastCheckDate && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {aiNoteCheckerService.formatTimeAgo(note.lastCheckDate)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell 
                      align="center"
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleViewNote(note)}
                    >
                      {note.todoCreated ? (
                        <Chip
                          icon={<Assignment />}
                          label={note.todoCount && note.todoCount > 1 ? `${note.todoCount} ToDos` : 'ToDo Created'}
                          color="success"
                          size="small"
                          sx={{ fontWeight: 'bold' }}
                        />
                      ) : (
                        <Chip
                          label="No ToDo"
                          color="default"
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Check Note">
                        <IconButton
                          size="small"
                          onClick={() => handleCheckNote(note)}
                          disabled={checking.has(note.encounterId)}
                          color="primary"
                        >
                          <Psychology />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {filteredNotes.length === 0 && !loading && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Assignment sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {incompleteNotes.length === 0 
                  ? 'No incomplete notes found'
                  : `No ${currentFilter === 'all' ? '' : 
                      currentFilter === 'clean' ? 'clean ' :
                      currentFilter === 'issues' ? 'notes with issues ' :
                      currentFilter === 'issues-no-todos' ? 'notes with issues without ToDos ' :
                      'unchecked '}notes found`
                }
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {incompleteNotes.length === 0 
                  ? 'All notes have been completed, signed, or are less than 2 hours old'
                  : currentFilter !== 'all' ? `Try switching to another filter to see more notes.` : ''
                }
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default AINoteChecker;