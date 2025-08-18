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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge
} from '@mui/material';
import {
  Psychology,
  PlayArrow,
  Refresh,
  CheckCircle,
  Error,
  Warning,
  Visibility,
  ExpandMore,
  Assignment,
  Schedule,
  BugReport,
  TrendingUp,
  SmartToy,
  AssignmentTurnedIn
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import aiNoteCheckerService, { 
  EligibleEncounter, 
  NoteCheckResult, 
  BatchProcessResult,
  AIAnalysisIssue 
} from '../services/aiNoteChecker.service';

const AINoteChecker: React.FC = () => {
  const [eligibleEncounters, setEligibleEncounters] = useState<EligibleEncounter[]>([]);
  const [noteCheckResults, setNoteCheckResults] = useState<NoteCheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<NoteCheckResult | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [batchProgress, setBatchProgress] = useState<BatchProcessResult | null>(null);

  const {} = useAuth(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();

  // Check if we're in mock data mode
  const isUsingMockData = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [encounters, results] = await Promise.all([
        aiNoteCheckerService.getEligibleEncounters(),
        aiNoteCheckerService.getNoteCheckResults(50, 0)
      ]);
      
      // Sort encounters by date of service (newest first)
      const sortedEncounters = encounters.sort((a, b) => {
        return new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime();
      });
      
      // Sort results by checked date (newest first)
      const sortedResults = results.sort((a, b) => {
        return new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime();
      });
      
      setEligibleEncounters(sortedEncounters);
      setNoteCheckResults(sortedResults);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSingleNote = async (encounter: EligibleEncounter) => {
    setProcessing(true);
    try {
      const result = await aiNoteCheckerService.checkSingleNote(
        encounter.encounterId,
        encounter.patientId,
        encounter.patientName,
        encounter.chiefComplaint,
        encounter.dateOfService
      );
      
      // Add result to the top of the list and maintain sorting
      setNoteCheckResults(prev => {
        const updated = [result, ...prev];
        return updated.sort((a, b) => {
          return new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime();
        });
      });
      
      // Remove from eligible encounters if it was there
      setEligibleEncounters(prev => 
        prev.filter(e => e.encounterId !== encounter.encounterId)
      );
    } catch (err: any) {
      setError(err.message || 'Failed to check note');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessAllNotes = async () => {
    setProcessing(true);
    setBatchProgress(null);
    try {
      const result = await aiNoteCheckerService.processAllEligibleNotes();
      setBatchProgress(result);
      
      // Refresh data to show new results
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to process all notes');
    } finally {
      setProcessing(false);
    }
  };

  const handleViewDetails = (result: NoteCheckResult) => {
    setSelectedResult(result);
    setDetailsDialogOpen(true);
  };

  const getStatusChip = (status: string, issuesFound?: boolean) => {
    const config = {
      completed: { 
        color: issuesFound ? '#F44336' : '#4CAF50', 
        background: issuesFound ? '#FFEBEE' : '#E8F5E8', 
        icon: issuesFound ? Warning : CheckCircle,
        label: issuesFound ? 'Issues Found' : 'Clean'
      },
      pending: { 
        color: '#FF9800', 
        background: '#FFF3E0', 
        icon: Schedule,
        label: 'Pending'
      },
      error: { 
        color: '#F44336', 
        background: '#FFEBEE', 
        icon: Error,
        label: 'Error'
      }
    } as const;

    const statusConfig = config[status as keyof typeof config] || 
                        { color: '#757575', background: '#F5F5F5', icon: Assignment, label: status };

    const IconComponent = statusConfig.icon;

    return (
      <Chip
        icon={<IconComponent sx={{ fontSize: '1rem !important', color: statusConfig.color }} />}
        label={statusConfig.label}
        size="small"
        sx={{
          backgroundColor: statusConfig.background,
          fontWeight: 'bold',
          fontSize: '0.75rem'
        }}
      />
    );
  };

  const renderIssuesList = (issues: AIAnalysisIssue[]) => {
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
                    <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold' }}>
                      HPI Documentation:
                    </Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                      "{issue.details.HPI}"
                    </Typography>
                  </Box>
                )}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold' }}>
                    A&P Documentation:
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    "{issue.details['A&P']}"
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 'bold' }}>
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

  const stats = {
    totalChecked: noteCheckResults.length,
    withIssues: noteCheckResults.filter(r => r.issuesFound).length,
    clean: noteCheckResults.filter(r => r.status === 'completed' && !r.issuesFound).length,
    errors: noteCheckResults.filter(r => r.status === 'error').length,
    eligible: eligibleEncounters.length
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <Box sx={{ 
        backgroundColor: '#1976d2', 
        color: 'white', 
        px: 3, 
        py: 1.5,
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Psychology sx={{ fontSize: '2rem' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
              AI Note Checker
              {isUsingMockData && (
                <Chip 
                  label="DEMO MODE" 
                  size="small" 
                  sx={{ 
                    ml: 1, 
                    backgroundColor: '#ff9800', 
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '0.7rem'
                  }} 
                />
              )}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              AI-powered medical coding validation • Updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Back to Dashboard">
            <Button
              variant="outlined"
              sx={{ color: 'white', borderColor: 'white' }}
              onClick={() => navigate('/dashboard')}
            >
              Dashboard
            </Button>
          </Tooltip>
          <Tooltip title="Refresh Data">
            <IconButton 
              onClick={fetchData} 
              disabled={loading}
              sx={{ color: 'white' }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                <Refresh sx={{ fontSize: '1.5rem' }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mx: 3, mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Batch Progress Alert */}
      {batchProgress && (
        <Alert 
          severity="success" 
          sx={{ mx: 3, mt: 1 }} 
          onClose={() => setBatchProgress(null)}
        >
          Batch processing completed: {batchProgress.successful} successful, {batchProgress.failed} failed out of {batchProgress.processed} notes
        </Alert>
      )}

      {/* Stats Cards */}
      <Box sx={{ px: 3, py: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Badge badgeContent={stats.eligible} color="primary">
                  <AssignmentTurnedIn sx={{ fontSize: '2rem', color: '#1976d2' }} />
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                  Eligible
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ready for AI check
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <SmartToy sx={{ fontSize: '2rem', color: '#4CAF50' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                  {stats.totalChecked}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Checked
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <CheckCircle sx={{ fontSize: '2rem', color: '#4CAF50' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                  {stats.clean}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Clean Notes
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Warning sx={{ fontSize: '2rem', color: '#FF9800' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                  {stats.withIssues}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Need Attention
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <BugReport sx={{ fontSize: '2rem', color: '#F44336' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                  {stats.errors}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Errors
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', px: 3, pb: 2 }}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          {/* Eligible Encounters */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper sx={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Eligible Encounters ({eligibleEncounters.length})
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={processing ? <CircularProgress size={16} /> : <PlayArrow />}
                    onClick={handleProcessAllNotes}
                    disabled={processing || eligibleEncounters.length === 0}
                    size="small"
                  >
                    Process All
                  </Button>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Notes eligible for AI checking (&gt;2 hours old, specific statuses)
                </Typography>
              </Box>
              
              <Box sx={{ height: '600px', overflow: 'hidden' }}>
                {eligibleEncounters.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <TrendingUp sx={{ fontSize: '3rem', color: '#4CAF50', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      No eligible encounters
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      All recent notes have been checked or don't meet criteria
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ height: '600px', overflow: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>Patient</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>Chief Complaint</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>Age</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }} align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {eligibleEncounters.map((encounter) => (
                          <TableRow key={encounter.encounterId} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {encounter.patientName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {encounter.status}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {encounter.chiefComplaint}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {aiNoteCheckerService.formatTimeAgo(encounter.dateOfService)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Check Note">
                                <IconButton
                                  size="small"
                                  onClick={() => handleCheckSingleNote(encounter)}
                                  disabled={processing}
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
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Note Check Results */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Paper sx={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  AI Check Results ({noteCheckResults.length})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Recent note validation results from Claude AI
                </Typography>
              </Box>
              
              <Box sx={{ height: '600px', overflow: 'hidden' }}>
                {noteCheckResults.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Assignment sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      No results yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Check some notes to see AI analysis results here
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ height: '600px', overflow: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>Patient</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>Checked</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }} align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {noteCheckResults.map((result) => (
                          <TableRow key={result.id} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {result.patientName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {result.chiefComplaint}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {getStatusChip(result.status, result.issuesFound)}
                              {result.errorMessage && (
                                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                  {result.errorMessage}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {aiNoteCheckerService.formatTimeAgo(result.checkedAt)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                by {result.checkedBy}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewDetails(result)}
                                  color="primary"
                                >
                                  <Visibility />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Psychology color="primary" />
          AI Analysis Details - {selectedResult?.patientName}
        </DialogTitle>
        <DialogContent>
          {selectedResult && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Patient:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {selectedResult.patientName}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Chief Complaint:</Typography>
                  <Typography variant="body1">{selectedResult.chiefComplaint}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Date of Service:</Typography>
                  <Typography variant="body1">
                    {aiNoteCheckerService.formatDate(selectedResult.dateOfService)}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Checked:</Typography>
                  <Typography variant="body1">
                    {aiNoteCheckerService.formatDate(selectedResult.checkedAt)}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {selectedResult.status === 'error' ? (
                <Alert severity="error">
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Analysis Error
                  </Typography>
                  <Typography variant="body2">
                    {selectedResult.errorMessage || 'Unknown error occurred during analysis'}
                  </Typography>
                </Alert>
              ) : selectedResult.aiAnalysis?.status === 'ok' ? (
                <Alert severity="success">
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    ✅ Note is Clean
                  </Typography>
                  <Typography variant="body2">
                    No issues found. The note meets medical coding standards for chronicity documentation and plan completeness.
                  </Typography>
                </Alert>
              ) : selectedResult.aiAnalysis?.issues ? (
                <Box>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      ⚠️ Issues Found ({selectedResult.aiAnalysis.issues.length})
                    </Typography>
                    <Typography variant="body2">
                      {selectedResult.aiAnalysis.summary || 'The following issues need attention before signing:'}
                    </Typography>
                  </Alert>
                  {renderIssuesList(selectedResult.aiAnalysis.issues)}
                </Box>
              ) : (
                <Alert severity="info">
                  <Typography variant="body2">
                    Analysis completed but no detailed results available.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AINoteChecker;
