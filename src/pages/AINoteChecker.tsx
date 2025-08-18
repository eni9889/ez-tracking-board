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
  Grid
} from '@mui/material';
import {
  Psychology,
  Refresh,
  Assignment,
  ArrowBack
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import aiNoteCheckerService from '../services/aiNoteChecker.service';

interface IncompleteNote {
  encounterId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  dateOfService: string;
  status: string;
  lastCheckStatus?: 'pending' | 'completed' | 'error' | null;
  lastCheckDate?: string | null;
  issuesFound?: boolean;
}

const AINoteChecker: React.FC = () => {
  const [incompleteNotes, setIncompleteNotes] = useState<IncompleteNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {} = useAuth();
  const navigate = useNavigate();

  // Check if we're in mock data mode
  const isUsingMockData = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

  useEffect(() => {
    fetchIncompleteNotes();
    
    // Auto-refresh every 30 seconds to pick up background job results
    const refreshInterval = setInterval(async () => {
      console.log('🔄 Auto-refreshing note check results...');
      setAutoRefreshing(true);
      await fetchIncompleteNotes();
      setAutoRefreshing(false);
    }, 30000); // 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, []);

  const fetchIncompleteNotes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch incomplete notes from EZDerm
      const notes = await aiNoteCheckerService.getIncompleteNotes();
      console.log(`📋 Fetched ${notes.length} incomplete notes from API`);
      
      // Check for duplicates on frontend side too
      const uniqueEncounterIds = new Set();
      const duplicateIds: string[] = [];
      notes.forEach(note => {
        if (uniqueEncounterIds.has(note.encounterId)) {
          duplicateIds.push(note.encounterId);
        } else {
          uniqueEncounterIds.add(note.encounterId);
        }
      });
      
      if (duplicateIds.length > 0) {
        console.warn(`⚠️ Frontend detected ${duplicateIds.length} duplicate encounter IDs:`, duplicateIds);
      }
      
      // Remove duplicates from frontend data as a safety measure
      const uniqueNotes = notes.filter((note, index, array) => 
        array.findIndex(n => n.encounterId === note.encounterId) === index
      );
      
      if (uniqueNotes.length !== notes.length) {
        console.log(`🔧 Removed ${notes.length - uniqueNotes.length} duplicate notes on frontend`);
      }
      
      // Get existing check results for these notes
      const checkResults = await aiNoteCheckerService.getNoteCheckResults(100, 0);
      const checkResultsMap = new Map(
        checkResults.map(result => [result.encounterId, result])
      );
      
      // Combine the data
      const notesWithStatus = uniqueNotes.map(note => ({
        ...note,
        lastCheckStatus: checkResultsMap.get(note.encounterId)?.status || null,
        lastCheckDate: checkResultsMap.get(note.encounterId)?.checkedAt || null,
        issuesFound: checkResultsMap.get(note.encounterId)?.issuesFound || false
      }));
      
      // Sort by date of service (newest first)
      const sortedNotes = notesWithStatus.sort((a, b) => {
        return new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime();
      });
      
      console.log(`✅ Final unique notes count: ${sortedNotes.length}`);
      setIncompleteNotes(sortedNotes);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch incomplete notes');
    } finally {
      setLoading(false);
    }
  };

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
      await fetchIncompleteNotes();
    } catch (err: any) {
      setError(err.message || 'Failed to check note');
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
      state: { note }
    });
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
          onClick={fetchIncompleteNotes}
          disabled={loading}
          size="small"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
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
              Last Refresh: <strong>{lastRefresh.toLocaleTimeString()}</strong>
            </Typography>
          </Grid>
        </Grid>
      </Box>

      {/* Error Alert */}
      {error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
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
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incompleteNotes.map((note) => (
                  <TableRow 
                    key={note.encounterId} 
                    hover 
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleViewNote(note)}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {note.patientName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {note.status}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {note.chiefComplaint}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {aiNoteCheckerService.formatTimeAgo(note.dateOfService)}
                      </Typography>
                    </TableCell>
                    <TableCell>
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
                    <TableCell>
                      {getStatusChip(note)}
                      {note.lastCheckDate && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {aiNoteCheckerService.formatTimeAgo(note.lastCheckDate)}
                        </Typography>
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
          
          {incompleteNotes.length === 0 && !loading && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Assignment sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No incomplete notes found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All notes have been completed, signed, or are less than 2 hours old
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default AINoteChecker;