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
import MobileHeader from '../components/MobileHeader';
import MobileFilters from '../components/MobileFilters';
import PullToRefresh from '../components/PullToRefresh';
import MobileFAB from '../components/MobileFAB';
import NoteCardList from '../components/NoteCardList';
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

type FilterType = 'all' | 'clean' | 'issues' | 'unchecked' | 'issues-no-todos';

const AINoteChecker: React.FC = () => {
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('dateDesc');
  const [checkingUpdates, setCheckingUpdates] = useState<Set<string>>(new Set());
  const [notesWithUpdates, setNotesWithUpdates] = useState<Set<string>>(new Set());

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
  const { isMobile, isDesktop } = useResponsive();

  // Check if we're in mock data mode
  const isUsingMockData = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

  // Function to check for note updates
  const checkForUpdates = async (notes: IncompleteNote[]) => {
    const updatePromises = notes
      .filter(note => note.lastCheckStatus) // Only check notes that have been checked before
      .slice(0, 10) // Limit to first 10 to avoid overwhelming the API
      .map(async (note) => {
        try {
          setCheckingUpdates(prev => new Set(prev).add(note.encounterId));
          const updateStatus = await aiNoteCheckerService.checkForUpdates(note.encounterId, note.patientId);
          
          if (updateStatus.hasUpdate) {
            console.log(`📝 Update detected for encounter ${note.encounterId}`);
            setNotesWithUpdates(prev => new Set(prev).add(note.encounterId));
            return note.encounterId;
          }
          return null;
        } catch (error) {
          console.error(`Error checking updates for ${note.encounterId}:`, error);
          return null;
        } finally {
          setCheckingUpdates(prev => {
            const newSet = new Set(prev);
            newSet.delete(note.encounterId);
            return newSet;
          });
        }
      });

    await Promise.all(updatePromises);
  };

  useEffect(() => {
    loadEncounters();
    
    // Auto-refresh every 15 seconds to pick up background job results faster
    const refreshInterval = setInterval(async () => {
      console.log('🔄 Auto-refreshing note check results...');
      setAutoRefreshing(true);
      try {
        await refreshEncounters();
        
        // Also check for note updates periodically
        if (incompleteNotes.length > 0) {
          console.log('🔍 Checking for note updates...');
          await checkForUpdates(incompleteNotes);
        }
      } catch (error) {
        console.error('Error during auto-refresh:', error);
      } finally {
        setAutoRefreshing(false);
      }
    }, 15000); // 15 seconds (reduced from 30)
    
    return () => clearInterval(refreshInterval);
  }, [loadEncounters, refreshEncounters, incompleteNotes]);

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

  // Filter, search, and sort notes
  const getFilteredAndSortedNotes = (): IncompleteNote[] => {
    let filtered = incompleteNotes;

    // Apply filter
    switch (currentFilter) {
      case 'clean':
        filtered = incompleteNotes.filter(note => 
          note.lastCheckStatus === 'completed' && !note.issuesFound
        );
        break;
      case 'issues':
        filtered = incompleteNotes.filter(note => 
          note.lastCheckStatus === 'completed' && note.hasValidIssues
        );
        break;
      case 'unchecked':
        filtered = incompleteNotes.filter(note => 
          !note.lastCheckStatus || note.lastCheckStatus === 'pending'
        );
        break;
      case 'issues-no-todos':
        filtered = incompleteNotes.filter(note => 
          note.lastCheckStatus === 'completed' && note.hasValidIssues && !note.todoCreated
        );
        break;
      case 'all':
      default:
        filtered = incompleteNotes;
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(note => 
        note.patientName.toLowerCase().includes(query) ||
        note.chiefComplaint.toLowerCase().includes(query) ||
        note.status.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dateAsc':
          return new Date(a.dateOfService).getTime() - new Date(b.dateOfService).getTime();
        case 'dateDesc':
          return new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime();
        case 'patientName':
          return a.patientName.localeCompare(b.patientName);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'aiStatus':
          // Sort by AI check status priority
          const getAIStatusPriority = (note: IncompleteNote) => {
            if (!note.lastCheckStatus) return 0; // Unchecked first
            if (note.lastCheckStatus === 'error') return 1; // Errors second
            if (note.issuesFound) return 2; // Issues third
            return 3; // Clean last
          };
          return getAIStatusPriority(a) - getAIStatusPriority(b);
        default:
          return new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime();
      }
    });

    return filtered;
  };

  const filteredNotes = getFilteredAndSortedNotes();

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
      // Check if note has updates and force recheck if so
      const hasUpdates = notesWithUpdates.has(note.encounterId);
      
      await aiNoteCheckerService.checkSingleNote(
        note.encounterId,
        note.patientId,
        note.patientName,
        note.chiefComplaint,
        note.dateOfService,
        hasUpdates // Force recheck if note has updates
      );
      
      // Clear the update status since we just rechecked
      if (hasUpdates) {
        setNotesWithUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(note.encounterId);
          return newSet;
        });
      }
      
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

  // Bulk AI check functionality - ENQUEUE JOBS, don't run synchronously
  const handleBulkCheck = async () => {
    if (selectedNotes.size === 0) {
      setLocalError('Please select at least one note to check');
      return;
    }

    setBulkProcessing(true);
    setLocalError(null);

    try {
      const selectedNotesArray = incompleteNotes.filter(note => 
        selectedNotes.has(note.encounterId)
      );

      // Enqueue all selected notes as jobs for regular AI check
      const jobs = selectedNotesArray.map(note => ({
        encounterId: note.encounterId,
        patientId: note.patientId,
        patientName: note.patientName,
        chiefComplaint: note.chiefComplaint,
        dateOfService: note.dateOfService
      }));

      // Call the backend to enqueue all jobs at once
      await aiNoteCheckerService.enqueueBulkCheck(jobs);

      // Clear selection after enqueuing
      setSelectedNotes(new Set());

      // Show success message
      setLocalError(null);
      console.log(`✅ Enqueued ${jobs.length} notes for AI check`);

    } catch (err: any) {
      console.error('Error enqueuing bulk AI check jobs:', err);
      setLocalError(err.message || 'Failed to enqueue bulk AI check jobs');
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
      {/* Mobile Header */}
      <MobileHeader
        title="AI Note Checker"
        subtitle={`${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        })} • Updated: ${lastRefresh ? lastRefresh.toLocaleTimeString() : 'Never'}`}
        noteCounts={noteCounts}
        selectedNotesCount={selectedNotes.size}
        loading={loading}
        autoRefreshing={autoRefreshing}
        bulkProcessing={bulkProcessing}
        onBack={() => navigate('/dashboard')}
        onRefresh={refreshEncounters}
        onBulkForceRecheck={selectedNotes.size > 0 ? handleBulkForceRecheck : undefined}
        onLogout={handleLogout}
        showBackButton={true}
        showStats={true}
      />

      {/* Desktop Header - only show on desktop */}
      {isDesktop && (
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
              Total Notes (All Pages)
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
      )}

      {/* Mobile Filters */}
      <MobileFilters
        currentFilter={currentFilter}
        noteCounts={noteCounts}
        onFilterChange={setCurrentFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Desktop Filter Tabs - only show on desktop */}
      {isDesktop && (
        <Box sx={{ 
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          borderBottom: '2px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent)'
          }
        }}>
        
        <Tabs 
          value={currentFilter} 
          onChange={(_, newValue) => setCurrentFilter(newValue as FilterType)}
          sx={{ 
            px: 4,
            '& .MuiTabs-indicator': {
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              height: 4,
              borderRadius: '2px 2px 0 0',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            },
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '0.95rem',
              textTransform: 'none',
              minHeight: 56,
              px: 3,
              py: 2,
              borderRadius: '8px 8px 0 0',
              margin: '0 2px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(29, 78, 216, 0.05))',
                opacity: 0,
                transition: 'opacity 0.3s ease'
              },
              '&:hover': {
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                transform: 'translateY(-1px)',
                '&::before': {
                  opacity: 1
                }
              },
              '&.Mui-selected': {
                color: '#1e40af',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                fontWeight: 800,
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
                '&::before': {
                  opacity: 1
                }
              }
            }
          }}
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <span>All Notes (All Pages)</span>
                <Box sx={{
                  backgroundColor: 'rgba(100, 116, 139, 0.15)',
                  color: '#475569',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  minWidth: '28px',
                  textAlign: 'center',
                  border: '1px solid rgba(100, 116, 139, 0.2)'
                }}>
                  {noteCounts.all}
                </Box>
              </Box>
            } 
            value="all" 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <span>Clean Notes</span>
                <Box sx={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#059669',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  minWidth: '28px',
                  textAlign: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  {noteCounts.clean}
                </Box>
              </Box>
            } 
            value="clean" 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <span>Notes with Issues</span>
                <Box sx={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#dc2626',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  minWidth: '28px',
                  textAlign: 'center',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                  {noteCounts.issues}
                </Box>
              </Box>
            } 
            value="issues" 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <span>Unchecked Notes</span>
                <Box sx={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#d97706',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  minWidth: '28px',
                  textAlign: 'center',
                  border: '1px solid rgba(245, 158, 11, 0.3)'
                }}>
                  {noteCounts.unchecked}
                </Box>
              </Box>
            } 
            value="unchecked" 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <span>Issues Without ToDos</span>
                <Box sx={{
                  backgroundColor: 'rgba(220, 38, 38, 0.15)',
                  color: '#b91c1c',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  minWidth: '28px',
                  textAlign: 'center',
                  border: '1px solid rgba(220, 38, 38, 0.3)'
                }}>
                  {noteCounts['issues-no-todos']}
                </Box>
              </Box>
            } 
            value="issues-no-todos" 
          />
        </Tabs>
        </Box>
      )}

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

      {/* Notes Table with Pull to Refresh */}
      <Box sx={{ 
        flex: 1, 
        px: isMobile ? 1 : 1, 
        py: 0.5,
        overflow: 'hidden'
      }}>
        <Paper sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: 2,
          borderRadius: isMobile ? 2 : 1,
          '& .MuiTable-root': {
            minWidth: 'unset'
          }
        }}>
          <PullToRefresh
            onRefresh={async () => {
              await refreshEncounters();
            }}
            disabled={loading || autoRefreshing}
          >
            {/* Mobile Card List */}
            {isMobile ? (
              <NoteCardList
                notes={filteredNotes}
                selectedNotes={selectedNotes}
                checkingNotes={checking}
                onSelectNote={handleSelectNote}
                onSelectAll={handleSelectAll}
                onCheckNote={handleCheckNote}
                onViewNote={handleViewNote}
                bulkProcessing={bulkProcessing}
                currentFilter={currentFilter}
                checkingUpdates={checkingUpdates}
                notesWithUpdates={notesWithUpdates}
              />
            ) : (
              /* Desktop Table */
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
            <Table stickyHeader size={isMobile ? "medium" : "small"} sx={{ 
              tableLayout: isMobile ? 'auto' : 'fixed',
              minWidth: isMobile ? 'unset' : '1200px'
            }}>
              <TableHead>
                <TableRow sx={{ '& th': { 
                  backgroundColor: '#f8f9fa', 
                  fontWeight: 'bold', 
                  py: isMobile ? 2 : 1.5,
                  fontSize: isMobile ? '0.9rem' : '1.1rem'
                } }}>
                  <TableCell sx={{ 
                    width: isMobile ? '40px' : '50px', 
                    textAlign: 'center',
                    display: isMobile ? 'none' : 'table-cell' // Hide checkbox on mobile for now
                  }}>
                    <Checkbox
                      checked={selectedNotes.size === filteredNotes.length && filteredNotes.length > 0}
                      indeterminate={selectedNotes.size > 0 && selectedNotes.size < filteredNotes.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={bulkProcessing}
                      size={isMobile ? "small" : "medium"}
                    />
                  </TableCell>
                  <TableCell sx={{ 
                    width: isMobile ? 'auto' : '200px',
                    minWidth: isMobile ? '120px' : 'auto'
                  }}>
                    Patient
                  </TableCell>
                  <TableCell sx={{ 
                    width: isMobile ? 'auto' : '250px',
                    display: isMobile ? 'none' : 'table-cell' // Hide on mobile
                  }}>
                    Chief Complaint
                  </TableCell>
                  <TableCell sx={{ 
                    width: isMobile ? 'auto' : '120px',
                    display: isMobile ? 'none' : 'table-cell' // Hide on mobile
                  }}>
                    Date of Service
                  </TableCell>
                  <TableCell sx={{ 
                    width: isMobile ? 'auto' : '120px',
                    display: isMobile ? 'none' : 'table-cell' // Hide on mobile
                  }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ 
                    width: isMobile ? 'auto' : '140px',
                    minWidth: isMobile ? '100px' : 'auto'
                  }}>
                    {isMobile ? 'AI Status' : 'AI Check Status'}
                  </TableCell>
                  <TableCell sx={{ 
                    width: isMobile ? 'auto' : '120px', 
                    textAlign: 'center',
                    display: isMobile ? 'none' : 'table-cell' // Hide on mobile
                  }}>
                    ToDo Status
                  </TableCell>
                  <TableCell sx={{ 
                    width: isMobile ? '60px' : '100px',
                    textAlign: 'center'
                  }}>
                    {isMobile ? '' : 'Actions'}
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
                      height: isMobile ? 'auto' : '80px',
                      minHeight: isMobile ? '60px' : '80px',
                      '&:hover': {
                        backgroundColor: '#f5f5f5'
                      },
                      '&.Mui-selected': {
                        backgroundColor: '#e3f2fd'
                      },
                      cursor: 'pointer'
                    }}
                    onClick={() => handleViewNote(note)}
                  >
                    <TableCell sx={{ 
                      textAlign: 'center', 
                      height: isMobile ? 'auto' : '80px', 
                      verticalAlign: 'middle',
                      display: isMobile ? 'none' : 'table-cell',
                      py: isMobile ? 1 : 2
                    }}>
                      <Checkbox
                        checked={selectedNotes.has(note.encounterId)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectNote(note.encounterId, e.target.checked);
                        }}
                        disabled={bulkProcessing}
                        size={isMobile ? "small" : "medium"}
                      />
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        cursor: 'pointer', 
                        height: isMobile ? 'auto' : '80px', 
                        verticalAlign: 'middle',
                        py: isMobile ? 1.5 : 2
                      }}
                    >
                      <Typography variant="h6" sx={{ 
                        fontWeight: 'bold', 
                        lineHeight: 1, 
                        fontSize: isMobile ? '0.95rem' : '1.1rem',
                        mb: 0.5
                      }}>
                        {note.patientName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ 
                        fontSize: isMobile ? '0.8rem' : '0.9rem',
                        mb: isMobile ? 0.5 : 0
                      }}>
                        {note.status}
                      </Typography>
                      {/* Show additional info on mobile */}
                      {isMobile && (
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ 
                            fontSize: '0.8rem',
                            mb: 0.5
                          }}>
                            {note.chiefComplaint}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ 
                            fontSize: '0.75rem'
                          }}>
                            {aiNoteCheckerService.formatTimeAgo(note.dateOfService)}
                          </Typography>
                        </>
                      )}
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        cursor: 'pointer',
                        display: isMobile ? 'none' : 'table-cell'
                      }}
                    >
                      <Typography variant="body2">
                        {note.chiefComplaint}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        cursor: 'pointer',
                        display: isMobile ? 'none' : 'table-cell'
                      }}
                    >
                      <Typography variant="body2">
                        {aiNoteCheckerService.formatTimeAgo(note.dateOfService)}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        cursor: 'pointer',
                        display: isMobile ? 'none' : 'table-cell'
                      }}
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
                      sx={{ 
                        cursor: 'pointer',
                        py: isMobile ? 1.5 : 2,
                        verticalAlign: 'middle'
                      }}
                    >
                      {getStatusChip(note)}
                      {!isMobile && note.lastCheckDate && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {aiNoteCheckerService.formatTimeAgo(note.lastCheckDate)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell 
                      align="center"
                      sx={{ 
                        cursor: 'pointer',
                        display: isMobile ? 'none' : 'table-cell'
                      }}
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
                    <TableCell 
                      align="center" 
                      onClick={(e) => e.stopPropagation()}
                      sx={{ 
                        py: isMobile ? 1.5 : 2,
                        verticalAlign: 'middle'
                      }}
                    >
                      <Tooltip title="Check Note">
                        <IconButton
                          size={isMobile ? "medium" : "small"}
                          onClick={() => handleCheckNote(note)}
                          disabled={checking.has(note.encounterId)}
                          color="primary"
                          sx={{
                            minWidth: isMobile ? '44px' : 'auto',
                            minHeight: isMobile ? '44px' : 'auto'
                          }}
                        >
                          <Psychology sx={{ fontSize: isMobile ? '1.2rem' : '1rem' }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
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
          </TableContainer>
            )}
          </PullToRefresh>
        </Paper>
      </Box>

      {/* Mobile Floating Action Button */}
      <MobileFAB
        selectedCount={selectedNotes.size}
        onRefresh={refreshEncounters}
        onBulkCheck={selectedNotes.size > 0 ? handleBulkCheck : undefined}
        onBulkForceRecheck={selectedNotes.size > 0 ? handleBulkForceRecheck : undefined}
        refreshing={loading || autoRefreshing}
        bulkProcessing={bulkProcessing}
      />
    </Box>
  );
};

export default AINoteChecker;