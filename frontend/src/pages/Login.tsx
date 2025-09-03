import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EMRProvider, LoginRequest, EZDermLoginRequest, EMALoginRequest } from '../types/api.types';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Divider
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  LocalHospital
} from '@mui/icons-material';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  const [emrProvider, setEmrProvider] = useState<EMRProvider>('EZDERM');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firmName, setFirmName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [persistentLogin, setPersistentLogin] = useState(true); // Default to true for clinic dashboard

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    // Validate required fields based on EMR provider
    if (emrProvider === 'EMA') {
      if (!firmName || !username || !password) {
        setLocalError('Please enter firm name, username, and password');
        return;
      }
    } else {
      if (!username || !password) {
        setLocalError('Please enter both username and password');
        return;
      }
    }

    try {
      // Create the appropriate login request based on EMR provider
      let loginRequest: LoginRequest;
      
      if (emrProvider === 'EMA') {
        loginRequest = {
          emrProvider: 'EMA',
          firmName,
          username,
          password
        } as EMALoginRequest;
      } else {
        loginRequest = {
          emrProvider: 'EZDERM',
          username,
          password
        } as EZDermLoginRequest;
      }

      await login(loginRequest, persistentLogin);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login failed:', err);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            <LocalHospital sx={{ fontSize: 40, color: 'primary.main', mr: 1 }} />
            <Typography component="h1" variant="h5">
              EZ Tracking Board
            </Typography>
          </Box>
          
          <Typography component="h2" variant="h6" align="center" gutterBottom>
            Sign in to your account
          </Typography>

          {(error || localError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error || localError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
            {/* EMR Provider Selection */}
            <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.9rem', fontWeight: 500 }}>
                EMR Provider
              </FormLabel>
              <RadioGroup
                row
                value={emrProvider}
                onChange={(e) => {
                  setEmrProvider(e.target.value as EMRProvider);
                  // Clear form fields when switching providers
                  setUsername('');
                  setPassword('');
                  setFirmName('');
                  setLocalError('');
                }}
                sx={{ justifyContent: 'center' }}
              >
                <FormControlLabel
                  value="EZDERM"
                  control={<Radio />}
                  label="EZDerm"
                  disabled={isLoading}
                />
                <FormControlLabel
                  value="EMA"
                  control={<Radio />}
                  label="ModMed EMA"
                  disabled={isLoading}
                />
              </RadioGroup>
            </FormControl>

            <Divider sx={{ mb: 2 }} />

            {/* Dynamic form fields based on EMR provider */}
            {emrProvider === 'EMA' && (
              <TextField
                margin="normal"
                required
                fullWidth
                id="firmName"
                label="Firm Name"
                name="firmName"
                autoComplete="organization"
                autoFocus
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                disabled={isLoading}
                helperText="Enter your ModMed EMA firm name"
              />
            )}

            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus={emrProvider === 'EZDERM'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePassword}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={persistentLogin}
                  onChange={(e) => setPersistentLogin(e.target.checked)}
                  color="primary"
                />
              }
              label="Keep clinic dashboard logged in (recommended for shared terminals)"
              sx={{ mt: 1, mb: 1 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isLoading}
            >
              {isLoading ? (
                <CircularProgress size={24} />
              ) : (
                `Sign In to ${emrProvider === 'EMA' ? 'ModMed EMA' : 'EZDerm'}`
              )}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
            Patient Tracking System
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 