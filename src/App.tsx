/**
 * EZ Patient Tracking Board
 * 
 * DEVELOPMENT MODE:
 * To use mock data instead of the real API (useful for development without backend):
 * 1. Create a .env file in the project root
 * 2. Add: REACT_APP_USE_MOCK_DATA=true
 * 3. Restart the development server
 * 
 * When enabled, you'll see "DEMO MODE" in the header and can login with any credentials.
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AINoteChecker from './pages/AINoteChecker';
import NoteDetail from './pages/NoteDetail';
import { PrivateRoute } from './components/PrivateRoute';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 6,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/ai-note-checker"
              element={
                <PrivateRoute>
                  <AINoteChecker />
                </PrivateRoute>
              }
            />
            <Route
              path="/ai-note-checker/:encounterId"
              element={
                <PrivateRoute>
                  <NoteDetail />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
