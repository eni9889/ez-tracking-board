import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Alert,
  IconButton,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  Collapse,
  Tooltip,
  Stack,
  FormControlLabel,
  Checkbox,
  TextField
} from '@mui/material';
import {
  ArrowBack,
  Psychology,
  Refresh,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Assignment,
  Visibility,
  VisibilityOff,
  Description,
  Assessment,
  LocalHospital,
  NavigateBefore,
  NavigateNext,
  Person,
  Group,
  Badge,
  MedicalServices,
  Block,
  Edit,
  Save,
  Cancel,
  ExpandMore,
  ExpandLess,
  TaskAlt
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEncounters } from '../contexts/EncountersContext';
import aiNoteCheckerService, { NoteCheckResult, AIAnalysisIssue, CareTeamMember, CreatedToDo, InvalidIssue, ResolvedIssue } from '../services/aiNoteChecker.service';
import MobileNoteDetailHeader from '../components/MobileNoteDetailHeader';
import MobileNoteContent from '../components/MobileNoteContent';
import MobileToDoDialog from '../components/MobileToDoDialog';
import MobileSignOffDialog from '../components/MobileSignOffDialog';
import useResponsive from '../hooks/useResponsive';

interface NoteData {
  encounterId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  dateOfService: string;
  status: string;
  lastCheckStatus?: string | null;
  lastCheckDate?: string | null;
  issuesFound?: boolean;
}

interface CachedNoteData {
  progressNoteData: any;
  careTeam: CareTeamMember[];
  checkHistory: NoteCheckResult[];
  createdTodos: CreatedToDo[];
  invalidIssues: InvalidIssue[];
  resolvedIssues: ResolvedIssue[];
}

const NoteDetail: React.FC = () => {
  const { encounterId } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = useAuth();
  const { encounters: allEncounters, loading: encountersLoading, refreshEncounters } = useEncounters();
  const { isMobile, isDesktop, isTablet } = useResponsive();

  // Simplified state management with data cache
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [noteDataCache, setNoteDataCache] = useState<Map<string, CachedNoteData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToDoModal, setShowToDoModal] = useState(false);
  const [modalState, setModalState] = useState<'preview' | 'loading' | 'success' | 'error'>('preview');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [forceNewCheck, setForceNewCheck] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedIssues, setCollapsedIssues] = useState<Set<string>>(new Set());
  const [careTeamCollapsed, setCareTeamCollapsed] = useState(true); // Default to collapsed on desktop
  const [todosCollapsed, setTodosCollapsed] = useState(false); // Default to expanded for todos
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [todoStatuses, setTodoStatuses] = useState<Map<string, any>>(new Map());
  const [signingOff, setSigningOff] = useState(false);
  const [currentUserProviderId, setCurrentUserProviderId] = useState<string | null>(null);
  const [noteSignedOff, setNoteSignedOff] = useState(false);
  const [signOffInfo, setSignOffInfo] = useState<string | null>(null);
  const [showSignOffSuccessAlert, setShowSignOffSuccessAlert] = useState(false);
  const [editingHPI, setEditingHPI] = useState<{ sectionIndex: number; itemIndex: number } | null>(null);
  const [hpiEditText, setHpiEditText] = useState('');
  const [savingHPI, setSavingHPI] = useState(false);

  // Fetch current user's provider ID
  useEffect(() => {
    const fetchUserProviderInfo = async () => {
      if (user) {
        try {
          const providerInfo = await aiNoteCheckerService.getCurrentUserProviderInfo();
          setCurrentUserProviderId(providerInfo.providerId);
          console.log('✅ Current user provider ID:', providerInfo.providerId);
        } catch (error) {
          console.error('Failed to get current user provider info:', error);
        }
      }
    };

    fetchUserProviderInfo();
  }, [user]);

  // Initialize notes array from encounters context - use pre-sorted filteredNotes from navigation state
  useEffect(() => {
    if (!encountersLoading && encounterId) {
      // Get filter and sort context from navigation state
      const navigationState = location.state as { 
        currentFilter?: string; 
        filteredNotes?: NoteData[];
        sortBy?: string;
      } | null;
      
      const currentFilter = navigationState?.currentFilter;
      const preSortedFilteredNotes = navigationState?.filteredNotes;
      const sortBy = navigationState?.sortBy;
      
      console.log('🔍 NoteDetail filtering:', {
        currentFilter,
        sortBy,
        allEncountersCount: allEncounters.length,
        preSortedCount: preSortedFilteredNotes?.length,
        encounterId,
        navigationState
      });
      
      let filteredNotes: NoteData[];
      
      // Use pre-sorted and pre-filtered notes if available, otherwise fall back to manual filtering
      if (preSortedFilteredNotes && preSortedFilteredNotes.length > 0) {
        console.log('✅ Using pre-sorted filteredNotes from navigation state');
        filteredNotes = preSortedFilteredNotes;
      } else {
        console.log('⚠️ Fallback to manual filtering (no pre-sorted notes available)');
        
        // Check if current encounter exists in allEncounters
        const currentEncounter = allEncounters.find(note => note.encounterId === encounterId);
        
        if (!currentEncounter || allEncounters.length === 0) {
          console.log('⚠️ Current encounter not found in allEncounters or allEncounters is empty, creating single-note array');
          // If the current encounter isn't in allEncounters, create a minimal note entry
          // This happens when accessing direct URL before main page loads all encounters
          filteredNotes = [{
            encounterId: encounterId,
            patientId: '', // Will be loaded from note data
            patientName: 'Loading...', // Will be updated when note data loads
            chiefComplaint: '',
            dateOfService: '',
            status: '',
            lastCheckStatus: null
          }];
        } else {
          filteredNotes = allEncounters;
        
          // Filter notes based on the tab the user came from
          if (currentFilter === 'issues') {
            filteredNotes = allEncounters.filter(note => note.lastCheckStatus === 'completed' && note.hasValidIssues === true);
          } else if (currentFilter === 'clean') {
            filteredNotes = allEncounters.filter(note => note.lastCheckStatus === 'completed' && (!note.issuesFound || !note.hasValidIssues));
          } else if (currentFilter === 'unchecked') {
            filteredNotes = allEncounters.filter(note => !note.lastCheckStatus || note.lastCheckStatus === 'pending');
          } else if (currentFilter === 'issues-no-todos') {
            filteredNotes = allEncounters.filter(note => note.lastCheckStatus === 'completed' && note.hasValidIssues === true && !note.todoCreated);
          } else if (currentFilter === 'issues-with-todos') {
            filteredNotes = allEncounters.filter(note => note.lastCheckStatus === 'completed' && note.hasValidIssues === true && note.todoCreated);
          }
          
          // Apply sorting if sortBy is provided
          if (sortBy) {
            filteredNotes.sort((a, b) => {
              switch (sortBy) {
                case 'dateAsc':
                  return new Date(a.dateOfService).getTime() - new Date(b.dateOfService).getTime();
                case 'dateDesc':
                  return new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime();
                case 'patientName':
                  return a.patientName.localeCompare(b.patientName);
                case 'status':
                  return a.status.localeCompare(b.status);
                default:
                  return new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime();
              }
            });
          }
        }
      }
      
      console.log('🔍 Final navigation results:', {
        currentFilter,
        sortBy,
        filteredCount: filteredNotes.length,
        sampleNotes: filteredNotes.slice(0, 3).map(n => ({
          encounterId: n.encounterId,
          patientName: n.patientName,
          dateOfService: n.dateOfService,
          lastCheckStatus: n.lastCheckStatus,
          issuesFound: n.issuesFound
        }))
      });
      
      setNotes(filteredNotes);
      
      // Find current note index in the filtered array
      if (encounterId) {
        const index = filteredNotes.findIndex(note => note.encounterId === encounterId);
        if (index !== -1) {
          setCurrentIndex(index);
        } else {
          // If current note is not in filtered results, start with the first one
          setCurrentIndex(0);
        }
      }
    }
  }, [allEncounters, encountersLoading, encounterId, location.state]);

  // Get current note
  const currentNote = notes[currentIndex];
  
  // Debug logging for cache investigation
  if (currentNote) {
    console.log('🔍 Current note:', {
      encounterId: currentNote.encounterId,
      patientName: currentNote.patientName,
      currentIndex,
      cacheKeys: Array.from(noteDataCache.keys()),
      hasCachedData: noteDataCache.has(currentNote.encounterId)
    });
  }
  
  // Get current note data from cache or defaults
  const currentNoteData = currentNote ? noteDataCache.get(currentNote.encounterId) : null;
  const progressNoteData = currentNoteData?.progressNoteData || null;
  
  // Debug progress note data retrieval
  if (currentNote && progressNoteData) {
    const patientNameFromNote = progressNoteData?.patientInfo?.name || 
                               progressNoteData?.patientName || 
                               'Unknown Patient';
    console.log('📋 Progress note data retrieved:', {
      encounterId: currentNote.encounterId,
      expectedPatient: currentNote.patientName,
      actualPatientFromNote: patientNameFromNote,
      isCorrectPatient: patientNameFromNote === currentNote.patientName || patientNameFromNote === 'Unknown Patient'
    });
  }
  const careTeam = currentNoteData?.careTeam || [];
  const checkHistory = currentNoteData?.checkHistory || [];
  const createdTodos = currentNoteData?.createdTodos || [];
  const invalidIssues = currentNoteData?.invalidIssues || [];
  const resolvedIssues = currentNoteData?.resolvedIssues || [];

  // Load data for a specific encounter
  const loadNoteData = useCallback(async (encounterId: string, patientId: string) => {
    try {
      const [noteResponse, history, todos, invalid, resolved] = await Promise.all([
        aiNoteCheckerService.getProgressNote(encounterId, patientId),
        fetchCheckHistory(encounterId),
        fetchCreatedTodos(encounterId),
        fetchInvalidIssues(encounterId),
        fetchResolvedIssues(encounterId)
      ]);

      // Check if note is already signed off
      checkIfNoteSignedOff(noteResponse.progressNote);

      // Cache the data
      setNoteDataCache(prev => new Map(prev).set(encounterId, {
        progressNoteData: noteResponse.progressNote,
        careTeam: noteResponse.careTeam,
        checkHistory: history,
        createdTodos: todos,
        invalidIssues: invalid,
        resolvedIssues: resolved
      }));

    } catch (err: any) {
      console.error('Error loading note data:', err);
      setError(err.message || 'Failed to load note data');
    }
  }, []);

  // Handle direct URL access - load note data immediately if we have no navigation context
  useEffect(() => {
    const handleDirectAccess = async () => {
      if (encounterId && notes.length > 0) {
        const currentNote = notes[currentIndex];
        const isDirectAccess = !location.state && currentNote?.patientName === 'Loading...';
        
        if (isDirectAccess) {
          console.log('🔗 Direct URL access detected, loading note data immediately');
          setLoading(true);
          
          try {
            // First, try to get encounter data from allEncounters context if available
            let patientId = '';
            let patientName = 'Loading...';
            let chiefComplaint = '';
            let dateOfService = '';
            let status = '';
            
            // Check if encounter exists in allEncounters (might be available now)
            const encounter = allEncounters.find(enc => enc.encounterId === encounterId);
            if (encounter) {
              patientId = encounter.patientId;
              patientName = encounter.patientName;
              chiefComplaint = encounter.chiefComplaint;
              dateOfService = encounter.dateOfService;
              status = encounter.status;
              console.log('✅ Found encounter in allEncounters for direct access');
            } else {
              // Fallback: try to get some info from progress note API
              console.log('⚠️ Encounter not in allEncounters, using progress note API');
              const noteResponse = await aiNoteCheckerService.getProgressNote(encounterId, '');
              // Since ProgressNoteResponse doesn't have patient info, we'll load it with empty data
              // The loadNoteData call will handle getting the actual data
            }
            
            // Update the note data with real patient info
            setNotes(prev => prev.map(note => 
              note.encounterId === encounterId 
                ? {
                    ...note,
                    patientId,
                    patientName: patientName || 'Loading...',
                    chiefComplaint,
                    dateOfService,
                    status
                  }
                : note
            ));
            
            // Load complete note data (this will work even with empty patientId)
            await loadNoteData(encounterId, patientId);
            
          } catch (error) {
            console.error('Failed to load note data for direct access:', error);
            setError('Failed to load note data');
          } finally {
            setLoading(false);
          }
        }
      }
    };

    handleDirectAccess();
  }, [encounterId, notes, currentIndex, location.state, loadNoteData, allEncounters]);

  // Load data for current note when index changes
  useEffect(() => {
    if (currentNote && !noteDataCache.has(currentNote.encounterId)) {
      setLoading(true);
      loadNoteData(currentNote.encounterId, currentNote.patientId).finally(() => {
        setLoading(false);
      });
    } else if (currentNote) {
      setLoading(false); // Data is already cached
    }
  }, [currentNote, noteDataCache, loadNoteData]);

  // Check sign-off status whenever current note changes (even for cached data)
  useEffect(() => {
    if (currentNote && noteDataCache.has(currentNote.encounterId)) {
      const cachedData = noteDataCache.get(currentNote.encounterId);
      if (cachedData?.progressNoteData) {
        checkIfNoteSignedOff(cachedData.progressNoteData);
      }
    }
    
    // Reset success alert when switching notes
    setShowSignOffSuccessAlert(false);
  }, [currentNote, noteDataCache]);

  // Helper functions to fetch data for a specific encounter
  const fetchCheckHistory = async (encounterId: string): Promise<NoteCheckResult[]> => {
    try {
      return await aiNoteCheckerService.getNoteCheckHistory(encounterId);
    } catch (err) {
      console.error('Error fetching check history:', err);
      return [];
    }
  };

  const fetchCreatedTodos = async (encounterId: string): Promise<CreatedToDo[]> => {
    try {
      return await aiNoteCheckerService.getCreatedToDos(encounterId);
    } catch (err: any) {
      console.error('Error fetching created ToDos:', err);
      return [];
    }
  };

  const fetchInvalidIssues = async (encounterId: string): Promise<InvalidIssue[]> => {
    try {
      return await aiNoteCheckerService.getInvalidIssues(encounterId);
    } catch (err: any) {
      console.error('Error fetching invalid issues:', err);
      return [];
    }
  };

  const fetchResolvedIssues = async (encounterId: string): Promise<ResolvedIssue[]> => {
    try {
      return await aiNoteCheckerService.getResolvedIssues(encounterId);
    } catch (err: any) {
      console.error('Error fetching resolved issues:', err);
      return [];
    }
  };

  // Function to fetch ToDo status from EZDerm
  const fetchToDoStatus = async (todoId: string, patientId: string) => {
    try {
      const status = await aiNoteCheckerService.getToDoStatus(todoId, patientId);
      if (status) {
        setTodoStatuses(prev => new Map(prev).set(todoId, status));
      }
      return status;
    } catch (error) {
      console.error(`Failed to fetch status for ToDo ${todoId}:`, error);
      return null;
    }
  };

  // Function to render ToDo status chip
  const renderToDoStatusChip = (todo: CreatedToDo) => {
    const status = todoStatuses.get(todo.ezDermToDoId);
    
    // If we haven't fetched the status yet, fetch it
    if (!status && currentNote) {
      // Fetch status asynchronously
      fetchToDoStatus(todo.ezDermToDoId, currentNote.patientId);
      
      return (
        <Chip
          label="Loading..."
          size="small"
          color="info"
          sx={{ fontSize: '0.7rem' }}
        />
      );
    }

    if (!status) {
      return (
        <Chip
          label="Status Unknown"
          size="small"
          color="default"
          sx={{ fontSize: '0.7rem' }}
        />
      );
    }

    // Determine color and label based on status
    const isCompleted = status.status === 'COMPLETED' || status.status === 'CLOSED';
    const isOpen = status.status === 'OPEN';
    
    return (
      <Chip
        label={isCompleted ? 'Completed' : isOpen ? 'Open' : status.status}
        size="small"
        color={isCompleted ? 'success' : isOpen ? 'warning' : 'default'}
        sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}
      />
    );
  };

  // Simple navigation functions
  const handlePreviousNote = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      const newNote = notes[newIndex];
      // Preserve the location state context when navigating
      navigate(`/ai-note-checker/${newNote.encounterId}`, { 
        replace: true,
        state: location.state // Preserve the filter context
      });
    }
  }, [currentIndex, notes, navigate, location.state]);

  const handleNextNote = useCallback(() => {
    if (currentIndex < notes.length - 1) {
      const newIndex = currentIndex + 1;
      const newNote = notes[newIndex];
      console.log('➡️ Navigating to next note:', {
        fromIndex: currentIndex,
        toIndex: newIndex,
        fromEncounter: notes[currentIndex]?.encounterId,
        toEncounter: newNote.encounterId,
        fromPatient: notes[currentIndex]?.patientName,
        toPatient: newNote.patientName
      });
      setCurrentIndex(newIndex);
      // Preserve the location state context when navigating
      navigate(`/ai-note-checker/${newNote.encounterId}`, { 
        replace: true,
        state: location.state // Preserve the filter context
      });
    }
  }, [currentIndex, notes, navigate, location.state]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePreviousNote();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNextNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, notes.length, handleNextNote, handlePreviousNote]);

  // Refresh current note data
  const refreshNoteData = () => {
    if (currentNote) {
      setLoading(true);
      // Remove from cache to force reload
      setNoteDataCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(currentNote.encounterId);
        return newCache;
      });
      loadNoteData(currentNote.encounterId, currentNote.patientId).finally(() => {
        setLoading(false);
      });
    }
  };

  // Helper functions for invalid issues
  const isIssueMarkedInvalid = (checkId: number, issueIndex: number): boolean => {
    return invalidIssues.some(invalid => 
      invalid.checkId === checkId && invalid.issueIndex === issueIndex
    );
  };

  // Helper function to check if an issue is marked as resolved
  const isIssueMarkedResolved = (checkId: number, issueIndex: number): boolean => {
    return resolvedIssues.some(resolved => 
      resolved.checkId === checkId && resolved.issueIndex === issueIndex
    );
  };

  // Helper function to toggle collapsed state for issues
  const toggleIssueCollapse = (checkId: number, issueIndex: number) => {
    const issueKey = `${checkId}-${issueIndex}`;
    setCollapsedIssues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(issueKey)) {
        newSet.delete(issueKey);
      } else {
        newSet.add(issueKey);
      }
      return newSet;
    });
  };

  // Helper function to check if an issue is collapsed
  const isIssueCollapsed = (checkId: number, issueIndex: number): boolean => {
    const issueKey = `${checkId}-${issueIndex}`;
    return collapsedIssues.has(issueKey);
  };

  // Helper function to auto-collapse an issue when marked
  const autoCollapseIssue = (checkId: number, issueIndex: number) => {
    const issueKey = `${checkId}-${issueIndex}`;
    setCollapsedIssues(prev => new Set(prev).add(issueKey));
  };

  // Helper function to auto-collapse all resolved/invalid issues when data loads
  const autoCollapseResolvedAndInvalidIssues = useCallback(() => {
    if (!checkHistory.length || (!invalidIssues.length && !resolvedIssues.length)) return;

    const issuesToCollapse = new Set<string>();

    // Go through check history and find all resolved/invalid issues
    checkHistory.forEach(result => {
      if (result.aiAnalysis?.issues) {
        result.aiAnalysis.issues.forEach((issue: AIAnalysisIssue, index: number) => {
          const isInvalid = invalidIssues.some(invalid => 
            invalid.checkId === result.id && invalid.issueIndex === index
          );
          const isResolved = resolvedIssues.some(resolved => 
            resolved.checkId === result.id && resolved.issueIndex === index
          );
          
          if (isInvalid || isResolved) {
            const issueKey = `${result.id}-${index}`;
            issuesToCollapse.add(issueKey);
          }
        });
      }
    });

    if (issuesToCollapse.size > 0) {
      setCollapsedIssues(prev => {
        const newSet = new Set(prev);
        issuesToCollapse.forEach(key => newSet.add(key));
        return newSet;
      });
    }
  }, [checkHistory, invalidIssues, resolvedIssues]);

  // Auto-collapse resolved/invalid issues when data loads
  useEffect(() => {
    autoCollapseResolvedAndInvalidIssues();
  }, [autoCollapseResolvedAndInvalidIssues]);

  // Check if the current user is the attending provider for this note
  const isAttendingProvider = (): boolean => {
    if (!currentUserProviderId || !careTeam.length) return false;
    
    // Find the attending provider in the care team
    const attendingProvider = careTeam.find(member => 
      member.encounterRoleType === 'PROVIDER' && member.active
    );
    
    if (!attendingProvider) return false;
    
    // Check if the current user's provider ID matches the attending provider's ID
    return currentUserProviderId === attendingProvider.providerId;
  };

  // Check if note is already signed off by looking for POST_SIGNOFF_INFO section
  const checkIfNoteSignedOff = (progressNoteData: any) => {
    if (!progressNoteData?.progressNotes) {
      // No progress notes data - reset sign-off state
      setNoteSignedOff(false);
      setSignOffInfo(null);
      return;
    }

    const signOffSection = progressNoteData.progressNotes.find(
      (section: any) => section.sectionType === 'POST_SIGNOFF_INFO'
    );

    if (signOffSection) {
      const signOffItem = signOffSection.items?.find(
        (item: any) => item.elementType === 'SIGNOFF_NOTE'
      );
      
      if (signOffItem?.text) {
        setNoteSignedOff(true);
        setSignOffInfo(signOffItem.text);
      } else {
        // Sign-off section exists but no text - reset state
        setNoteSignedOff(false);
        setSignOffInfo(null);
      }
    } else {
      // No sign-off section found - reset sign-off state
      setNoteSignedOff(false);
      setSignOffInfo(null);
    }
  };

  // Check if the note can be signed off (no valid issues and user is attending provider)
  const canSignOffNote = (): boolean => {
    if (!isAttendingProvider()) return false;

    return true;
    
    // Check if there are any valid issues in the latest check
    const latestCheck = checkHistory.find(check => check.status === 'completed');
    if (!latestCheck) return false; // Must have at least one completed check
    
    // If there are no issues found, or all issues are marked invalid, can sign off
    if (!latestCheck.issuesFound) return true;
    
    // Check if all issues are marked as invalid
    if (latestCheck.aiAnalysis?.issues) {
      const allIssuesInvalid = latestCheck.aiAnalysis.issues.every((_, index) => 
        isIssueMarkedInvalid(latestCheck.id, index)
      );
      return allIssuesInvalid;
    }
    
    return false;
  };

  const getValidIssues = (result: NoteCheckResult): AIAnalysisIssue[] => {
    if (!result.aiAnalysis?.issues) return [];
    
    return result.aiAnalysis.issues.filter((_, index) => 
      !isIssueMarkedInvalid(result.id!, index)
    );
  };

  const hasValidIssues = (result: NoteCheckResult): boolean => {
    return getValidIssues(result).length > 0;
  };

  // Helper function to create a hash for issues
  const createIssueHash = async (issue: AIAnalysisIssue): Promise<string> => {
    const content = issue.assessment + issue.issue + JSON.stringify(issue.details);
    
    // Try to use crypto.subtle if available (secure contexts only)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
        return Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .substring(0, 16); // First 16 chars for brevity
      } catch (error) {
        console.warn('crypto.subtle failed, using fallback hash:', error);
      }
    }
    
    // Fallback: simple hash using string manipulation (works everywhere)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 16);
  };

  const markIssueAsInvalid = async (checkId: number, issueIndex: number, issue: AIAnalysisIssue, reason?: string) => {
    try {
      if (!currentNote) return;

      // Create a hash for the issue
      const issueHash = await createIssueHash(issue);

      await aiNoteCheckerService.markIssueAsInvalid(
        currentNote.encounterId,
        checkId,
        issueIndex,
        issue.issue,
        issue.assessment,
        issueHash,
        reason
      );

      // Auto-collapse the issue when marked as invalid
      autoCollapseIssue(checkId, issueIndex);

      // Refresh invalid issues and update cache
      const newInvalid = await fetchInvalidIssues(currentNote.encounterId);
      setNoteDataCache(prev => {
        const newCache = new Map(prev);
        const existing = newCache.get(currentNote.encounterId) as CachedNoteData | undefined;
        if (existing) {
          newCache.set(currentNote.encounterId, {
            progressNoteData: existing.progressNoteData,
            careTeam: existing.careTeam,
            checkHistory: existing.checkHistory,
            createdTodos: existing.createdTodos,
            invalidIssues: newInvalid,
            resolvedIssues: existing.resolvedIssues
          });
        }
        return newCache;
      });
    } catch (err: any) {
      console.error('Error marking issue as invalid:', err);
      setError(err.message || 'Failed to mark issue as invalid');
    }
  };

  const unmarkIssueAsInvalid = async (checkId: number, issueIndex: number) => {
    try {
      if (!currentNote) return;

      await aiNoteCheckerService.unmarkIssueAsInvalid(currentNote.encounterId, checkId, issueIndex);

      // Refresh invalid issues and update cache
      const newInvalid = await fetchInvalidIssues(currentNote.encounterId);
      setNoteDataCache(prev => {
        const newCache = new Map(prev);
        const existing = newCache.get(currentNote.encounterId) as CachedNoteData | undefined;
        if (existing) {
          newCache.set(currentNote.encounterId, {
            progressNoteData: existing.progressNoteData,
            careTeam: existing.careTeam,
            checkHistory: existing.checkHistory,
            createdTodos: existing.createdTodos,
            invalidIssues: newInvalid,
            resolvedIssues: existing.resolvedIssues
          });
        }
        return newCache;
      });
    } catch (err: any) {
      console.error('Error unmarking issue as invalid:', err);
      setError(err.message || 'Failed to unmark issue as invalid');
    }
  };

  const markIssueAsResolved = async (checkId: number, issueIndex: number, issue: AIAnalysisIssue, reason?: string) => {
    try {
      if (!currentNote) return;

      // Create a hash for the issue
      const issueHash = await createIssueHash(issue);

      await aiNoteCheckerService.markIssueAsResolved(
        currentNote.encounterId,
        checkId,
        issueIndex,
        issue.issue,
        issue.assessment,
        issueHash,
        reason
      );

      // Auto-collapse the issue when marked as resolved
      autoCollapseIssue(checkId, issueIndex);

      // Refresh resolved issues and update cache
      const newResolved = await fetchResolvedIssues(currentNote.encounterId);
      setNoteDataCache(prev => {
        const newCache = new Map(prev);
        const existing = newCache.get(currentNote.encounterId) as CachedNoteData | undefined;
        if (existing) {
          newCache.set(currentNote.encounterId, {
            progressNoteData: existing.progressNoteData,
            careTeam: existing.careTeam,
            checkHistory: existing.checkHistory,
            createdTodos: existing.createdTodos,
            invalidIssues: existing.invalidIssues,
            resolvedIssues: newResolved
          });
        }
        return newCache;
      });
    } catch (err: any) {
      console.error('Error marking issue as resolved:', err);
      setError(err.message || 'Failed to mark issue as resolved');
    }
  };

  const unmarkIssueAsResolved = async (checkId: number, issueIndex: number) => {
    try {
      if (!currentNote) return;

      await aiNoteCheckerService.unmarkIssueAsResolved(currentNote.encounterId, checkId, issueIndex);

      // Refresh resolved issues and update cache
      const newResolved = await fetchResolvedIssues(currentNote.encounterId);
      setNoteDataCache(prev => {
        const newCache = new Map(prev);
        const existing = newCache.get(currentNote.encounterId) as CachedNoteData | undefined;
        if (existing) {
          newCache.set(currentNote.encounterId, {
            progressNoteData: existing.progressNoteData,
            careTeam: existing.careTeam,
            checkHistory: existing.checkHistory,
            createdTodos: existing.createdTodos,
            invalidIssues: existing.invalidIssues,
            resolvedIssues: newResolved
          });
        }
        return newCache;
      });
    } catch (err: any) {
      console.error('Error unmarking issue as resolved:', err);
      setError(err.message || 'Failed to unmark issue as resolved');
    }
  };

  // Handle sign-off
  const handleSignOffNote = async () => {
    if (!currentNote) return;
    
    console.log('📝 Starting sign-off for:', {
      encounterId: currentNote.encounterId,
      patientName: currentNote.patientName,
      currentIndex,
      cacheKeysBefore: Array.from(noteDataCache.keys())
    });
    
    setSigningOff(true);
    try {
      await aiNoteCheckerService.signOffNote(currentNote.encounterId, currentNote.patientId);
      
      // Refresh the note data to get the updated sign-off information
      setNoteDataCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(currentNote.encounterId);
        console.log('🗑️ Removed from cache:', currentNote.encounterId);
        console.log('🗂️ Cache after deletion:', Array.from(newCache.keys()));
        return newCache;
      });
      
      // Reload the note data which will automatically check sign-off status
      await loadNoteData(currentNote.encounterId, currentNote.patientId);
      
      setError(null);
      setShowSignOffModal(false);
      setShowSignOffSuccessAlert(true);
      
      console.log('✅ Note signed off successfully for:', {
        encounterId: currentNote.encounterId,
        patientName: currentNote.patientName
      });
      
    } catch (err: any) {
      console.error('Error signing off note:', err);
      setError(err.message || 'Failed to sign off note');
    } finally {
      setSigningOff(false);
    }
  };

  // Handle HPI editing
  const handleEditHPI = (sectionIndex: number, itemIndex: number, currentText: string) => {
    setEditingHPI({ sectionIndex, itemIndex });
    setHpiEditText(currentText);
  };

  const handleCancelHPIEdit = () => {
    setEditingHPI(null);
    setHpiEditText('');
  };

  const handleSaveHPI = async () => {
    if (!currentNote || !editingHPI) return;
    
    setSavingHPI(true);
    try {
      await aiNoteCheckerService.modifyHPI(currentNote.encounterId, currentNote.patientId, hpiEditText);
      
      // Refresh the note data to show the updated HPI
      refreshNoteData();
      
      // Clear editing state
      setEditingHPI(null);
      setHpiEditText('');
      setError(null);
      
      console.log('✅ HPI updated successfully');
      
    } catch (err: any) {
      console.error('Error updating HPI:', err);
      setError(err.message || 'Failed to update HPI');
    } finally {
      setSavingHPI(false);
    }
  };

  // Render individual issues with invalid/resolved marking and collapse functionality, categorized by check type
  const renderIssuesDetails = (issues: AIAnalysisIssue[], checkId: number) => {
    const issueTypeMap: { [key: string]: string } = {
      'no_explicit_plan': 'Missing Explicit Plan',
      'chronicity_mismatch': 'Chronicity Mismatch', 
      'unclear_documentation': 'Unclear Documentation',
      'chief_complaint_structure': 'Chief Complaint Structure',
      'em_level_documentation': 'E/M Level Documentation'
    };

    const issueColors: { [key: string]: "error" | "warning" | "info" | "secondary" | "default" } = {
      'no_explicit_plan': 'error',
      'chronicity_mismatch': 'warning',
      'unclear_documentation': 'info',
      'chief_complaint_structure': 'secondary',
      'em_level_documentation': 'warning'
    };

    const checkTypeMap: { [key: string]: string } = {
      'chronicity-check': 'Chronicity Analysis',
      'plan-check': 'Plan Documentation Analysis',
      'vital-signs-check': 'Vital Signs Validation',
      'em-level-check': 'E/M Level Validation'
    };

    const checkTypeColors: { [key: string]: string } = {
      'chronicity-check': '#ff5722',
      'plan-check': '#ff9800',
      'vital-signs-check': '#9c27b0',
      'em-level-check': '#f44336'
    };

    // Group issues by check type
    const issuesByCheckType = issues.reduce((groups, issue, index) => {
      const checkType = issue.checkType || 'unknown';
      if (!groups[checkType]) {
        groups[checkType] = [];
      }
      groups[checkType].push({ issue, index });
      return groups;
    }, {} as { [key: string]: { issue: AIAnalysisIssue, index: number }[] });

    return (
      <Box sx={{ mt: 1 }}>
        {Object.entries(issuesByCheckType).map(([checkType, issueItems]) => (
          <Box key={checkType} sx={{ mb: 3 }}>
            {/* Check Type Header */}
            <Box sx={{ 
              p: 2, 
              borderRadius: 1,
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'grey.200',
              mb: 2
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 4,
                  height: 20,
                  bgcolor: checkTypeColors[checkType] || '#757575',
                  borderRadius: 0.5
                }} />
                <Typography variant="h6" sx={{ 
                  fontWeight: 'bold',
                  color: checkTypeColors[checkType] || '#757575',
                  fontSize: '1rem'
                }}>
                  {checkTypeMap[checkType] || `${checkType} Check`}
                </Typography>
                <Chip 
                  label={`${issueItems.length} issue${issueItems.length > 1 ? 's' : ''}`}
                  size="small"
                  sx={{ 
                    bgcolor: checkTypeColors[checkType] || '#757575',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                />
              </Box>
            </Box>

            {/* Issues for this check type */}
            {issueItems.map(({ issue, index }) => {
              const isInvalid = isIssueMarkedInvalid(checkId, index);
              const isResolved = isIssueMarkedResolved(checkId, index);
              const isMarked = isInvalid || isResolved;
              const isCollapsed = isIssueCollapsed(checkId, index);
              
              // Determine styling based on status
              const getBorderColor = () => {
                if (isInvalid) return 'action.disabled';
                if (isResolved) return 'success.main';
                return issueColors[issue.issue] + '.main';
              };
              
              const getBgColor = () => {
                if (isInvalid) return 'action.hover';
                if (isResolved) return 'success.50';
                return 'background.paper';
              };
              
              return (
                <Box 
                  key={index} 
                  sx={{ 
                    mb: 2, 
                    border: 1, 
                    borderColor: getBorderColor(),
                    borderRadius: 1,
                    bgcolor: getBgColor(),
                    opacity: isMarked ? 0.8 : 1,
                    overflow: 'hidden'
                  }}
                >
                  {/* Issue Header - Always Visible */}
                  <Box sx={{ 
                    p: 2, 
                    pb: isMarked && isCollapsed ? 2 : 1,
                    cursor: isMarked ? 'pointer' : 'default'
                  }}
                  onClick={() => isMarked ? toggleIssueCollapse(checkId, index) : undefined}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: isMarked && isCollapsed ? 0 : 1 }}>
                      <Chip
                        label={issueTypeMap[issue.issue] || issue.issue}
                        color={isInvalid ? 'default' : isResolved ? 'success' : (issueColors[issue.issue] || 'default')}
                        size="small"
                      />
                      {isInvalid && (
                        <Chip
                          label="Invalid"
                          color="default"
                          size="small"
                          icon={<Block />}
                        />
                      )}
                      {isResolved && (
                        <Chip
                          label="Resolved"
                          color="success"
                          size="small"
                          icon={<TaskAlt />}
                        />
                      )}
                      {isMarked && (
                        <IconButton 
                          size="small" 
                          sx={{ ml: 'auto', p: 0.25 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleIssueCollapse(checkId, index);
                          }}
                        >
                          {isCollapsed ? <ExpandMore sx={{ fontSize: '1rem' }} /> : <ExpandLess sx={{ fontSize: '1rem' }} />}
                        </IconButton>
                      )}
                    </Box>
                    
                    {/* Show truncated assessment when collapsed */}
                    {isMarked && isCollapsed && (
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', fontStyle: 'italic' }}>
                        {issue.assessment.substring(0, 80)}...
                      </Typography>
                    )}
                  </Box>

                  {/* Issue Details - Collapsible */}
                  <Collapse in={!isMarked || !isCollapsed}>
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Assessment: {issue.assessment}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>A&P Section:</strong> {issue.details['A&P']}
                      </Typography>

                      {issue.details.HPI && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>HPI Section:</strong> {issue.details.HPI}
                        </Typography>
                      )}

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        <strong>Correction:</strong> {issue.details.correction}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {!isInvalid && !isResolved && (
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<Block />}
                              onClick={() => markIssueAsInvalid(checkId, index, issue)}
                            >
                              Mark as Invalid
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              startIcon={<TaskAlt />}
                              onClick={() => markIssueAsResolved(checkId, index, issue)}
                            >
                              Mark as Resolved
                            </Button>
                          </>
                        )}
                        {isInvalid && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={<CheckCircle />}
                            onClick={() => unmarkIssueAsInvalid(checkId, index)}
                          >
                            Mark as Valid
                          </Button>
                        )}
                        {isResolved && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={<Warning />}
                            onClick={() => unmarkIssueAsResolved(checkId, index)}
                          >
                            Mark as Unresolved
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    );
  };

  const toggleSection = (sectionType: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionType)) {
        newSet.delete(sectionType);
      } else {
        newSet.add(sectionType);
      }
      return newSet;
    });
  };

  const getSectionIcon = (sectionType: string) => {
    switch (sectionType) {
      case 'HPI':
        return <Description color="primary" />;
      case 'SUBJECTIVE':
        return <Person color="primary" />;
      case 'OBJECTIVE':
        return <LocalHospital color="success" />;
      case 'ASSESSMENT_AND_PLAN':
        return <Assessment color="warning" />;
      default:
        return <Description color="action" />;
    }
  };

  const getSectionColor = (sectionType: string) => {
    switch (sectionType) {
      case 'HPI':
        return '#9c27b0'; // Purple for HPI
      case 'SUBJECTIVE':
        return '#1976d2';
      case 'OBJECTIVE':
        return '#2e7d32';
      case 'ASSESSMENT_AND_PLAN':
        return '#ed6c02';
      default:
        return '#666';
    }
  };

  const renderCareTeam = () => {
    if (!careTeam || careTeam.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          No care team information available
        </Typography>
      );
    }

    const getRoleIcon = (role: string) => {
      switch (role) {
        case 'PROVIDER':
          return <MedicalServices sx={{ color: 'primary.main' }} />;
        case 'SECONDARY_PROVIDER':
          return <Badge sx={{ color: 'secondary.main' }} />;
        case 'STAFF':
          return <Person sx={{ color: 'text.secondary' }} />;
        default:
          return <Group sx={{ color: 'text.secondary' }} />;
      }
    };

    const getRoleColor = (role: string) => {
      switch (role) {
        case 'PROVIDER':
          return 'primary';
        case 'SECONDARY_PROVIDER':
          return 'secondary';
        case 'STAFF':
          return 'default';
        default:
          return 'default';
      }
    };

    const getRoleLabel = (role: string) => {
      switch (role) {
        case 'PROVIDER':
          return 'Provider';
        case 'SECONDARY_PROVIDER':
          return 'Secondary Provider';
        case 'STAFF':
          return 'Staff';
        case 'COSIGNING_PROVIDER':
          return 'Cosigning Provider';
        default:
          return role;
      }
    };

    return (
      <Stack spacing={1}>
        {careTeam.map((member) => (
          <Box
            key={member.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              {getRoleIcon(member.encounterRoleType)}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {member.firstName} {member.lastName}
                  {member.title && (
                    <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                      ({member.title})
                    </Typography>
                  )}
                </Typography>
                <Chip
                  label={getRoleLabel(member.encounterRoleType)}
                  size="small"
                  color={getRoleColor(member.encounterRoleType) as any}
                  sx={{ fontSize: '0.7rem', height: '20px' }}
                />
          </Box>
        </Box>
        </Box>
        ))}
      </Stack>
    );
  };

  // Custom section ordering: HPI -> Assessment & Plan -> Subjective (remaining) -> Objective -> Others
  const getSectionOrder = (sectionType: string): number => {
    switch (sectionType) {
      case 'HPI':
        return 1; // HPI extracted as separate section
      case 'ASSESSMENT_AND_PLAN':
        return 2;
      case 'SUBJECTIVE':
        return 3; // Remaining SUBJECTIVE content after HPI extraction
      case 'OBJECTIVE':
        return 4;
      default:
        return 999; // Put any other sections at the end
    }
  };

  const renderProgressNote = (progressNote: any) => {
    if (!progressNote) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Description sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No note content available
          </Typography>
        </Box>
      );
    }

    // Handle the backend response wrapper
    const noteData = progressNote.data || progressNote;
    
    // The backend returns progressNotes array
    const rawSections = noteData.progressNotes || [];

    if (rawSections.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Description sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No note sections found
          </Typography>
        </Box>
      );
    }

    // Extract HPI from SUBJECTIVE section and create new sections array
    const processedSections = [];
    
    for (const section of rawSections) {
      if (section.sectionType === 'SUBJECTIVE') {
        // Extract HPI items
        const hpiItems = section.items.filter((item: any) => 
          item.elementType === 'HISTORY_OF_PRESENT_ILLNESS'
        );
        
        // Get remaining SUBJECTIVE items (non-HPI)
        const subjectiveItems = section.items.filter((item: any) => 
          item.elementType !== 'HISTORY_OF_PRESENT_ILLNESS'
        );
        
        // Add HPI as a separate section if it exists
        if (hpiItems.length > 0) {
          processedSections.push({
            sectionType: 'HPI',
            locked: section.locked,
            order: 1,
            items: hpiItems
          });
        }
        
        // Add remaining SUBJECTIVE content if it exists
        if (subjectiveItems.length > 0) {
          processedSections.push({
            ...section,
            items: subjectiveItems
          });
        }
      } else {
        // Keep other sections as is
        processedSections.push(section);
      }
    }
    
    // Sort sections according to our custom order: HPI -> Assessment & Plan -> Subjective (remaining) -> Objective -> Others
    const sections = processedSections.sort((a, b) => {
      const orderA = getSectionOrder(a.sectionType);
      const orderB = getSectionOrder(b.sectionType);
      return orderA - orderB;
    });

    return (
      <Stack spacing={2} sx={{ p: 2 }}>
        {sections.map((section: any, index: number) => {
          const sectionType = section.sectionType || section.label || `Section ${index + 1}`;
          const isCollapsed = collapsedSections.has(sectionType);
          const sectionColor = getSectionColor(sectionType);
          
          return (
            <Card 
              key={sectionType} 
              sx={{ 
                border: `2px solid ${sectionColor}20`,
                '&:hover': {
                  boxShadow: 4
                }
              }}
            >
              <CardHeader
                avatar={getSectionIcon(sectionType)}
                title={
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: sectionColor }}>
                    {sectionType.replace(/_/g, ' & ')}
                  </Typography>
                }
                action={
                  <Tooltip title={isCollapsed ? 'Expand section' : 'Collapse section'}>
                    <IconButton onClick={() => toggleSection(sectionType)}>
                      {isCollapsed ? <Visibility /> : <VisibilityOff />}
                    </IconButton>
                  </Tooltip>
                }
                sx={{
                  bgcolor: `${sectionColor}08`,
                  borderBottom: `1px solid ${sectionColor}30`
                }}
              />
              <Collapse in={!isCollapsed}>
                <CardContent sx={{ pt: 2 }}>
                  {section.items && section.items.length > 0 ? (
                    <Stack spacing={2}>
                      {section.items.map((item: any, itemIndex: number) => (
                        <Box key={itemIndex}>
                          {/* Show element type header if available */}
                          {item.elementType && (
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontWeight: 'bold', 
                                mb: 1, 
                                color: 'primary.main',
                                fontSize: '1rem'
                              }}
                            >
                              {item.elementType.replace(/_/g, ' ')}
                            </Typography>
                          )}
                          
                          {/* Show text field first */}
                          {item.text && (
                            <Paper 
                              sx={{ 
                                p: 2, 
                                bgcolor: 'background.default',
                                border: '1px solid',
                                borderColor: 'divider',
                                mb: item.note ? 1 : 0
                              }}
                            >
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  lineHeight: 1.8,
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'system-ui, -apple-system, sans-serif'
                                }}
                              >
                                {item.text}
                              </Typography>
                            </Paper>
                          )}
                          
                          {/* Show note field second */}
                          {item.note && (
                            <Paper 
                              sx={{ 
                                p: 2, 
                                bgcolor: 'background.paper',
                                border: '1px solid',
                                borderColor: 'primary.main',
                                position: 'relative'
                              }}
                            >
                              {/* Edit button for HPI sections */}
                              {item.elementType === 'HISTORY_OF_PRESENT_ILLNESS' && !noteSignedOff && (
                                <Box sx={{ 
                                  position: 'absolute', 
                                  top: 8, 
                                  right: 8,
                                  zIndex: 10,
                                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                  borderRadius: 1,
                                  p: 0.5
                                }}>
                                  {editingHPI?.sectionIndex === index && editingHPI?.itemIndex === itemIndex ? (
                                    <Stack direction="row" spacing={1}>
                                      <Tooltip title="Save changes">
                                        <IconButton
                                          size="small"
                                          onClick={handleSaveHPI}
                                          disabled={savingHPI}
                                          sx={{
                                            backgroundColor: '#10b981',
                                            color: 'white',
                                            '&:hover': { backgroundColor: '#059669' },
                                            '&:disabled': { backgroundColor: '#64748b' }
                                          }}
                                        >
                                          {savingHPI ? <CircularProgress size={16} color="inherit" /> : <Save sx={{ fontSize: '1rem' }} />}
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Cancel editing">
                                        <IconButton
                                          size="small"
                                          onClick={handleCancelHPIEdit}
                                          disabled={savingHPI}
                                          sx={{
                                            backgroundColor: '#ef4444',
                                            color: 'white',
                                            '&:hover': { backgroundColor: '#dc2626' }
                                          }}
                                        >
                                          <Cancel sx={{ fontSize: '1rem' }} />
                                        </IconButton>
                                      </Tooltip>
                                    </Stack>
                                  ) : (
                                    <Tooltip title="Edit HPI">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleEditHPI(index, itemIndex, item.note)}
                                        sx={{
                                          backgroundColor: '#3b82f6',
                                          color: 'white',
                                          '&:hover': { backgroundColor: '#2563eb' }
                                        }}
                                      >
                                        <Edit sx={{ fontSize: '1rem' }} />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              )}
                              
                              {/* Show textarea when editing, otherwise show text */}
                              {editingHPI?.sectionIndex === index && editingHPI?.itemIndex === itemIndex ? (
                                <TextField
                                  multiline
                                  rows={8}
                                  fullWidth
                                  value={hpiEditText}
                                  onChange={(e) => setHpiEditText(e.target.value)}
                                  disabled={savingHPI}
                                  sx={{
                                    '& .MuiOutlinedInput-root': {
                                      fontFamily: 'system-ui, -apple-system, sans-serif',
                                      lineHeight: 1.8
                                    }
                                  }}
                                  placeholder="Enter HPI text..."
                                />
                              ) : (
                                <Typography 
                                  variant="body1" 
                                  sx={{ 
                                    lineHeight: 1.8,
                                    whiteSpace: 'pre-wrap',
                                    fontFamily: 'system-ui, -apple-system, sans-serif',
                                    pr: item.elementType === 'HISTORY_OF_PRESENT_ILLNESS' && !noteSignedOff ? 6 : 0
                                  }}
                                >
                                  {item.note}
                                </Typography>
                              )}
                            </Paper>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No content in this section
                    </Typography>
                  )}
                </CardContent>
              </Collapse>
            </Card>
          );
        })}
      </Stack>
    );
  };

  const handleCheckNote = async () => {
    if (!currentNote) return;

    setChecking(true);
    setError(null);

    try {
      await aiNoteCheckerService.checkSingleNote(
        currentNote.encounterId,
        currentNote.patientId,
        currentNote.patientName,
        currentNote.chiefComplaint,
        currentNote.dateOfService,
        forceNewCheck
      );

      // Refresh check history and update cache
      const newHistory = await fetchCheckHistory(currentNote.encounterId);
      setNoteDataCache(prev => {
        const newCache = new Map(prev);
        const existing = newCache.get(currentNote.encounterId) as CachedNoteData | undefined;
        if (existing) {
          newCache.set(currentNote.encounterId, {
            progressNoteData: existing.progressNoteData,
            careTeam: existing.careTeam,
            checkHistory: newHistory,
            createdTodos: existing.createdTodos,
            invalidIssues: existing.invalidIssues,
            resolvedIssues: existing.resolvedIssues
          });
        }
        return newCache;
      });
      
      // Refresh the encounters context to update AI check status in note cards
      await refreshEncounters();
      
      // Reset force checkbox after successful check
      setForceNewCheck(false);
    } catch (err: any) {
      setError(err.message || 'Failed to check note');
    } finally {
      setChecking(false);
    }
  };

  // Helper functions for ToDo preview
  const getToDoPreviewData = () => {
    if (!currentNote) return null;
    
    const latestCheck = checkHistory.find(check => hasValidIssues(check));
    if (!latestCheck) return null;
    
    const validIssues = getValidIssues(latestCheck);
    if (validIssues.length === 0) return null;

    const formattedDate = new Date(currentNote.dateOfService).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric'
    });

    return {
      patientName: currentNote.patientName,
      dateOfService: formattedDate,
      assignedToName: careTeam.find(member => member.encounterRoleType === 'SECONDARY_PROVIDER')?.firstName + ' ' + 
                      careTeam.find(member => member.encounterRoleType === 'SECONDARY_PROVIDER')?.lastName ||
                      careTeam.find(member => member.encounterRoleType === 'STAFF')?.firstName + ' ' +
                      careTeam.find(member => member.encounterRoleType === 'STAFF')?.lastName ||
                      careTeam.find(member => member.encounterRoleType === 'PROVIDER')?.firstName + ' ' +
                      careTeam.find(member => member.encounterRoleType === 'PROVIDER')?.lastName || 'Unknown',
      issues: validIssues
    };
  };

  const handleCreateToDo = async () => {
    if (!currentNote) return;

    // Set modal to loading state
    setModalState('loading');
    setModalError(null);
    setModalSuccess(null);

    try {
      const result = await aiNoteCheckerService.createToDo(currentNote.encounterId);
      
      if (result.success) {
        // Set modal to success state
        setModalState('success');
        setModalSuccess(`ToDo created successfully! (ID: ${result.todoId})`);
        
        // Refresh the check history and created ToDos in background and update cache
        const [newHistory, newTodos] = await Promise.all([
          fetchCheckHistory(currentNote.encounterId),
          fetchCreatedTodos(currentNote.encounterId)
        ]);
        setNoteDataCache(prev => {
          const newCache = new Map(prev);
          const existing = newCache.get(currentNote.encounterId) as CachedNoteData | undefined;
          if (existing) {
            newCache.set(currentNote.encounterId, {
              progressNoteData: existing.progressNoteData,
              careTeam: existing.careTeam,
              checkHistory: newHistory,
              createdTodos: newTodos,
              invalidIssues: existing.invalidIssues,
              resolvedIssues: existing.resolvedIssues
            });
          }
          return newCache;
        });
        
        // Auto-close modal after 2 seconds on success
        setTimeout(() => {
          setShowToDoModal(false);
          setModalState('preview'); // Reset for next time
        }, 2000);
      }
    } catch (err: any) {
      // Set modal to error state
      setModalState('error');
      setModalError(err.message || 'Failed to create ToDo');
    }
  };

  const getStatusIcon = (result: NoteCheckResult) => {
    if (result.status === 'error') {
      return <ErrorIcon color="error" />;
    }
    if (result.issuesFound) {
      return <Warning color="warning" />;
    }
    return <CheckCircle color="success" />;
  };

  // Show loading if we don't have notes loaded yet or no current note
  if (encountersLoading || notes.length === 0 || !currentNote) {
    console.log('🔍 Loading state:', {
      encountersLoading,
      notesLength: notes.length,
      currentNote: !!currentNote,
      allEncountersLength: allEncounters.length
    });
    
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>
          {encountersLoading ? 'Loading encounters...' : 
           notes.length === 0 ? 'No notes found for this filter...' :
           'Loading note data...'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      {/* Mobile Header */}
      <MobileNoteDetailHeader
        patientName={currentNote.patientName}
        chiefComplaint={currentNote.chiefComplaint}
        dateOfService={currentNote.dateOfService}
        noteSignedOff={noteSignedOff}
        signOffInfo={signOffInfo}
        currentIndex={currentIndex}
        totalNotes={notes.length}
        filterContext={(location.state as any)?.currentFilter}
        onBack={() => {
          const navigationState = location.state as { 
            currentFilter?: string; 
            filteredNotes?: any[];
            sortBy?: string;
          } | null;
          const currentFilter = navigationState?.currentFilter;
          const sortBy = navigationState?.sortBy;
          
          navigate('/ai-note-checker', {
            state: { 
              returnToFilter: currentFilter || 'all',
              returnToSort: sortBy || 'dateDesc'
            }
          });
        }}
        onPrevious={handlePreviousNote}
        onNext={handleNextNote}
        onRunCheck={handleCheckNote}
        onCreateToDo={() => {
          setShowToDoModal(true);
          setModalState('preview');
          setModalError(null);
          setModalSuccess(null);
        }}
        onSignOff={() => setShowSignOffModal(true)}
        onRefresh={refreshNoteData}
        checking={checking}
        loading={loading}
        forceNewCheck={forceNewCheck}
        onForceNewCheckChange={setForceNewCheck}
        todoCreated={createdTodos.length > 0}
        todoCount={createdTodos.length}
        canSignOff={canSignOffNote()}
        canCreateToDo={checkHistory.some(check => check.issuesFound) && createdTodos.length === 0}
      />

      {/* Desktop Header - show on desktop and tablet */}
      {(isDesktop || isTablet) && (
        <Box sx={{ 
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          color: '#f8fafc',
          px: 4, 
          py: 3,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 3,
          minHeight: '100px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          borderBottom: '1px solid #2a2a2a'
        }}>
        {/* Left section - Back button and title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-start' }}>
          <Tooltip title="Back to AI Note Checker">
            <IconButton
              onClick={() => {
                // Get the current filter and sort context to preserve it when going back
                const navigationState = location.state as { 
                  currentFilter?: string; 
                  filteredNotes?: any[];
                  sortBy?: string;
                } | null;
                const currentFilter = navigationState?.currentFilter;
                const sortBy = navigationState?.sortBy;
                
                // Navigate back with the filter and sort context preserved
                navigate('/ai-note-checker', {
                  state: { 
                    returnToFilter: currentFilter || 'all',
                    returnToSort: sortBy || 'dateDesc'
                  }
                });
              }}
              sx={{ 
                color: '#f8fafc',
                backgroundColor: '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: 2,
                p: 1.5,
                '&:hover': {
                  backgroundColor: '#3a3a3a',
                  borderColor: '#4a4a4a'
                }
              }}
            >
              <ArrowBack sx={{ fontSize: '1.25rem' }} />
            </IconButton>
          </Tooltip>
          <Psychology sx={{ fontSize: '2rem', color: '#3b82f6' }} />
          <Box>
            <Typography variant="h5" sx={{ 
              fontWeight: 800, 
              lineHeight: 1.2,
              color: '#f8fafc',
              fontSize: '1.5rem'
            }}>
              AI Note Analysis
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ 
                color: '#e2e8f0',
                fontSize: '1.1rem',
                fontWeight: 600
              }}>
                {currentNote.patientName}
              </Typography>
              <Typography variant="body2" sx={{ 
                color: '#94a3b8',
                fontSize: '0.8rem',
                fontWeight: 400
              }}>
                {aiNoteCheckerService.formatTimeAgo(currentNote.dateOfService)}
              </Typography>
              {noteSignedOff && (
                <Tooltip title={signOffInfo || 'Note has been signed off'}>
                  <Chip
                    icon={<CheckCircle />}
                    label="SIGNED OFF"
                    sx={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      ml: 2,
                      '& .MuiChip-icon': {
                        color: 'white'
                      }
                    }}
                  />
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>
        
        {/* Center section - Navigation arrows with modern styling */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          justifyContent: 'center',
          minWidth: '200px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: 3,
          px: 3,
          py: 1.5
        }}>
          <Tooltip title="Previous note (Arrow Left)">
            <IconButton
              onClick={handlePreviousNote}
              disabled={currentIndex <= 0}
              sx={{ 
                color: currentIndex <= 0 ? '#64748b' : '#f8fafc',
                backgroundColor: currentIndex <= 0 ? 'transparent' : '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: 2,
                p: 1,
                '&:hover': { 
                  backgroundColor: currentIndex <= 0 ? 'transparent' : '#3a3a3a',
                  borderColor: currentIndex <= 0 ? '#3a3a3a' : '#4a4a4a'
                },
                '&:disabled': {
                  color: '#64748b',
                  backgroundColor: 'transparent',
                  borderColor: '#2a2a2a'
                }
              }}
            >
              <NavigateBefore sx={{ fontSize: '1.25rem' }} />
            </IconButton>
          </Tooltip>
          
          <Box sx={{ 
            textAlign: 'center',
            px: 2,
            py: 0.5,
            backgroundColor: '#0f0f0f',
            border: '1px solid #2a2a2a',
            borderRadius: 2
          }}>
            <Typography variant="body2" sx={{ 
              color: '#f8fafc',
              fontSize: '0.85rem',
              fontWeight: 600,
              lineHeight: 1.2
            }}>
              {(() => {
                const navigationState = location.state as { currentFilter?: string } | null;
                const currentFilter = navigationState?.currentFilter;
                const suffix = currentFilter === 'issues' ? ' with issues' :
                             currentFilter === 'clean' ? ' clean' :
                             currentFilter === 'unchecked' ? ' unchecked' :
                             currentFilter === 'issues-no-todos' ? ' with issues (no ToDos)' : '';
                return `${currentIndex + 1} / ${notes.length}${suffix}`;
              })()}
            </Typography>
          </Box>
          
          <Tooltip title="Next note (Arrow Right)">
            <IconButton
              onClick={handleNextNote}
              disabled={currentIndex >= notes.length - 1}
              sx={{ 
                color: currentIndex >= notes.length - 1 ? '#64748b' : '#f8fafc',
                backgroundColor: currentIndex >= notes.length - 1 ? 'transparent' : '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: 2,
                p: 1,
                '&:hover': { 
                  backgroundColor: currentIndex >= notes.length - 1 ? 'transparent' : '#3a3a3a',
                  borderColor: currentIndex >= notes.length - 1 ? '#3a3a3a' : '#4a4a4a'
                },
                '&:disabled': {
                  color: '#64748b',
                  backgroundColor: 'transparent',
                  borderColor: '#2a2a2a'
                }
              }}
            >
              <NavigateNext sx={{ fontSize: '1.25rem' }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Right section - Action buttons with modern styling */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2, 
          justifyContent: 'flex-end',
          minWidth: '450px'
        }}>
          <Tooltip title="Run AI analysis on this note">
            <Button
              variant="contained"
              startIcon={checking ? <CircularProgress size={16} color="inherit" /> : <Psychology />}
              onClick={handleCheckNote}
              disabled={checking}
              sx={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: '1px solid #2563eb',
                borderRadius: 2,
                px: 3,
                py: 1,
                fontWeight: 600,
                fontSize: '0.875rem',
                '&:hover': {
                  backgroundColor: '#2563eb',
                  borderColor: '#1d4ed8'
                },
                '&:disabled': {
                  backgroundColor: '#64748b',
                  borderColor: '#475569',
                  color: '#e2e8f0'
                }
              }}
            >
              {checking 
                ? 'Analyzing...' 
                : forceNewCheck 
                  ? 'Force New Check' 
                  : 'Run AI Check'
              }
            </Button>
          </Tooltip>
          
          <Tooltip title="Bypass duplicate detection and run fresh analysis">
            <FormControlLabel
              control={
                <Checkbox
                  checked={forceNewCheck}
                  onChange={(e) => setForceNewCheck(e.target.checked)}
                  size="small"
                  sx={{ 
                    color: '#94a3b8', 
                    '&.Mui-checked': { color: '#3b82f6' },
                    '&:hover': { backgroundColor: 'rgba(59, 130, 246, 0.1)' }
                  }}
                />
              }
              label="Force New"
              sx={{ 
                color: '#e2e8f0', 
                fontSize: '0.85rem',
                fontWeight: 500,
                '& .MuiFormControlLabel-label': { fontSize: '0.85rem' }
              }}
            />
          </Tooltip>
          
          {checkHistory.some(check => check.issuesFound) && (
            createdTodos.length > 0 ? (
              <Chip
                icon={<CheckCircle />}
                label={`ToDo Created (${createdTodos.length})`}
                sx={{ 
                  backgroundColor: '#10b981',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  border: '1px solid #059669',
                  '& .MuiChip-icon': {
                    color: 'white'
                  }
                }}
              />
            ) : (
              <Tooltip title="Create a ToDo for the identified issues">
                <Button
                  variant="contained"
                  startIcon={<Assignment />}
                  onClick={() => {
                    setShowToDoModal(true);
                    setModalState('preview');
                    setModalError(null);
                    setModalSuccess(null);
                  }}
                  sx={{ 
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: '1px solid #d97706',
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    '&:hover': {
                      backgroundColor: '#d97706',
                      borderColor: '#b45309'
                    }
                  }}
                >
                  Create ToDo
                </Button>
              </Tooltip>
            )
          )}
          
          {/* Sign Off Button - only show if user can sign off and note isn't already signed off */}
          {canSignOffNote() && !noteSignedOff && (
            <Tooltip title="Sign off this note">
              <Button
                variant="contained"
                startIcon={<Edit />}
                onClick={() => setShowSignOffModal(true)}
                disabled={signingOff}
                sx={{ 
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: '1px solid #059669',
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  '&:hover': {
                    backgroundColor: '#059669',
                    borderColor: '#047857'
                  },
                  '&:disabled': {
                    backgroundColor: '#64748b',
                    borderColor: '#475569',
                    color: '#e2e8f0'
                  }
                }}
              >
                {signingOff ? 'Signing Off...' : 'Sign Off Note'}
              </Button>
            </Tooltip>
          )}
          
          <Tooltip title="Refresh note data">
            <IconButton
              onClick={refreshNoteData}
              disabled={loading}
              sx={{ 
                color: '#f8fafc',
                backgroundColor: '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: 2,
                p: 1.5,
                '&:hover': {
                  backgroundColor: '#3a3a3a',
                  borderColor: '#4a4a4a'
                },
                '&:disabled': {
                  color: '#64748b',
                  backgroundColor: '#1a1a1a',
                  borderColor: '#2a2a2a'
                }
              }}
            >
              {loading ? <CircularProgress size={20} sx={{ color: '#64748b' }} /> : <Refresh sx={{ fontSize: '1.25rem' }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Success Alert for Sign Off */}
      {showSignOffSuccessAlert && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert 
            severity="success" 
            onClose={() => setShowSignOffSuccessAlert(false)}
            sx={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              '& .MuiAlert-icon': {
                color: '#10b981'
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ fontSize: '1.2rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Note successfully signed off! The note status has been updated in the EZDerm system.
              </Typography>
            </Box>
          </Alert>
        </Box>
      )}

      {/* Mobile Content */}
      {isMobile ? (
        <MobileNoteContent
          progressNoteData={progressNoteData}
          careTeam={careTeam}
          checkHistory={checkHistory}
          createdTodos={createdTodos}
          invalidIssues={invalidIssues}
          resolvedIssues={resolvedIssues}
          loading={loading}
          noteSignedOff={noteSignedOff}
          editingHPI={editingHPI}
          hpiEditText={hpiEditText}
          savingHPI={savingHPI}
          onEditHPI={handleEditHPI}
          onSaveHPI={handleSaveHPI}
          onCancelHPIEdit={handleCancelHPIEdit}
          onHPITextChange={setHpiEditText}
          onMarkIssueInvalid={markIssueAsInvalid}
          onUnmarkIssueInvalid={unmarkIssueAsInvalid}
          onMarkIssueResolved={markIssueAsResolved}
          onUnmarkIssueResolved={unmarkIssueAsResolved}
          todoStatuses={todoStatuses}
          onFetchToDoStatus={fetchToDoStatus}
          renderToDoStatusChip={renderToDoStatusChip}
        />
      ) : (
        /* Desktop Content */
        <Box sx={{ flex: 1, display: 'flex', p: 4, gap: 4, overflow: 'hidden' }}>
        {/* Left Panel - Note Content with modern card design */}
        <Paper sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          maxHeight: '100%',
          backgroundColor: 'white',
          borderRadius: 3,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <Box sx={{ 
            p: 3, 
            borderBottom: '2px solid #f1f5f9',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Description sx={{ fontSize: '1.75rem', color: '#3b82f6' }} />
                <Typography variant="h5" sx={{ 
                  fontWeight: 800,
                  color: '#1e293b',
                  fontSize: '1.25rem'
                }}>
                  Progress Note
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <Typography variant="body2" sx={{ 
                    color: '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 500
                  }}>
                    Service: {aiNoteCheckerService.formatTimeAgo(currentNote.dateOfService)}
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    color: '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 400,
                    opacity: 0.8
                  }}>
                    {currentNote.chiefComplaint} • {aiNoteCheckerService.formatDate(currentNote.dateOfService)}
                  </Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Expand all sections">
                  <IconButton 
                    size="small" 
                    onClick={() => setCollapsedSections(new Set())}
                    sx={{
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: 2,
                      '&:hover': {
                        backgroundColor: '#e2e8f0',
                        borderColor: '#cbd5e1'
                      }
                    }}
                  >
                    <Visibility sx={{ fontSize: '1.1rem', color: '#64748b' }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Collapse all sections">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      const noteData = progressNoteData?.data || progressNoteData;
                      const sections = noteData?.progressNotes || [];
                      const allSections = sections.map((s: any) => s.sectionType || s.label || `Section ${sections.indexOf(s) + 1}`);
                      setCollapsedSections(new Set(allSections));
                    }}
                    sx={{
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: 2,
                      '&:hover': {
                        backgroundColor: '#e2e8f0',
                        borderColor: '#cbd5e1'
                      }
                    }}
                  >
                    <VisibilityOff sx={{ fontSize: '1.1rem', color: '#64748b' }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Chip
                label={currentNote.status}
                sx={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.8rem'
                }}
              />
              <Typography variant="body2" sx={{ 
                color: '#64748b',
                fontSize: '0.9rem',
                fontWeight: 500
              }}>
                {(() => {
                  const noteData = progressNoteData?.data || progressNoteData;
                  return noteData?.progressNotes?.length || 0;
                })()} sections
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Loading Data...
                </Typography>
              </Box>
            ) : (
              renderProgressNote(progressNoteData)
            )}
          </Box>
        </Paper>

        {/* Right Panel - Care Team & AI Check History with modern styling */}
        <Box sx={{ 
          width: { 
            md: '500px',   // Medium screens (900px-1200px): 500px (original)
            lg: '600px',   // Large screens (1200px-1536px): 600px
            xl: '700px'    // Extra large screens (1536px+): 700px
          }, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 3, 
          maxHeight: '100%' 
        }}>
          {/* Sign-off Information Section - only show if note is signed off */}
          {noteSignedOff && signOffInfo && (
            <Paper
              elevation={0}
              sx={{
                border: '1px solid #10b981',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: '#f0fdf4'
              }}
            >
              {/* Header */}
              <Box sx={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <CheckCircle sx={{ color: 'white', fontSize: '1.4rem' }} />
                <Typography variant="h6" sx={{ 
                  color: 'white', 
                  fontWeight: 600,
                  fontSize: '1rem'
                }}>
                  Note Signed Off
                </Typography>
              </Box>
              
              {/* Content */}
              <Box sx={{ p: 2 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#065f46',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-line',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem'
                  }}
                >
                  {signOffInfo}
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Main Panel */}
          <Paper sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            flex: 1,
            backgroundColor: 'white',
            borderRadius: 3,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            {/* Care Team Section */}
          <Box sx={{ 
            p: 2, 
            borderBottom: careTeamCollapsed ? 'none' : '2px solid #f1f5f9',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            cursor: 'pointer',
            '&:hover': {
              background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
            }
          }}
          onClick={() => setCareTeamCollapsed(!careTeamCollapsed)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Group sx={{ fontSize: '1.5rem', color: '#10b981' }} />
              <Typography variant="h6" sx={{ 
                fontWeight: 800,
                color: '#1e293b',
                fontSize: '1.1rem',
                flex: 1
              }}>
                Care Team ({careTeam.length})
              </Typography>
              <IconButton 
                size="small"
                sx={{
                  color: '#64748b',
                  '&:hover': {
                    backgroundColor: 'rgba(100, 116, 139, 0.1)'
                  }
                }}
              >
                {careTeamCollapsed ? <ExpandMore /> : <ExpandLess />}
              </IconButton>
            </Box>
          </Box>
          <Collapse in={!careTeamCollapsed}>
            <Box sx={{ p: 3, borderBottom: '1px solid #f1f5f9' }}>
              {loading ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <CircularProgress size={24} sx={{ color: '#3b82f6' }} />
                  <Typography variant="body2" sx={{ 
                    mt: 2,
                    color: '#64748b',
                    fontSize: '0.85rem'
                  }}>
                    Loading Data...
                  </Typography>
                </Box>
              ) : (
                renderCareTeam()
              )}
            </Box>
          </Collapse>

          {/* Created ToDos Section */}
          {(!loading && createdTodos.length > 0) && (
            <>
              <Box sx={{ 
                p: 2, 
                borderBottom: todosCollapsed ? 'none' : '2px solid #f1f5f9',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                cursor: 'pointer',
                '&:hover': {
                  background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                }
              }}
              onClick={() => setTodosCollapsed(!todosCollapsed)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Assignment sx={{ fontSize: '1.5rem', color: '#10b981' }} />
                  <Typography variant="h6" sx={{ 
                    fontWeight: 800,
                    color: '#1e293b',
                    fontSize: '1.1rem'
                  }}>
                    Created ToDos ({createdTodos.length})
                  </Typography>
                  <IconButton
                    size="small"
                    sx={{
                      ml: 'auto',
                      color: '#10b981',
                      '&:hover': {
                        backgroundColor: 'rgba(16, 185, 129, 0.1)'
                      }
                    }}
                  >
                    {todosCollapsed ? <ExpandMore /> : <ExpandLess />}
                  </IconButton>
                </Box>
                <Typography variant="body2" sx={{ 
                  color: '#64748b',
                  fontSize: '0.85rem',
                  fontWeight: 500
                }}>
                  ToDos created for note deficiencies
                </Typography>
              </Box>
              <Collapse in={!todosCollapsed}>
                <Box sx={{ p: 3, borderBottom: '1px solid #f1f5f9' }}>
                  <Stack spacing={1}>
                    {createdTodos.map((todo, index) => (
                      <Paper key={todo.id} sx={{ p: 2, bgcolor: 'success.50' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Assignment color="success" sx={{ fontSize: '1rem' }} />
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                            {todo.subject}
                          </Typography>
                          <Chip 
                            label={`${todo.issuesCount} issues`} 
                            size="small" 
                            color="warning"
                            sx={{ fontSize: '0.7rem' }}
                          />
                          {renderToDoStatusChip(todo)}
                        </Box>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Assigned to:</strong> {todo.assignedToName}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Created {aiNoteCheckerService.formatTimeAgo(todo.createdAt.toString())} by {todo.createdBy}
                            <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.6, fontSize: '0.7rem' }}>
                              (ID: {todo.ezDermToDoId})
                            </Typography>
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            {aiNoteCheckerService.formatDate(todo.createdAt.toString())}
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              </Collapse>
            </>
          )}

          {/* AI Check History Section */}
          <Box sx={{ 
            p: 2, 
            borderBottom: '2px solid #f1f5f9',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Psychology sx={{ fontSize: '1.5rem', color: '#10b981' }} />
              <Typography variant="h6" sx={{ 
                fontWeight: 800,
                color: '#1e293b',
                fontSize: '1.1rem'
              }}>
                AI Check History ({checkHistory.length})
              </Typography>
            </Box>
          </Box>
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f5f9',
              borderRadius: '4px'
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#cbd5e1',
              borderRadius: '4px',
              '&:hover': {
                background: '#94a3b8'
              }
            }
          }}>
            {loading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress size={32} sx={{ color: '#3b82f6' }} />
                <Typography variant="body2" sx={{ 
                  mt: 2,
                  color: '#64748b',
                  fontSize: '0.85rem'
                }}>
                  Loading Data...
                </Typography>
              </Box>
            ) : checkHistory.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Psychology sx={{ fontSize: '3rem', color: '#cbd5e1', mb: 2 }} />
                <Typography variant="h6" sx={{ 
                  color: '#64748b',
                  fontWeight: 600,
                  mb: 1
                }}>
                  No checks yet
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: '#94a3b8',
                  fontSize: '0.85rem'
                }}>
                  Run an AI check to see analysis results
                </Typography>
              </Box>
            ) : (
              <Box sx={{ p: 2 }}>
                {checkHistory.map((result, index) => (
                  <React.Fragment key={result.id}>
                    <Paper 
                      elevation={0}
                      sx={{ 
                        p: 2, 
                        mb: index < checkHistory.length - 1 ? 2 : 0,
                        border: '1px solid #e2e8f0',
                        borderRadius: 2,
                        backgroundColor: '#fafafa'
                      }}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          {getStatusIcon(result)}
                          <Chip
                            label={hasValidIssues(result) ? 'Issues Found' : result.status === 'error' ? 'Error' : 'Clean'}
                            color={hasValidIssues(result) ? 'error' : result.status === 'error' ? 'error' : 'success'}
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                            {aiNoteCheckerService.formatTimeAgo(result.checkedAt)}
                          </Typography>
                        </Box>
                        
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          by {result.checkedBy}
                        </Typography>

                        {result.status === 'error' && result.errorMessage && (
                          <Alert severity="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
                            {result.errorMessage}
                          </Alert>
                        )}

                        {result.aiAnalysis?.issues && result.aiAnalysis.issues.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                              Issues Found ({getValidIssues(result).length} valid, {result.aiAnalysis.issues.length} total):
                            </Typography>
                            {renderIssuesDetails(result.aiAnalysis.issues, result.id!)}
                          </Box>
                        )}

                        {!hasValidIssues(result) && result.status === 'completed' && (
                          <Box sx={{ mt: 1 }}>
                            <Alert severity="success" sx={{ fontSize: '0.75rem' }}>
                              {result.aiAnalysis?.issues && result.aiAnalysis.issues.length > 0 
                                ? '✅ All issues marked as invalid - note now meets coding requirements'
                                : (
                                  <Box>
                                    <Box sx={{ fontWeight: 'bold', mb: result.aiAnalysis?.reason ? 1 : 0 }}>
                                      ✅ All checks passed - note meets coding requirements
                                    </Box>
                                    {result.aiAnalysis?.reason && (
                                      <Box sx={{ 
                                        mt: 1, 
                                        p: 1, 
                                        bgcolor: 'success.50', 
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'success.200'
                                      }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                          AI Assessment:
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                                          "{result.aiAnalysis.reason}"
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                )
                              }
                            </Alert>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  </React.Fragment>
                ))}
              </Box>
            )}
          </Box>
          </Paper>
        </Box>
        </Box>
      )}

      {/* ToDo Confirmation Modal */}
      <MobileToDoDialog
        open={showToDoModal}
        onClose={() => {
          setShowToDoModal(false);
          setModalState('preview'); // Reset state
          setModalError(null);
          setModalSuccess(null);
        }}
        modalState={modalState}
        modalError={modalError}
        modalSuccess={modalSuccess}
        previewData={getToDoPreviewData()}
        onCreateToDo={handleCreateToDo}
        onRetry={() => {
          setModalState('preview');
          setModalError(null);
        }}
        loading={modalState === 'loading'}
      />

      {/* Sign Off Confirmation Modal */}
      <MobileSignOffDialog
        open={showSignOffModal}
        onClose={() => setShowSignOffModal(false)}
        onConfirm={handleSignOffNote}
        patientName={currentNote.patientName}
        dateOfService={currentNote.dateOfService}
        signingOff={signingOff}
      />
    </Box>
  );
};

export default NoteDetail;