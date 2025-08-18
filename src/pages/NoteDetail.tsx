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
  Stack
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
  Timeline,
  Person,
  Schedule
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import aiNoteCheckerService, { NoteCheckResult, AIAnalysisIssue } from '../services/aiNoteChecker.service';

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
  const {} = useAuth(); // eslint-disable-line @typescript-eslint/no-unused-vars

  const [noteData, setNoteData] = useState<NoteDetailProps | null>(null);
  const [progressNoteData, setProgressNoteData] = useState<any>(null);
  const [checkHistory, setCheckHistory] = useState<NoteCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [encounterId, location.state]);

  const fetchNoteDetails = async () => {
    if (!encounterId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch note content and check history
      const [progressNote, history] = await Promise.all([
        fetchNoteContent(),
        fetchCheckHistory()
      ]);

      setProgressNoteData(progressNote);
      setCheckHistory(history);
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
                          {item.text && (
                            <Paper 
                              sx={{ 
                                p: 2, 
                                bgcolor: 'background.default',
                                border: '1px solid',
                                borderColor: 'divider'
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
                              {item.elementType && (
                                <Chip 
                                  label={item.elementType.replace(/_/g, ' ')}
                                  size="small"
                                  sx={{ mt: 1, fontSize: '0.7rem' }}
                                  color="default"
                                />
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
          const progressNote = await aiNoteCheckerService.getProgressNote(encounterId);
          // The backend should return patientId in the response
          patientId = (progressNote as any).patientId;
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
        dateOfService
      );

      // Refresh check history
      const newHistory = await fetchCheckHistory();
      setCheckHistory(newHistory);
    } catch (err: any) {
      setError(err.message || 'Failed to check note');
    } finally {
      setChecking(false);
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
                  label={issue.issue === 'no_explicit_plan' ? 'Missing Plan' : 'Chronicity Mismatch'}
                  size="small"
                  color={issue.issue === 'no_explicit_plan' ? 'error' : 'warning'}
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
        <Button
          variant="outlined"
          color="inherit"
          startIcon={checking ? <CircularProgress size={16} color="inherit" /> : <Psychology />}
          onClick={handleCheckNote}
          disabled={checking}
          size="small"
        >
          {checking ? 'Checking...' : 'Run AI Check'}
        </Button>
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
                    const allSections = progressNoteData?.data?.progressNotes?.map((s: any) => s.sectionType) || [];
                    setCollapsedSections(new Set(allSections));
                  }}>
                    <VisibilityOff />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Status: {noteData?.status || 'Unknown'} • {progressNoteData?.data?.progressNotes?.length || 0} sections
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

        {/* Right Panel - AI Check History */}
        <Paper sx={{ width: '400px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
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
    </Box>
  );
};

export default NoteDetail;
