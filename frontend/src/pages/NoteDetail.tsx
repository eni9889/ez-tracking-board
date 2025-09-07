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
  Divider,
  List,
  ListItem,
  Card,
  CardContent,
  CardHeader,
  Collapse,
  Tooltip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  FormControlLabel,
  Checkbox
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
  CheckCircleOutline,
  ErrorOutline,
  Person,
  Group,
  Badge,
  MedicalServices,
  Block,
  Edit
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEncounters } from '../contexts/EncountersContext';
import aiNoteCheckerService, { NoteCheckResult, AIAnalysisIssue, CareTeamMember, CreatedToDo, InvalidIssue } from '../services/aiNoteChecker.service';

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
}

const NoteDetail: React.FC = () => {
  const { encounterId } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = useAuth();
  const { encounters: allEncounters, loading: encountersLoading } = useEncounters();

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
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [currentUserProviderId, setCurrentUserProviderId] = useState<string | null>(null);

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

  // Initialize notes array from encounters context - filter based on navigation context
  useEffect(() => {
    if (!encountersLoading && allEncounters.length > 0) {
      let filteredNotes = allEncounters;
      
      // Get filter context from navigation state
      const navigationState = location.state as { currentFilter?: string; filteredNotes?: NoteData[] } | null;
      const currentFilter = navigationState?.currentFilter;
      
      console.log('🔍 NoteDetail filtering:', {
        currentFilter,
        allEncountersCount: allEncounters.length,
        encounterId,
        navigationState
      });
      
      // Filter notes based on the tab the user came from
      if (currentFilter === 'issues') {
        filteredNotes = allEncounters.filter(note => note.lastCheckStatus === 'completed' && note.hasValidIssues === true);
      } else if (currentFilter === 'clean') {
        filteredNotes = allEncounters.filter(note => note.lastCheckStatus === 'completed' && !note.issuesFound);
      } else if (currentFilter === 'unchecked') {
        filteredNotes = allEncounters.filter(note => !note.lastCheckStatus || note.lastCheckStatus === 'pending');
      } else if (currentFilter === 'issues-no-todos') {
        filteredNotes = allEncounters.filter(note => note.lastCheckStatus === 'completed' && note.hasValidIssues === true && !note.todoCreated);
      }
      // For 'all' or no filter context, use all encounters
      
      console.log('🔍 Filtered results:', {
        currentFilter,
        filteredCount: filteredNotes.length,
        sampleNotes: filteredNotes.slice(0, 3).map(n => ({
          encounterId: n.encounterId,
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
  
  // Get current note data from cache or defaults
  const currentNoteData = currentNote ? noteDataCache.get(currentNote.encounterId) : null;
  const progressNoteData = currentNoteData?.progressNoteData || null;
  const careTeam = currentNoteData?.careTeam || [];
  const checkHistory = currentNoteData?.checkHistory || [];
  const createdTodos = currentNoteData?.createdTodos || [];
  const invalidIssues = currentNoteData?.invalidIssues || [];

  // Load data for a specific encounter
  const loadNoteData = useCallback(async (encounterId: string, patientId: string) => {
    try {
      const [noteResponse, history, todos, invalid] = await Promise.all([
        aiNoteCheckerService.getProgressNote(encounterId, patientId),
        fetchCheckHistory(encounterId),
        fetchCreatedTodos(encounterId),
        fetchInvalidIssues(encounterId)
      ]);

      // Cache the data
      setNoteDataCache(prev => new Map(prev).set(encounterId, {
        progressNoteData: noteResponse.progressNote,
        careTeam: noteResponse.careTeam,
        checkHistory: history,
        createdTodos: todos,
        invalidIssues: invalid
      }));

    } catch (err: any) {
      console.error('Error loading note data:', err);
      setError(err.message || 'Failed to load note data');
    }
  }, []);

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

  // Helper functions to fetch data for a specific encounter
  const fetchCheckHistory = async (encounterId: string): Promise<NoteCheckResult[]> => {
    try {
      const allResults = await aiNoteCheckerService.getNoteCheckResults(100, 0);
      return allResults.filter(result => result.encounterId === encounterId);
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
      setCurrentIndex(newIndex);
      const newNote = notes[newIndex];
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

  // Check if the note can be signed off (no valid issues and user is attending provider)
  const canSignOffNote = (): boolean => {
    if (!isAttendingProvider()) return false;
    
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
            invalidIssues: newInvalid
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
            invalidIssues: newInvalid
          });
        }
        return newCache;
      });
    } catch (err: any) {
      console.error('Error unmarking issue as invalid:', err);
      setError(err.message || 'Failed to unmark issue as invalid');
    }
  };

  // Handle sign-off
  const handleSignOff = async () => {
    if (!currentNote) return;
    
    setSigningOff(true);
    try {
      await aiNoteCheckerService.signOffNote(currentNote.encounterId, currentNote.patientId);
      
      // Show success message
      setError(null);
      setShowSignOffModal(false);
      
      // Optionally refresh the note data or show a success message
      // You might want to navigate back or update the UI to reflect the signed-off status
      console.log('✅ Note signed off successfully');
      
    } catch (err: any) {
      console.error('Error signing off note:', err);
      setError(err.message || 'Failed to sign off note');
    } finally {
      setSigningOff(false);
    }
  };

  // Render individual issues with invalid marking functionality
  const renderIssuesDetails = (issues: AIAnalysisIssue[], checkId: number) => {
    const issueTypeMap: { [key: string]: string } = {
      'no_explicit_plan': 'Missing Explicit Plan',
      'chronicity_mismatch': 'Chronicity Mismatch', 
      'unclear_documentation': 'Unclear Documentation',
      'chief_complaint_structure': 'Chief Complaint Structure'
    };

    const issueColors: { [key: string]: "error" | "warning" | "info" | "secondary" | "default" } = {
      'no_explicit_plan': 'error',
      'chronicity_mismatch': 'warning',
      'unclear_documentation': 'info',
      'chief_complaint_structure': 'secondary'
    };

    return (
      <Box sx={{ mt: 1 }}>
        {issues.map((issue, index) => {
          const isInvalid = isIssueMarkedInvalid(checkId, index);
          
          return (
            <Box 
              key={index} 
              sx={{ 
                mb: 2, 
                p: 2, 
                border: 1, 
                borderColor: isInvalid ? 'action.disabled' : issueColors[issue.issue] + '.main',
                borderRadius: 1,
                bgcolor: isInvalid ? 'action.hover' : 'background.paper',
                opacity: isInvalid ? 0.6 : 1
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip
                  label={issueTypeMap[issue.issue] || issue.issue}
                  color={isInvalid ? 'default' : (issueColors[issue.issue] || 'default')}
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
              </Box>

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

              <Box sx={{ display: 'flex', gap: 1 }}>
                {!isInvalid ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Block />}
                    onClick={() => markIssueAsInvalid(checkId, index, issue)}
                  >
                    Mark as Invalid
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => unmarkIssueAsInvalid(checkId, index)}
                  >
                    Mark as Valid
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
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
    const sections = noteData.progressNotes || [];

    if (sections.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Description sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No note sections found
          </Typography>
        </Box>
      );
    }

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
                                borderColor: 'primary.main'
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
                                {item.note}
                              </Typography>
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
            invalidIssues: existing.invalidIssues
          });
        }
        return newCache;
      });
      
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

    const subject = `Note Deficiencies - ${formattedDate}`;
    
    const issuesList = validIssues.map((issue, index) => {
      const issueTypeMap = {
        'no_explicit_plan': 'Missing Explicit Plan',
        'chronicity_mismatch': 'Chronicity Mismatch',
        'unclear_documentation': 'Unclear Documentation',
        'chief_complaint_structure': 'Chief Complaint Structure'
      };
      
      return `${index + 1}. ${issueTypeMap[issue.issue] || issue.issue}: ${issue.assessment}\n   ${issue.details.correction}`;
    }).join('\n\n');

    const description = `The following deficiencies were identified in the progress note:\n\n${issuesList}`;

    // Determine assignee and watchers
    const assignee = careTeam.find(member => member.encounterRoleType === 'SECONDARY_PROVIDER') ||
                    careTeam.find(member => member.encounterRoleType === 'STAFF') ||
                    careTeam.find(member => member.encounterRoleType === 'PROVIDER');
    
    const watchers = careTeam.filter(member => member.id !== assignee?.id);

    return {
      subject,
      description,
      assignee,
      watchers,
      encounterInfo: {
        encounterId: currentNote.encounterId,
        patientName: currentNote.patientName,
        dateOfService: formattedDate
      }
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
              invalidIssues: existing.invalidIssues
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
      {/* Modern Dark Header */}
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
                // Get the current filter context to preserve it when going back
                const navigationState = location.state as { currentFilter?: string; filteredNotes?: any[] } | null;
                const currentFilter = navigationState?.currentFilter;
                
                // Navigate back with the filter context preserved
                navigate('/ai-note-checker', {
                  state: { 
                    returnToFilter: currentFilter || 'all' 
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
            <Typography variant="body1" sx={{ 
              opacity: 0.8,
              color: '#e2e8f0',
              fontSize: '0.95rem',
              fontWeight: 500
            }}>
              {currentNote.patientName} • {currentNote.chiefComplaint}
            </Typography>
            <Typography variant="body2" sx={{ 
              opacity: 0.6,
              color: '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: 400
            }}>
              {aiNoteCheckerService.formatTimeAgo(currentNote.dateOfService)}
            </Typography>
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
          
          {/* Sign Off Button - only show if user can sign off */}
          {canSignOffNote() && (
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

      {/* Error Alert */}
      {error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}


      {/* Main Content with modern styling */}
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
        <Paper sx={{ 
          width: '420px', 
          display: 'flex', 
          flexDirection: 'column', 
          maxHeight: '100%',
          backgroundColor: 'white',
          borderRadius: 3,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          {/* Care Team Section */}
          <Box sx={{ 
            p: 3, 
            borderBottom: '2px solid #f1f5f9',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Group sx={{ fontSize: '1.5rem', color: '#10b981' }} />
              <Typography variant="h6" sx={{ 
                fontWeight: 800,
                color: '#1e293b',
                fontSize: '1.1rem'
              }}>
                Care Team ({careTeam.length})
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ 
              color: '#64748b',
              fontSize: '0.85rem',
              fontWeight: 500
            }}>
              Providers and staff for this encounter
            </Typography>
          </Box>
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

          {/* Created ToDos Section */}
          {(!loading && createdTodos.length > 0) && (
            <>
              <Box sx={{ 
                p: 3, 
                borderBottom: '2px solid #f1f5f9',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Assignment sx={{ fontSize: '1.5rem', color: '#10b981' }} />
                  <Typography variant="h6" sx={{ 
                    fontWeight: 800,
                    color: '#1e293b',
                    fontSize: '1.1rem'
                  }}>
                    Created ToDos ({createdTodos.length})
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ 
                  color: '#64748b',
                  fontSize: '0.85rem',
                  fontWeight: 500
                }}>
                  ToDos created for note deficiencies
                </Typography>
              </Box>
              <Box sx={{ p: 3, borderBottom: '1px solid #f1f5f9' }}>
                <Stack spacing={1}>
                  {createdTodos.map((todo, index) => (
                    <Paper key={todo.id} sx={{ p: 2, bgcolor: 'success.50' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <CheckCircle color="success" sx={{ fontSize: '1rem' }} />
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                          ToDo #{todo.ezDermToDoId}
                        </Typography>
                        <Chip 
                          label={`${todo.issuesCount} issues`} 
                          size="small" 
                          color="warning"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Subject:</strong> {todo.subject}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Assigned to:</strong> {todo.assignedToName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Created {aiNoteCheckerService.formatTimeAgo(todo.createdAt.toString())} by {todo.createdBy}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </>
          )}

          {/* AI Check History Section */}
          <Box sx={{ 
            p: 3, 
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
            <Typography variant="body2" sx={{ 
              color: '#64748b',
              fontSize: '0.85rem',
              fontWeight: 500
            }}>
              Recent AI analysis results
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
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
              <List sx={{ p: 0 }}>
                {checkHistory.map((result, index) => (
                  <React.Fragment key={result.id}>
                    <ListItem sx={{ px: 2, py: 2, alignItems: 'flex-start' }}>
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
                    </ListItem>
                    {index < checkHistory.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </Paper>
      </Box>

      {/* ToDo Confirmation Modal */}
      <Dialog
        open={showToDoModal}
        onClose={() => {
          // Prevent closing during loading
          if (modalState !== 'loading') {
            setShowToDoModal(false);
            setModalState('preview'); // Reset state
            setModalError(null);
            setModalSuccess(null);
          }
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
        // Disable escape key during loading
        disableEscapeKeyDown={modalState === 'loading'}
      >
        {/* Dynamic content based on modal state */}
        {modalState === 'preview' && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assignment color="warning" />
                <Typography variant="h6" component="span">
                  Confirm ToDo Creation
                </Typography>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                You are about to create a ToDo in EZDerm for the note deficiencies found. Please review the details below:
              </DialogContentText>

              {(() => {
                const previewData = getToDoPreviewData();
                if (!previewData) return null;

                return (
                  <Stack spacing={2}>
                    {/* Encounter Info */}
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Encounter Information
                      </Typography>
                      <Typography variant="body2">
                        <strong>Patient:</strong> {previewData.encounterInfo.patientName}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Encounter ID:</strong> {previewData.encounterInfo.encounterId}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Date of Service:</strong> {previewData.encounterInfo.dateOfService}
                      </Typography>
                    </Paper>

                    {/* ToDo Details */}
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        ToDo Subject
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {previewData.subject}
                      </Typography>

                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Description
                      </Typography>
                      <Paper sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {previewData.description}
                        </Typography>
                      </Paper>
                    </Paper>

                    {/* Assignment */}
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Assignment
                      </Typography>
                      {previewData.assignee ? (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2">
                            <strong>Assigned to:</strong> {previewData.assignee.firstName} {previewData.assignee.lastName}
                            {previewData.assignee.title && ` (${previewData.assignee.title})`}
                            <Chip 
                              label={previewData.assignee.encounterRoleType.replace('_', ' ')} 
                              size="small" 
                              sx={{ ml: 1 }}
                            />
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
                          ⚠️ No care team member found to assign to
                        </Typography>
                      )}

                      {previewData.watchers.length > 0 && (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            CC'd to ({previewData.watchers.length}):
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {previewData.watchers.map((watcher, index) => (
                              <Chip
                                key={watcher.id}
                                label={`${watcher.firstName} ${watcher.lastName}${watcher.title ? ` (${watcher.title})` : ''}`}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Paper>
                  </Stack>
                );
              })()}
            </DialogContent>
            
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button
                onClick={() => {
                  setShowToDoModal(false);
                  setModalState('preview');
                  setModalError(null);
                  setModalSuccess(null);
                }}
                color="inherit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateToDo}
                variant="contained"
                color="warning"
                startIcon={<Assignment />}
                disabled={!getToDoPreviewData()}
              >
                Create ToDo
              </Button>
            </DialogActions>
          </>
        )}

        {modalState === 'loading' && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={24} />
                <Typography variant="h6" component="span">
                  Creating ToDo...
                </Typography>
              </Box>
            </DialogTitle>
            
            <DialogContent sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={48} sx={{ mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                Please wait while we create the ToDo in EZDerm...
              </Typography>
            </DialogContent>
          </>
        )}

        {modalState === 'success' && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleOutline color="success" />
                <Typography variant="h6" component="span">
                  ToDo Created Successfully!
                </Typography>
              </Box>
            </DialogTitle>
            
            <DialogContent sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleOutline color="success" sx={{ fontSize: '4rem', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, color: 'success.main' }}>
                Success!
              </Typography>
              {modalSuccess && (
                <Typography variant="body1" color="text.secondary">
                  {modalSuccess}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                This window will close automatically in a moment.
              </Typography>
            </DialogContent>
          </>
        )}

        {modalState === 'error' && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorOutline color="error" />
                <Typography variant="h6" component="span">
                  Failed to Create ToDo
                </Typography>
              </Box>
            </DialogTitle>
            
            <DialogContent sx={{ textAlign: 'center', py: 4 }}>
              <ErrorOutline color="error" sx={{ fontSize: '4rem', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, color: 'error.main' }}>
                Error
              </Typography>
              {modalError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {modalError}
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary">
                Please try again or contact support if the issue persists.
              </Typography>
            </DialogContent>
            
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button
                onClick={() => {
                  setModalState('preview');
                  setModalError(null);
                }}
                color="inherit"
              >
                Try Again
              </Button>
              <Button
                onClick={() => {
                  setShowToDoModal(false);
                  setModalState('preview');
                  setModalError(null);
                  setModalSuccess(null);
                }}
                variant="contained"
                color="primary"
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Sign Off Confirmation Modal */}
      <Dialog
        open={showSignOffModal}
        onClose={() => !signingOff && setShowSignOffModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          backgroundColor: '#f8fafc', 
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <Edit sx={{ color: '#10b981' }} />
          Sign Off Note
        </DialogTitle>
        
        <DialogContent sx={{ pt: 3 }}>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to sign off this note?
          </DialogContentText>
          
          <Box sx={{ 
            backgroundColor: '#f0fdf4', 
            border: '1px solid #bbf7d0',
            borderRadius: 2,
            p: 2,
            mb: 2
          }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#166534', mb: 1 }}>
              Note Details:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Patient:</strong> {currentNote?.patientName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Chief Complaint:</strong> {currentNote?.chiefComplaint}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Date of Service:</strong> {currentNote && aiNoteCheckerService.formatTimeAgo(currentNote.dateOfService)}
            </Typography>
          </Box>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            This action will mark the note as signed off in the EZDerm system. This cannot be undone.
          </Alert>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setShowSignOffModal(false)}
            disabled={signingOff}
            sx={{ 
              color: '#64748b',
              '&:hover': { backgroundColor: '#f1f5f9' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSignOff}
            disabled={signingOff}
            variant="contained"
            startIcon={signingOff ? <CircularProgress size={16} color="inherit" /> : <Edit />}
            sx={{
              backgroundColor: '#10b981',
              color: 'white',
              '&:hover': { backgroundColor: '#059669' },
              '&:disabled': { 
                backgroundColor: '#64748b',
                color: '#e2e8f0'
              }
            }}
          >
            {signingOff ? 'Signing Off...' : 'Sign Off Note'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NoteDetail;
