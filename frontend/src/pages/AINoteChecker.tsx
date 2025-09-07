import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
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
  ExitToApp,
  PlayArrow
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEncounters } from '../contexts/EncountersContext';
import aiNoteCheckerService from '../services/aiNoteChecker.service';
import authService from '../services/auth.service';

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

type FilterType = 'all' | 'clean' | 'issues' | 'unchecked' | 'issues-no-todos';

const AINoteChecker: React.FC = () => {
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  // Check for returnToFilter state when component mounts (from back navigation)
  useEffect(() => {
    const navigationState = location.state as { returnToFilter?: FilterType } | null;
    if (navigationState?.returnToFilter) {
      console.log('🔄 Restoring filter from back navigation:', navigationState.returnToFilter);
      setCurrentFilter(navigationState.returnToFilter);
      
      // Clear the navigation state to prevent it from persisting
      navigate('/ai-note-checker', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  // Filter notes based on current filter
  const getFilteredNotes = (): IncompleteNote[] => {
    switch (currentFilter) {
      case 'clean':
        return incompleteNotes.filter(note => 
          note.lastCheckStatus === 'completed' && !note.issuesFound
        );
      case 'issues':
        return incompleteNotes.filter(note => 
          note.lastCheckStatus === 'completed' && note.hasValidIssues
        );
      case 'unchecked':
        return incompleteNotes.filter(note => 
          !note.lastCheckStatus || note.lastCheckStatus === 'pending'
        );
      case 'issues-no-todos':
        return incompleteNotes.filter(note => 
          note.lastCheckStatus === 'completed' && note.hasValidIssues && !note.todoCreated
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
        note.lastCheckStatus === 'completed' && note.hasValidIssues
      ).length,
      unchecked: incompleteNotes.filter(note => 
        !note.lastCheckStatus || note.lastCheckStatus === 'pending'
      ).length,
      'issues-no-todos': incompleteNotes.filter(note => 
        note.lastCheckStatus === 'completed' && note.hasValidIssues && !note.todoCreated
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

  const handleLogout = async () => {
    try {
      console.log('🏥 Manual logout requested from AI Note Checker');
      await authService.manualLogout(); // Clear stored credentials
      await logout(); // Clear auth context
      navigate('/login');
    } catch (error) {
      console.error('Manual logout error:', error);
      // Force navigation even if logout fails
      navigate('/login');
    }
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
      {/* Header with integrated summary - matching Dashboard style */}
      <Box sx={{ 
        backgroundColor: '#0a0a0a', 
        color: 'white', 
        px: 3, 
        py: 1.5,
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        borderBottom: '1px solid #1a1a1a'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            color="inherit" 
            onClick={() => navigate('/dashboard')}
            sx={{ 
              color: '#f8fafc',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
            }}
          >
            <ArrowBack />
          </IconButton>
          <Psychology sx={{ 
            fontSize: '2rem', 
            color: '#f8fafc',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
          }} />
          <Box>
            <Typography variant="h5" sx={{ 
              fontWeight: 600, 
              lineHeight: 1.2,
              color: '#f8fafc',
              letterSpacing: '-0.025em'
            }}>
              AI Note Checker
            </Typography>
            <Typography variant="body2" sx={{ 
              opacity: 0.8,
              color: '#e2e8f0',
              fontSize: '0.875rem',
              fontWeight: 400
            }}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })} • Updated: {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Never'}
            </Typography>
          </Box>
        </Box>

        {/* Integrated Summary Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Box sx={{ 
            textAlign: 'center',
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a'
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              lineHeight: 1,
              color: '#f8fafc',
              fontSize: '1.875rem'
            }}>
              {noteCounts.all}
            </Typography>
            <Typography variant="caption" sx={{ 
              fontSize: '0.75rem', 
              opacity: 0.8,
              color: '#94a3b8',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Total Notes
            </Typography>
          </Box>
          <Box sx={{ 
            textAlign: 'center',
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a'
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              lineHeight: 1, 
              color: '#ef4444',
              fontSize: '1.875rem'
            }}>
              {noteCounts.issues}
            </Typography>
            <Typography variant="caption" sx={{ 
              fontSize: '0.75rem', 
              opacity: 0.8,
              color: '#94a3b8',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              With Issues
            </Typography>
          </Box>
          <Box sx={{ 
            textAlign: 'center',
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a'
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              lineHeight: 1, 
              color: '#10b981',
              fontSize: '1.875rem'
            }}>
              {noteCounts.clean}
            </Typography>
            <Typography variant="caption" sx={{ 
              fontSize: '0.75rem', 
              opacity: 0.8,
              color: '#94a3b8',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Clean Notes
            </Typography>
          </Box>
          <Box sx={{ 
            textAlign: 'center',
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a'
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              lineHeight: 1, 
              color: '#fbbf24',
              fontSize: '1.875rem'
            }}>
              {noteCounts.unchecked}
            </Typography>
            <Typography variant="caption" sx={{ 
              fontSize: '0.75rem', 
              opacity: 0.8,
              color: '#94a3b8',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Unchecked
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={refreshEncounters} 
                disabled={loading || autoRefreshing}
                sx={{ 
                  color: '#f8fafc',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: 2,
                  p: 1.5,
                  '&:hover': {
                    backgroundColor: '#2a2a2a',
                    borderColor: '#3a3a3a'
                  },
                  '&:disabled': {
                    color: '#64748b',
                    backgroundColor: '#0f0f0f',
                    borderColor: '#1a1a1a'
                  }
                }}
              >
                {autoRefreshing ? (
                  <CircularProgress size={20} sx={{ color: '#f8fafc' }} />
                ) : (
                  <Refresh sx={{ fontSize: '1.25rem' }} />
                )}
              </IconButton>
            </Tooltip>
            {selectedNotes.size > 0 && (
              <Tooltip title={`Force Re-check ${selectedNotes.size} selected notes`}>
                <IconButton 
                  onClick={handleBulkForceRecheck}
                  disabled={bulkProcessing || loading}
                  sx={{ 
                    color: '#f8fafc',
                    backgroundColor: '#f59e0b',
                    border: '1px solid #fbbf24',
                    borderRadius: 2,
                    p: 1.5,
                    '&:hover': {
                      backgroundColor: '#d97706',
                      borderColor: '#f59e0b'
                    },
                    '&:disabled': {
                      color: '#64748b',
                      backgroundColor: '#0f0f0f',
                      borderColor: '#1a1a1a'
                    }
                  }}
                >
                  {bulkProcessing ? (
                    <CircularProgress size={20} sx={{ color: '#f8fafc' }} />
                  ) : (
                    <PlayArrow sx={{ fontSize: '1.25rem' }} />
                  )}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Logout">
              <IconButton 
                onClick={handleLogout} 
                sx={{ 
                  color: '#f8fafc',
                  backgroundColor: '#dc2626',
                  border: '1px solid #ef4444',
                  borderRadius: 2,
                  p: 1.5,
                  '&:hover': {
                    backgroundColor: '#b91c1c',
                    borderColor: '#dc2626'
                  }
                }}
              >
                <ExitToApp sx={{ fontSize: '1.25rem' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>


      {/* Filter Tabs */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider', 
        backgroundColor: 'white',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      }}>
        <Tabs 
          value={currentFilter} 
          onChange={(_, newValue) => setCurrentFilter(newValue as FilterType)}
          sx={{ 
            px: 3,
            '& .MuiTabs-indicator': {
              backgroundColor: '#0a0a0a',
              height: 3
            },
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: '0.875rem',
              textTransform: 'none',
              minHeight: 48,
              '&.Mui-selected': {
                color: '#0a0a0a'
              }
            }
          }}
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
      <Box sx={{ flex: 1, px: 1, py: 0.5 }}>
        <Paper sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: 2,
          '& .MuiTable-root': {
            minWidth: 'unset'
          }
        }}>
          <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
            <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ '& th': { backgroundColor: '#f8f9fa', fontWeight: 'bold', py: 1.5 } }}>
                  <TableCell sx={{ width: '50px', textAlign: 'center', fontSize: '1.1rem' }}>
                    <Checkbox
                      checked={selectedNotes.size === filteredNotes.length && filteredNotes.length > 0}
                      indeterminate={selectedNotes.size > 0 && selectedNotes.size < filteredNotes.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={bulkProcessing}
                    />
                  </TableCell>
                  <TableCell sx={{ width: '200px', fontSize: '1.1rem' }}>
                    Patient
                  </TableCell>
                  <TableCell sx={{ width: '250px', fontSize: '1.1rem' }}>
                    Chief Complaint
                  </TableCell>
                  <TableCell sx={{ width: '120px', fontSize: '1.1rem' }}>
                    Date of Service
                  </TableCell>
                  <TableCell sx={{ width: '120px', fontSize: '1.1rem' }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ width: '140px', fontSize: '1.1rem' }}>
                    AI Check Status
                  </TableCell>
                  <TableCell sx={{ width: '120px', fontSize: '1.1rem', textAlign: 'center' }}>
                    ToDo Status
                  </TableCell>
                  <TableCell sx={{ width: '100px', fontSize: '1.1rem', textAlign: 'center' }}>
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
                    sx={{
                      height: '80px',
                      '&:hover': {
                        backgroundColor: '#f5f5f5'
                      },
                      '&.Mui-selected': {
                        backgroundColor: '#e3f2fd'
                      }
                    }}
                  >
                    <TableCell sx={{ textAlign: 'center', height: '80px', verticalAlign: 'middle' }}>
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
                      sx={{ cursor: 'pointer', height: '80px', verticalAlign: 'middle' }}
                      onClick={() => handleViewNote(note)}
                    >
                      <Typography variant="h6" sx={{ 
                        fontWeight: 'bold', 
                        lineHeight: 1, 
                        fontSize: '1.1rem',
                        mb: 0.5
                      }}>
                        {note.patientName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
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