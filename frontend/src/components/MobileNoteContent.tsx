import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  List,
  ListItem,
  Card,
  CardContent,
  CardHeader,
  Collapse,
  IconButton,
  Tooltip,
  Stack,
  Chip,
  Alert,
  Divider,
  Button,
  TextField,
  CircularProgress,
  Badge
} from '@mui/material';
import {
  Description,
  Group,
  Psychology,
  Assignment,
  Visibility,
  VisibilityOff,
  Person,
  LocalHospital,
  Assessment,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  MedicalServices,
  Edit,
  Save,
  Cancel,
  Block,
  TaskAlt,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import useResponsive from '../hooks/useResponsive';
import aiNoteCheckerService from '../services/aiNoteChecker.service';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`mobile-tabpanel-${index}`}
      aria-labelledby={`mobile-tab-${index}`}
      style={{
        height: '100%',
        overflow: value === index ? 'auto' : 'hidden',
        WebkitOverflowScrolling: 'touch', // Enable momentum scrolling on iOS
        overscrollBehavior: 'contain' // Prevent overscroll bounce affecting parent
      }}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

interface MobileNoteContentProps {
  // Note data
  progressNoteData: any;
  careTeam: any[];
  checkHistory: any[];
  createdTodos: any[];
  invalidIssues: any[];
  resolvedIssues?: any[];
  
  // State
  loading?: boolean;
  noteSignedOff?: boolean;
  
  // HPI Editing
  editingHPI?: { sectionIndex: number; itemIndex: number } | null;
  hpiEditText?: string;
  savingHPI?: boolean;
  onEditHPI?: (sectionIndex: number, itemIndex: number, currentText: string) => void;
  onSaveHPI?: () => void;
  onCancelHPIEdit?: () => void;
  onHPITextChange?: (text: string) => void;
  
  // Issue management
  onMarkIssueInvalid?: (checkId: number, issueIndex: number, issue: any, reason?: string) => void;
  onUnmarkIssueInvalid?: (checkId: number, issueIndex: number) => void;
  onMarkIssueResolved?: (checkId: number, issueIndex: number, issue: any, reason?: string) => void;
  onUnmarkIssueResolved?: (checkId: number, issueIndex: number) => void;
  
  // ToDo status
  todoStatuses?: Map<string, any>;
  renderToDoStatusChip?: (todo: any) => React.ReactNode;
  onFetchToDoStatus?: (todoId: string, patientId: string) => Promise<any>;
}

const MobileNoteContent: React.FC<MobileNoteContentProps> = ({
  progressNoteData,
  careTeam = [],
  checkHistory = [],
  createdTodos = [],
  invalidIssues = [],
  resolvedIssues = [],
  loading = false,
  noteSignedOff = false,
  editingHPI,
  hpiEditText = '',
  savingHPI = false,
  onEditHPI,
  onSaveHPI,
  onCancelHPIEdit,
  onHPITextChange,
  onMarkIssueInvalid,
  onUnmarkIssueInvalid,
  onMarkIssueResolved,
  onUnmarkIssueResolved,
  todoStatuses,
  renderToDoStatusChip,
  onFetchToDoStatus
}) => {
  const { isMobile } = useResponsive();
  const [currentTab, setCurrentTab] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedIssues, setCollapsedIssues] = useState<Set<string>>(new Set());

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
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

  const isIssueMarkedInvalid = (checkId: number, issueIndex: number): boolean => {
    return invalidIssues.some(invalid => 
      invalid.checkId === checkId && invalid.issueIndex === issueIndex
    );
  };

  // Helper function to check if an issue is marked as resolved
  const isIssueMarkedResolved = (checkId: number, issueIndex: number): boolean => {
    return resolvedIssues?.some(resolved => 
      resolved.checkId === checkId && resolved.issueIndex === issueIndex
    ) || false;
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

  // Auto-collapse resolved/invalid issues when data loads
  React.useEffect(() => {
    if (!checkHistory.length || (!invalidIssues.length && !resolvedIssues.length)) return;

    const issuesToCollapse = new Set<string>();

    // Go through check history and find all resolved/invalid issues
    checkHistory.forEach(result => {
      if (result.aiAnalysis?.issues) {
        result.aiAnalysis.issues.forEach((issue: any, index: number) => {
          const isInvalid = invalidIssues.some(invalid => 
            invalid.checkId === result.id && invalid.issueIndex === index
          );
          const isResolved = resolvedIssues?.some(resolved => 
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

  const getValidIssues = (result: any) => {
    if (!result.aiAnalysis?.issues) return [];
    
    return result.aiAnalysis.issues.filter((_: any, index: number) => 
      !isIssueMarkedInvalid(result.id!, index)
    );
  };

  const hasValidIssues = (result: any): boolean => {
    return getValidIssues(result).length > 0;
  };

  const getStatusIcon = (result: any) => {
    if (result.status === 'error') {
      return <ErrorIcon color="error" />;
    }
    if (hasValidIssues(result)) {
      return <Warning color="warning" />;
    }
    return <CheckCircle color="success" />;
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

  const renderProgressNote = () => {
    if (loading) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading note content...
          </Typography>
        </Box>
      );
    }

    if (!progressNoteData) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Description sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No note content available
          </Typography>
        </Box>
      );
    }

    const noteData = progressNoteData.data || progressNoteData;
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
      <Box sx={{ 
        p: 1,
        height: '100%',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <Stack spacing={1}>
          {sections.map((section: any, index: number) => {
            const sectionType = section.sectionType || section.label || `Section ${index + 1}`;
            const isCollapsed = collapsedSections.has(sectionType);
            const sectionColor = getSectionColor(sectionType);
            
            return (
              <Card 
                key={sectionType} 
                sx={{ 
                  border: `1px solid ${sectionColor}30`,
                  borderRadius: 2
                }}
              >
                <CardHeader
                  avatar={getSectionIcon(sectionType)}
                  title={
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700, 
                      color: sectionColor,
                      fontSize: '1rem'
                    }}>
                      {sectionType.replace(/_/g, ' & ')}
                    </Typography>
                  }
                  action={
                    <IconButton 
                      onClick={() => toggleSection(sectionType)}
                      size="small"
                    >
                      {isCollapsed ? <Visibility /> : <VisibilityOff />}
                    </IconButton>
                  }
                  sx={{
                    bgcolor: `${sectionColor}08`,
                    borderBottom: `1px solid ${sectionColor}20`,
                    py: 1
                  }}
                />
                <Collapse in={!isCollapsed}>
                  <CardContent sx={{ p: 2 }}>
                    {section.items && section.items.length > 0 ? (
                      <Stack spacing={1.5}>
                        {section.items.map((item: any, itemIndex: number) => (
                          <Box key={itemIndex}>
                            {item.elementType && (
                              <Typography 
                                variant="subtitle2" 
                                sx={{ 
                                  fontWeight: 700, 
                                  mb: 1, 
                                  color: 'primary.main',
                                  fontSize: '0.9rem'
                                }}
                              >
                                {item.elementType.replace(/_/g, ' ')}
                              </Typography>
                            )}
                            
                            {item.text && (
                              <Paper 
                                sx={{ 
                                  p: 1.5, 
                                  bgcolor: 'background.default',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  mb: item.note ? 1 : 0
                                }}
                              >
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  {item.text}
                                </Typography>
                              </Paper>
                            )}
                            
                            {item.note && (
                              <Paper 
                                sx={{ 
                                  p: 1.5, 
                                  bgcolor: 'background.paper',
                                  border: '1px solid',
                                  borderColor: 'primary.main',
                                  borderRadius: 1,
                                  position: 'relative'
                                }}
                              >
                                {/* Edit button for HPI sections */}
                                {item.elementType === 'HISTORY_OF_PRESENT_ILLNESS' && !noteSignedOff && (
                                  <Box sx={{ 
                                    position: 'absolute', 
                                    top: 8, 
                                    right: 8,
                                    zIndex: 10
                                  }}>
                                    {editingHPI?.sectionIndex === index && editingHPI?.itemIndex === itemIndex ? (
                                      <Stack direction="row" spacing={0.5}>
                                        <IconButton
                                          size="small"
                                          onClick={onSaveHPI}
                                          disabled={savingHPI}
                                          sx={{
                                            backgroundColor: '#10b981',
                                            color: 'white',
                                            width: 32,
                                            height: 32,
                                            '&:hover': { backgroundColor: '#059669' },
                                            '&:disabled': { backgroundColor: '#64748b' }
                                          }}
                                        >
                                          {savingHPI ? <CircularProgress size={14} color="inherit" /> : <Save sx={{ fontSize: '0.9rem' }} />}
                                        </IconButton>
                                        <IconButton
                                          size="small"
                                          onClick={onCancelHPIEdit}
                                          disabled={savingHPI}
                                          sx={{
                                            backgroundColor: '#ef4444',
                                            color: 'white',
                                            width: 32,
                                            height: 32,
                                            '&:hover': { backgroundColor: '#dc2626' }
                                          }}
                                        >
                                          <Cancel sx={{ fontSize: '0.9rem' }} />
                                        </IconButton>
                                      </Stack>
                                    ) : (
                                      <IconButton
                                        size="small"
                                        onClick={() => onEditHPI?.(index, itemIndex, item.note)}
                                        sx={{
                                          backgroundColor: '#3b82f6',
                                          color: 'white',
                                          width: 32,
                                          height: 32,
                                          '&:hover': { backgroundColor: '#2563eb' }
                                        }}
                                      >
                                        <Edit sx={{ fontSize: '0.9rem' }} />
                                      </IconButton>
                                    )}
                                  </Box>
                                )}
                                
                                {editingHPI?.sectionIndex === index && editingHPI?.itemIndex === itemIndex ? (
                                  <TextField
                                    multiline
                                    rows={6}
                                    fullWidth
                                    value={hpiEditText}
                                    onChange={(e) => onHPITextChange?.(e.target.value)}
                                    disabled={savingHPI}
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        fontSize: '0.85rem',
                                        lineHeight: 1.6
                                      }
                                    }}
                                    placeholder="Enter HPI text..."
                                  />
                                ) : (
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      lineHeight: 1.6,
                                      whiteSpace: 'pre-wrap',
                                      fontSize: '0.85rem',
                                      pr: item.elementType === 'HISTORY_OF_PRESENT_ILLNESS' && !noteSignedOff ? 5 : 0
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
      </Box>
    );
  };

  const renderCareTeam = () => {
    if (loading) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Loading care team...
          </Typography>
        </Box>
      );
    }

    if (!careTeam || careTeam.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Group sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No care team information
          </Typography>
        </Box>
      );
    }

    const getRoleIcon = (role: string) => {
      switch (role) {
        case 'PROVIDER':
          return <MedicalServices sx={{ color: 'primary.main' }} />;
        case 'SECONDARY_PROVIDER':
          return <Person sx={{ color: 'secondary.main' }} />;
        case 'STAFF':
          return <Person sx={{ color: 'text.secondary' }} />;
        default:
          return <Group sx={{ color: 'text.secondary' }} />;
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
      <Box sx={{ 
        p: 2,
        height: '100%',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <Stack spacing={1}>
          {careTeam.map((member) => (
            <Card
              key={member.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {getRoleIcon(member.encounterRoleType)}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
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
                      color="primary"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px', mt: 0.5 }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    );
  };

  const renderAIHistory = () => {
    if (loading) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Loading AI history...
          </Typography>
        </Box>
      );
    }

    if (checkHistory.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Psychology sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No AI checks yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Run an AI check to see analysis results
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ 
        p: 1,
        height: '100%',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <Stack spacing={1}>
          {checkHistory.map((result, index) => (
            <Card key={result.id} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
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
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, fontSize: '0.85rem' }}>
                      Issues ({getValidIssues(result).length} valid, {result.aiAnalysis.issues.length} total):
                    </Typography>
                    
                    {(() => {
                      // Group issues by check type for mobile view  
                      const checkTypeMap: { [key: string]: string } = {
                        'chronicity-check': 'Chronicity Analysis',
                        'hpi-structure-check': 'HPI Structure Analysis', 
                        'plan-check': 'Plan Documentation Analysis',
                        'vital-signs-check': 'Vital Signs Validation'
                      };

                      const checkTypeColors: { [key: string]: string } = {
                        'chronicity-check': '#ff5722',
                        'hpi-structure-check': '#2196f3',
                        'plan-check': '#ff9800',
                        'vital-signs-check': '#9c27b0'
                      };

                      const issuesByCheckType = result.aiAnalysis.issues.reduce((groups: any, issue: any, issueIndex: number) => {
                        const checkType = issue.checkType || 'unknown';
                        if (!groups[checkType]) {
                          groups[checkType] = [];
                        }
                        groups[checkType].push({ issue, issueIndex });
                        return groups;
                      }, {});

                      return (
                        <Stack spacing={2}>
                          {Object.entries(issuesByCheckType).map(([checkType, issueItems]: [string, any]) => (
                            <Box key={checkType}>
                              {/* Check Type Header for Mobile */}
                              <Box sx={{ 
                                p: 1.5, 
                                borderRadius: 1,
                                bgcolor: 'grey.50',
                                border: '1px solid',
                                borderColor: 'grey.200',
                                mb: 1
                              }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box sx={{
                                    width: 3,
                                    height: 16,
                                    bgcolor: checkTypeColors[checkType] || '#757575',
                                    borderRadius: 0.5
                                  }} />
                                  <Typography variant="body2" sx={{ 
                                    fontWeight: 'bold',
                                    color: checkTypeColors[checkType] || '#757575',
                                    fontSize: '0.8rem'
                                  }}>
                                    {checkTypeMap[checkType] || `${checkType} Check`}
                                  </Typography>
                                  <Chip 
                                    label={`${issueItems.length}`}
                                    size="small"
                                    sx={{ 
                                      bgcolor: checkTypeColors[checkType] || '#757575',
                                      color: 'white',
                                      fontWeight: 'bold',
                                      fontSize: '0.65rem',
                                      height: '20px'
                                    }}
                                  />
                                </Box>
                              </Box>

                              {/* Issues for this check type */}
                              <Stack spacing={1}>
                                {issueItems.map(({ issue, issueIndex }: { issue: any, issueIndex: number }) => {
                                  const isInvalid = isIssueMarkedInvalid(result.id!, issueIndex);
                                  const isResolved = isIssueMarkedResolved(result.id!, issueIndex);
                                  const isMarked = isInvalid || isResolved;
                                  const isCollapsed = isIssueCollapsed(result.id!, issueIndex);
                                  
                                  // Determine border color and background based on status
                                  const getBorderColor = () => {
                                    if (isInvalid) return 'action.disabled';
                                    if (isResolved) return 'success.main';
                                    return 'warning.main';
                                  };
                                  
                                  const getBgColor = () => {
                                    if (isInvalid) return 'action.hover';
                                    if (isResolved) return 'success.50';
                                    return 'background.paper';
                                  };
                                  
                                  return (
                                    <Paper
                                      key={issueIndex}
                                      sx={{
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
                                        p: 1.5, 
                                        pb: isMarked && isCollapsed ? 1.5 : 1,
                                        cursor: isMarked ? 'pointer' : 'default'
                                      }}
                                      onClick={() => isMarked ? toggleIssueCollapse(result.id!, issueIndex) : undefined}
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: isMarked && isCollapsed ? 0 : 1 }}>
                                          <Chip
                                            label={issue.issue.replace(/_/g, ' ')}
                                            color={isInvalid ? 'default' : isResolved ? 'success' : 'warning'}
                                            size="small"
                                            sx={{ fontSize: '0.7rem' }}
                                          />
                                          {isInvalid && (
                                            <Chip
                                              label="Invalid"
                                              color="default"
                                              size="small"
                                              icon={<Block />}
                                              sx={{ fontSize: '0.7rem' }}
                                            />
                                          )}
                                          {isResolved && (
                                            <Chip
                                              label="Resolved"
                                              color="success"
                                              size="small"
                                              icon={<TaskAlt />}
                                              sx={{ fontSize: '0.7rem' }}
                                            />
                                          )}
                                          {isMarked && (
                                            <IconButton 
                                              size="small" 
                                              sx={{ ml: 'auto', p: 0.25 }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleIssueCollapse(result.id!, issueIndex);
                                              }}
                                            >
                                              {isCollapsed ? <ExpandMore sx={{ fontSize: '1rem' }} /> : <ExpandLess sx={{ fontSize: '1rem' }} />}
                                            </IconButton>
                                          )}
                                        </Box>
                                        
                                        {/* Show truncated assessment when collapsed */}
                                        {isMarked && isCollapsed && (
                                          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic' }}>
                                            {issue.assessment.substring(0, 60)}...
                                          </Typography>
                                        )}
                                      </Box>

                                      {/* Issue Details - Collapsible */}
                                      <Collapse in={!isMarked || !isCollapsed}>
                                        <Box sx={{ px: 1.5, pb: 1.5 }}>
                                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5, fontSize: '0.8rem' }}>
                                            {issue.assessment}
                                          </Typography>

                                          <Typography variant="body2" sx={{ fontSize: '0.75rem', mb: 1, color: 'text.secondary' }}>
                                            {issue.details.correction}
                                          </Typography>

                                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {!isInvalid && !isResolved && (
                                              <>
                                                <Button
                                                  size="small"
                                                  variant="outlined"
                                                  color="error"
                                                  startIcon={<Block />}
                                                  onClick={() => onMarkIssueInvalid?.(result.id, issueIndex, issue)}
                                                  sx={{ fontSize: '0.7rem', py: 0.25 }}
                                                >
                                                  Mark Invalid
                                                </Button>
                                                <Button
                                                  size="small"
                                                  variant="outlined"
                                                  color="success"
                                                  startIcon={<TaskAlt />}
                                                  onClick={() => onMarkIssueResolved?.(result.id, issueIndex, issue)}
                                                  sx={{ fontSize: '0.7rem', py: 0.25 }}
                                                >
                                                  Mark Resolved
                                                </Button>
                                              </>
                                            )}
                                            {isInvalid && (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                                startIcon={<CheckCircle />}
                                                onClick={() => onUnmarkIssueInvalid?.(result.id, issueIndex)}
                                                sx={{ fontSize: '0.7rem', py: 0.25 }}
                                              >
                                                Mark Valid
                                              </Button>
                                            )}
                                            {isResolved && (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                                startIcon={<Warning />}
                                                onClick={() => onUnmarkIssueResolved?.(result.id, issueIndex)}
                                                sx={{ fontSize: '0.7rem', py: 0.25 }}
                                              >
                                                Mark Unresolved
                                              </Button>
                                            )}
                                          </Box>
                                        </Box>
                                      </Collapse>
                                    </Paper>
                                  );
                                })}
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      );
                    })()}
                  </Box>
                )}

                {!hasValidIssues(result) && result.status === 'completed' && (
                  <Alert severity="success" sx={{ mt: 1, fontSize: '0.75rem' }}>
                    {result.aiAnalysis?.issues && result.aiAnalysis.issues.length > 0 
                      ? '✅ All issues marked as invalid - note meets requirements'
                      : '✅ All checks passed - note meets coding requirements'
                    }
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    );
  };

  const renderCreatedTodos = () => {
    if (createdTodos.length === 0) {
      return null;
    }

    return (
      <Box sx={{ 
        p: 1,
        height: '100%',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <Stack spacing={1}>
          {createdTodos.map((todo) => (
            <Card key={todo.id} sx={{ border: '1px solid', borderColor: 'success.main', bgcolor: 'success.50' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Assignment color="success" sx={{ fontSize: '1rem' }} />
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.dark', fontSize: '0.85rem' }}>
                    {todo.subject}
                  </Typography>
                  <Chip 
                    label={`${todo.issuesCount} issues`} 
                    size="small" 
                    color="warning"
                    sx={{ fontSize: '0.7rem' }}
                  />
                  {renderToDoStatusChip && renderToDoStatusChip(todo)}
                </Box>
                <Typography variant="body2" sx={{ mb: 1, fontSize: '0.8rem' }}>
                  <strong>Assigned to:</strong> {todo.assignedToName}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    Created {aiNoteCheckerService.formatTimeAgo(todo.createdAt.toString())} by {todo.createdBy}
                    <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.6, fontSize: '0.65rem' }}>
                      (ID: {todo.ezDermToDoId})
                    </Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {aiNoteCheckerService.formatDate(todo.createdAt.toString())}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    );
  };

  // Count items for badges
  const aiHistoryCount = checkHistory.length;
  const careTeamCount = careTeam.length;
  const todosCount = createdTodos.length;

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden' // Prevent the container from growing beyond viewport
    }}>
      {/* Tab Navigation */}
      <Paper sx={{ 
        borderRadius: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0 // Prevent tabs from shrinking
      }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              minWidth: 'auto',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'none',
              py: 1.5
            }
          }}
        >
          <Tab
            icon={<Description />}
            label="Note"
            iconPosition="start"
          />
          <Tab
            icon={
              <Badge badgeContent={careTeamCount} color="primary" max={99}>
                <Group />
              </Badge>
            }
            label="Care Team"
            iconPosition="start"
          />
          <Tab
            icon={
              <Badge badgeContent={aiHistoryCount} color="primary" max={99}>
                <Psychology />
              </Badge>
            }
            label="AI History"
            iconPosition="start"
          />
          {todosCount > 0 && (
            <Tab
              icon={
                <Badge badgeContent={todosCount} color="success" max={99}>
                  <Assignment />
                </Badge>
              }
              label="ToDos"
              iconPosition="start"
            />
          )}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0 // Important for flex children to shrink
      }}>
        <TabPanel value={currentTab} index={0}>
          {renderProgressNote()}
        </TabPanel>
        <TabPanel value={currentTab} index={1}>
          {renderCareTeam()}
        </TabPanel>
        <TabPanel value={currentTab} index={2}>
          {renderAIHistory()}
        </TabPanel>
        {todosCount > 0 && (
          <TabPanel value={currentTab} index={3}>
            {renderCreatedTodos()}
          </TabPanel>
        )}
      </Box>
    </Box>
  );
};

export default MobileNoteContent;

