import React, { useState, useEffect } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  ExpandMore,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Assignment,
  Visibility,
  VisibilityOff,
  Description,
  Assessment,
  LocalHospital,
  Person,
  Group,
  Badge,
  MedicalServices
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import aiNoteCheckerService, { NoteCheckResult, AIAnalysisIssue, CareTeamMember, CreatedToDo } from '../services/aiNoteChecker.service';

interface NoteDetailProps {
  encounterId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  dateOfService: string;
  status: string;
}

const NoteDetail: React.FC = () => {
  const { encounterId } = useParams<{ encounterId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {} = useAuth();

  const [noteData, setNoteData] = useState<NoteDetailProps | null>(null);
  const [progressNoteData, setProgressNoteData] = useState<any>(null);
  const [careTeam, setCareTeam] = useState<CareTeamMember[]>([]);
  const [checkHistory, setCheckHistory] = useState<NoteCheckResult[]>([]);
  const [createdTodos, setCreatedTodos] = useState<CreatedToDo[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [creatingToDo, setCreatingToDo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todoSuccess, setTodoSuccess] = useState<string | null>(null);
  const [showToDoModal, setShowToDoModal] = useState(false);
  const [forceNewCheck, setForceNewCheck] = useState(false);

  useEffect(() => {
    if (encounterId) {
      // Get note data from navigation state if available, otherwise we'll fetch what we need
      const stateNote = location.state?.note;
      if (stateNote) {
        setNoteData(stateNote);
      }
      
      // Always fetch note details - we can get everything from the encounterId
      fetchNoteDetails();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, location.state]);

  const fetchNoteDetails = async () => {
    if (!encounterId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch note content, check history, and created ToDos
      const [noteResponse, history, todos] = await Promise.all([
        fetchNoteContent(),
        fetchCheckHistory(),
        fetchCreatedTodos()
      ]);

      setProgressNoteData(noteResponse.progressNote);
      setCareTeam(noteResponse.careTeam);
      setCheckHistory(history);
      setCreatedTodos(todos);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch note details');
    } finally {
      setLoading(false);
    }
  };

  const fetchNoteContent = async (): Promise<any> => {
    if (!encounterId) throw new Error('No encounter ID available');
    
    try {
      // Try to get progress note with patientId if available, otherwise let backend find it
      const patientId = noteData?.patientId;
      const progressNote = await aiNoteCheckerService.getProgressNote(
        encounterId,
        patientId
      );
      
      return progressNote;
    } catch (err) {
      console.error('Error fetching note content:', err);
      throw new Error(`Unable to load note content: ${err}`);
    }
  };

  const fetchCheckHistory = async (): Promise<NoteCheckResult[]> => {
    if (!encounterId) return [];
    
    try {
      // Get all check results and filter for this encounter
      const allResults = await aiNoteCheckerService.getNoteCheckResults(100, 0);
      return allResults.filter(result => result.encounterId === encounterId);
    } catch (err) {
      console.error('Error fetching check history:', err);
      return [];
    }
  };

  const fetchCreatedTodos = async (): Promise<CreatedToDo[]> => {
    if (!encounterId) return [];
    
    try {
      const todos = await aiNoteCheckerService.getCreatedToDos(encounterId);
      return todos;
    } catch (err: any) {
      console.error('Error fetching created ToDos:', err);
      return [];
    }
  };

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

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
    if (!encounterId) return;

    setChecking(true);
    setError(null);

    try {
      // If we don't have note data, we'll need to get basic info first
      let patientId = noteData?.patientId;
      let patientName = noteData?.patientName || 'Unknown Patient';
      let chiefComplaint = noteData?.chiefComplaint || 'Unknown';
      let dateOfService = noteData?.dateOfService || new Date().toISOString();

      // If we don't have patient info, try to get it from a progress note call
      if (!patientId) {
        try {
          const noteResponse = await aiNoteCheckerService.getProgressNote(encounterId);
          // The backend should return patientId in the response
          patientId = (noteResponse.progressNote as any).patientId;
        } catch (err) {
          setError('Unable to determine patient information for AI check');
          setChecking(false);
          return;
        }
      }

      await aiNoteCheckerService.checkSingleNote(
        encounterId,
        patientId!,
        patientName,
        chiefComplaint,
        dateOfService,
        forceNewCheck
      );

      // Refresh check history
      const newHistory = await fetchCheckHistory();
      setCheckHistory(newHistory);
      
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
    const latestCheck = checkHistory.find(check => check.issuesFound);
    if (!latestCheck || !latestCheck.aiAnalysis?.issues) return null;

    const dateOfService = noteData?.dateOfService || new Date().toISOString();
    const formattedDate = new Date(dateOfService).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric'
    });

    const subject = `Note Deficiencies - ${formattedDate}`;
    
    const issuesList = latestCheck.aiAnalysis.issues.map((issue, index) => {
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
        encounterId,
        patientName: noteData?.patientName || 'Unknown Patient',
        dateOfService: formattedDate
      }
    };
  };

  const handleCreateToDo = async () => {
    if (!encounterId) return;

    setCreatingToDo(true);
    setError(null);
    setTodoSuccess(null);

    try {
      const result = await aiNoteCheckerService.createToDo(encounterId);
      
      if (result.success) {
        setTodoSuccess(`ToDo created successfully! (ID: ${result.todoId})`);
        // Refresh the check history and created ToDos
        const [newHistory, newTodos] = await Promise.all([
          fetchCheckHistory(),
          fetchCreatedTodos()
        ]);
        setCheckHistory(newHistory);
        setCreatedTodos(newTodos);
        
        // Clear success message after 5 seconds
        setTimeout(() => setTodoSuccess(null), 5000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create ToDo');
    } finally {
      setCreatingToDo(false);
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

  const getStatusColor = (result: NoteCheckResult) => {
    if (result.status === 'error') return 'error';
    if (result.issuesFound) return 'warning';
    return 'success';
  };

  const renderIssuesDetails = (issues: AIAnalysisIssue[]) => {
    return (
      <Box sx={{ mt: 2 }}>
        {issues.map((issue, index) => (
          <Accordion key={index} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning color="warning" sx={{ fontSize: '1rem' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  {issue.assessment}
                </Typography>
                <Chip 
                  label={(() => {
                    const issueLabels = {
                      'no_explicit_plan': 'Missing Plan',
                      'chronicity_mismatch': 'Chronicity Mismatch',
                      'unclear_documentation': 'Unclear Documentation',
                      'chief_complaint_structure': 'CC Structure'
                    };
                    return issueLabels[issue.issue] || issue.issue;
                  })()}
                  size="small"
                  color={(() => {
                    const issueColors: { [key: string]: "error" | "warning" | "info" | "secondary" | "default" } = {
                      'no_explicit_plan': 'error',
                      'chronicity_mismatch': 'warning',
                      'unclear_documentation': 'info',
                      'chief_complaint_structure': 'secondary'
                    };
                    return issueColors[issue.issue] || 'default';
                  })()}
                  sx={{ ml: 1 }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ pl: 2 }}>
                {issue.details.HPI && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'info.dark' }}>
                      HPI Reference:
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {issue.details.HPI}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.dark' }}>
                    A&P Issue:
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {issue.details['A&P']}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                    Recommended Correction:
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'success.dark' }}>
                    {issue.details.correction}
                  </Typography>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!noteData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Note data not found. Please navigate from the notes list.
        </Alert>
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
          onClick={() => navigate('/ai-note-checker')}
          sx={{ mr: 1 }}
        >
          <ArrowBack />
        </IconButton>
        <Assignment sx={{ fontSize: '1.5rem' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Note Detail - {noteData.patientName}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {noteData.chiefComplaint} • {aiNoteCheckerService.formatTimeAgo(noteData.dateOfService)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={checking ? <CircularProgress size={16} color="inherit" /> : <Psychology />}
            onClick={handleCheckNote}
            disabled={checking}
            size="small"
          >
            {checking 
              ? 'Checking...' 
              : forceNewCheck 
                ? 'Force New AI Check' 
                : 'Run AI Check'
            }
          </Button>
          <Tooltip title="Bypass MD5 duplicate detection and run a fresh AI analysis even if this note was already checked">
            <FormControlLabel
              control={
                <Checkbox
                  checked={forceNewCheck}
                  onChange={(e) => setForceNewCheck(e.target.checked)}
                  size="small"
                  sx={{ color: 'white', '&.Mui-checked': { color: 'white' } }}
                />
              }
              label="Force New"
              sx={{ 
                color: 'white', 
                fontSize: '0.8rem',
                '& .MuiFormControlLabel-label': { fontSize: '0.8rem' }
              }}
            />
          </Tooltip>
        </Box>
        {checkHistory.some(check => check.issuesFound) && (
          createdTodos.length > 0 ? (
            <Chip
              icon={<CheckCircle />}
              label={`ToDo Created (${createdTodos.length})`}
              color="success"
              size="medium"
              sx={{ fontWeight: 'bold' }}
            />
          ) : (
            <Button
              variant="contained"
              color="warning"
              startIcon={<Assignment />}
              onClick={() => setShowToDoModal(true)}
              size="small"
              sx={{ 
                backgroundColor: 'warning.main',
                '&:hover': {
                  backgroundColor: 'warning.dark'
                }
              }}
            >
              Create ToDo for Issues
            </Button>
          )
        )}
        <IconButton
          color="inherit"
          onClick={fetchNoteDetails}
          disabled={loading}
        >
          <Refresh />
        </IconButton>
      </Box>

      {/* Error Alert */}
      {error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Success Alert */}
      {todoSuccess && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="success" onClose={() => setTodoSuccess(null)}>
            {todoSuccess}
          </Alert>
        </Box>
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', p: 3, gap: 3, overflow: 'hidden' }}>
        {/* Left Panel - Note Content */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Progress Note
              </Typography>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Expand all sections">
                  <IconButton size="small" onClick={() => setCollapsedSections(new Set())}>
                    <Visibility />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Collapse all sections">
                  <IconButton size="small" onClick={() => {
                    // Use the same data structure handling as renderProgressNote
                    const noteData = progressNoteData?.data || progressNoteData;
                    const allSections = noteData?.progressNotes?.map((s: any) => s.sectionType) || [];
                    console.log('🔧 Collapsing all sections:', allSections);
                    setCollapsedSections(new Set(allSections));
                  }}>
                    <VisibilityOff />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Status: {noteData?.status || 'Unknown'} • {(() => {
                const noteData = progressNoteData?.data || progressNoteData;
                return noteData?.progressNotes?.length || 0;
              })()} sections
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Loading note content...
                </Typography>
              </Box>
            ) : (
              renderProgressNote(progressNoteData)
            )}
          </Box>
        </Paper>

        {/* Right Panel - Care Team & AI Check History */}
        <Paper sx={{ width: '400px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
          {/* Care Team Section */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Group />
              Care Team ({careTeam.length})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Providers and staff for this encounter
            </Typography>
          </Box>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            {renderCareTeam()}
          </Box>

          {/* Created ToDos Section */}
          {createdTodos.length > 0 && (
            <>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Assignment color="success" />
                  Created ToDos ({createdTodos.length})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ToDos created for note deficiencies
                </Typography>
              </Box>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
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
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              AI Check History ({checkHistory.length})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Recent AI analysis results
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {checkHistory.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Psychology sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No checks yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
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
                            label={result.issuesFound ? 'Issues Found' : result.status === 'error' ? 'Error' : 'Clean'}
                            color={getStatusColor(result) as any}
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

                        {result.issuesFound && result.aiAnalysis?.issues && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                              Issues Found ({result.aiAnalysis.issues.length}):
                            </Typography>
                            {renderIssuesDetails(result.aiAnalysis.issues)}
                          </Box>
                        )}

                        {!result.issuesFound && result.status === 'completed' && (
                          <Box sx={{ mt: 1 }}>
                            <Alert severity="success" sx={{ fontSize: '0.75rem' }}>
                              ✅ All checks passed - note meets coding requirements
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
        onClose={() => setShowToDoModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
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
            onClick={() => setShowToDoModal(false)}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setShowToDoModal(false);
              await handleCreateToDo();
            }}
            variant="contained"
            color="warning"
            startIcon={creatingToDo ? <CircularProgress size={16} color="inherit" /> : <Assignment />}
            disabled={creatingToDo || !getToDoPreviewData()}
          >
            {creatingToDo ? 'Creating ToDo...' : 'Create ToDo'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NoteDetail;
