import React, { useState } from 'react';
import {
  Box,
  FormControl,
  Select,
  MenuItem,
  Typography,
  Chip,
  Tabs,
  Tab,
  useTheme,
  TextField,
  InputAdornment,
  IconButton,
  Collapse,
  Stack,
  Button,
  Divider
} from '@mui/material';
import {
  Assessment,
  CheckCircle,
  Warning,
  Schedule,
  Block,
  Search,
  Clear,
  FilterList,
  Sort,
  ExpandMore,
  ExpandLess,
  Assignment
} from '@mui/icons-material';
import useResponsive from '../hooks/useResponsive';

type FilterType = 'all' | 'clean' | 'issues' | 'unchecked' | 'issues-no-todos' | 'issues-with-todos';

interface NoteCounts {
  all: number;
  clean: number;
  issues: number;
  unchecked: number;
  'issues-no-todos': number;
  'issues-with-todos': number;
}

interface MobileFiltersProps {
  currentFilter: FilterType;
  noteCounts: NoteCounts;
  onFilterChange: (filter: FilterType) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}

const MobileFilters: React.FC<MobileFiltersProps> = ({
  currentFilter,
  noteCounts,
  onFilterChange,
  searchQuery = '',
  onSearchChange,
  sortBy = 'dateDesc',
  onSortChange
}) => {
  const { isMobile, isSmallMobile, isTablet } = useResponsive();
  const theme = useTheme();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filterOptions = [
    {
      value: 'all' as FilterType,
      label: 'All Notes',
      count: noteCounts.all,
      color: '#64748b',
      icon: <Assessment sx={{ fontSize: '1rem' }} />
    },
    {
      value: 'clean' as FilterType,
      label: 'Clean Notes',
      count: noteCounts.clean,
      color: '#10b981',
      icon: <CheckCircle sx={{ fontSize: '1rem' }} />
    },
    {
      value: 'issues' as FilterType,
      label: 'Notes with Issues',
      count: noteCounts.issues,
      color: '#ef4444',
      icon: <Warning sx={{ fontSize: '1rem' }} />
    },
    {
      value: 'unchecked' as FilterType,
      label: 'Unchecked Notes',
      count: noteCounts.unchecked,
      color: '#f59e0b',
      icon: <Schedule sx={{ fontSize: '1rem' }} />
    },
    {
      value: 'issues-no-todos' as FilterType,
      label: 'Issues Without ToDos',
      count: noteCounts['issues-no-todos'],
      color: '#dc2626',
      icon: <Block sx={{ fontSize: '1rem' }} />
    },
    {
      value: 'issues-with-todos' as FilterType,
      label: 'Issues With ToDos',
      count: noteCounts['issues-with-todos'],
      color: '#059669',
      icon: <Assignment sx={{ fontSize: '1rem' }} />
    }
  ];

  const sortOptions = [
    { value: 'dateDesc', label: 'Date of Service: Newest First' },
    { value: 'dateAsc', label: 'Date of Service: Oldest First' },
    { value: 'patientName', label: 'Patient Name' },
    { value: 'status', label: 'Status' },
    { value: 'aiStatus', label: 'AI Check Status' }
  ];

  const getCurrentFilterLabel = () => {
    const current = filterOptions.find(option => option.value === currentFilter);
    return current ? `${current.label} (${current.count})` : 'All Notes';
  };

  const getCurrentSortLabel = () => {
    const current = sortOptions.find(option => option.value === sortBy);
    return current ? current.label : 'Date of Service: Newest First';
  };

  // Enhanced mobile interface for small screens
  if (isSmallMobile) {
    return (
      <Box sx={{ 
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        borderBottom: '2px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        p: 2
      }}>
        {/* Search Bar */}
        {onSearchChange && (
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#64748b', fontSize: '1.1rem' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => onSearchChange('')}
                      sx={{ p: 0.5 }}
                    >
                      <Clear sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                backgroundColor: 'white',
                borderRadius: 2,
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#e2e8f0'
                  },
                  '&:hover fieldset': {
                    borderColor: '#3b82f6'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#3b82f6'
                  }
                }
              }}
            />
          </Box>
        )}

        {/* Filter and Sort Row */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <Select
              value={currentFilter}
              onChange={(e) => onFilterChange(e.target.value as FilterType)}
              displayEmpty
              sx={{
                backgroundColor: 'white',
                borderRadius: 2,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#3b82f6'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#3b82f6'
                }
              }}
            >
              {filterOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box sx={{ color: option.color }}>
                      {option.icon}
                    </Box>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {option.label}
                    </Typography>
                    <Chip
                      label={option.count}
                      size="small"
                      sx={{
                        backgroundColor: `${option.color}15`,
                        color: option.color,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        minWidth: '28px',
                        height: '20px'
                      }}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {onSortChange && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                displayEmpty
                sx={{
                  backgroundColor: 'white',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#e2e8f0'
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#3b82f6'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#3b82f6'
                  }
                }}
              >
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Sort sx={{ fontSize: '1rem', color: '#64748b' }} />
                      <Typography variant="body2">
                        {option.label}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>

        {/* Quick Filter Chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {filterOptions.slice(1, 4).map((option) => (
            <Chip
              key={option.value}
              label={`${option.label.split(' ')[0]} (${option.count})`}
              size="small"
              variant={currentFilter === option.value ? 'filled' : 'outlined'}
              onClick={() => onFilterChange(option.value)}
              sx={{
                backgroundColor: currentFilter === option.value ? `${option.color}15` : 'transparent',
                borderColor: `${option.color}30`,
                color: option.color,
                fontWeight: 600,
                fontSize: '0.7rem',
                '&:hover': {
                  backgroundColor: `${option.color}20`
                }
              }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  // Enhanced tablet interface
  if (isMobile || isTablet) {
    return (
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
        {/* Search and Sort Bar for Tablets */}
        {(onSearchChange || onSortChange) && (
          <Box sx={{ px: 2, pt: 2, pb: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              {onSearchChange && (
                <TextField
                  size="small"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  sx={{ 
                    flex: 1,
                    maxWidth: '300px',
                    backgroundColor: 'white',
                    borderRadius: 2,
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: '#e2e8f0'
                      },
                      '&:hover fieldset': {
                        borderColor: '#3b82f6'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#3b82f6'
                      }
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: '#64748b', fontSize: '1.1rem' }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => onSearchChange('')}
                          sx={{ p: 0.5 }}
                        >
                          <Clear sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              )}
              
              {onSortChange && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <Select
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value)}
                    displayEmpty
                    sx={{
                      backgroundColor: 'white',
                      borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#e2e8f0'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#3b82f6'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#3b82f6'
                      }
                    }}
                  >
                    {sortOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Sort sx={{ fontSize: '1rem', color: '#64748b' }} />
                          <Typography variant="body2">
                            {option.label}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Box>
        )}
        
        <Tabs 
          value={currentFilter} 
          onChange={(_, newValue) => onFilterChange(newValue as FilterType)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ 
            px: 2,
            '& .MuiTabs-indicator': {
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              height: 4,
              borderRadius: '2px 2px 0 0',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            },
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '0.85rem',
              textTransform: 'none',
              minHeight: 48,
              px: 2,
              py: 1.5,
              borderRadius: '8px 8px 0 0',
              margin: '0 1px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              minWidth: 'auto',
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
          {filterOptions.map((option) => (
            <Tab 
              key={option.value}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: option.color, display: 'flex' }}>
                    {option.icon}
                  </Box>
                  <span>{isTablet ? option.label : option.label.split(' ')[0]}</span>
                  <Box sx={{
                    backgroundColor: `${option.color}15`,
                    color: option.color,
                    px: 1,
                    py: 0.25,
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    minWidth: '20px',
                    textAlign: 'center',
                    border: `1px solid ${option.color}30`
                  }}>
                    {option.count}
                  </Box>
                </Box>
              } 
              value={option.value}
            />
          ))}
        </Tabs>
      </Box>
    );
  }

  // Return null for desktop - desktop will use original tabs
  return null;
};

export default MobileFilters;
