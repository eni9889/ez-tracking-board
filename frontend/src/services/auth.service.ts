import axios from 'axios';
import { LoginResponse } from '../types/api.types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://0.0.0.0:5001';

// Development flag - matches the one in patientTracking.service.ts
const USE_MOCK_DATA = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

interface SessionData {
  sessionToken: string;
  refreshToken: string;
  username: string;
  expiresAt: string;
  serverUrl?: string;
}

// Removed CredentialData interface for security reasons
// Credentials should never be stored in localStorage

class AuthService {
  private currentUser: string | null = null;
  private sessionToken: string | null = null;
  private readonly SESSION_STORAGE_KEY = 'ez_tracking_session';
  // Removed CREDENTIALS_STORAGE_KEY for security - never store passwords in localStorage

  private sessionRestorePromise: Promise<void>;

  constructor() {
    // Restore session from localStorage on service initialization (async)
    this.sessionRestorePromise = this.restoreSession().catch(error => {
      console.error('Failed to restore session:', error);
    });
  }

  // Ensure session restoration is complete before checking auth status
  async waitForSessionRestore(): Promise<void> {
    await this.sessionRestorePromise;
  }

  private async restoreSession(): Promise<void> {
    try {
      console.log('🔍 Starting session restoration...');
      const storedData = localStorage.getItem(this.SESSION_STORAGE_KEY);
      
      if (!storedData) {
        console.log('📭 No stored session data found');
        return;
      }
      
      console.log('📦 Found stored session data');
      const sessionData: SessionData = JSON.parse(storedData);
      const now = new Date();
      const expiresAt = new Date(sessionData.expiresAt);
      
      console.log('⏰ Session expires at:', expiresAt.toISOString());
      console.log('🕐 Current time:', now.toISOString());
      
      // Check if session is still valid locally
      if (expiresAt > now) {
        console.log('✅ Session is still valid locally, checking with server...');
        
        // Validate session with server
        const isValidOnServer = await this.validateSessionWithServer(sessionData.sessionToken);
        
        if (isValidOnServer) {
          this.currentUser = sessionData.username;
          this.sessionToken = sessionData.sessionToken;
          console.log('🔄 Session restored and validated for user:', sessionData.username);
        } else {
          console.log('🚫 Session invalid on server, attempting refresh...');
          await this.attemptTokenRefresh();
        }
      } else {
        // Session expired, attempt refresh
        console.log('⏰ Session expired locally, attempting refresh...');
        await this.attemptTokenRefresh();
      }
    } catch (error) {
      console.error('💥 Error restoring session:', error);
      this.clearStoredSession();
    }
  }

  private storeSession(sessionData: SessionData): void {
    try {
      localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      console.log('💾 Session stored for user:', sessionData.username);
    } catch (error) {
      console.error('Error storing session:', error);
    }
  }

  private clearStoredSession(): void {
    try {
      localStorage.removeItem(this.SESSION_STORAGE_KEY);
      this.sessionToken = null;
    } catch (error) {
      console.error('Error clearing stored session:', error);
    }
  }

  // Removed all credential storage methods for security reasons
  // Passwords should never be stored in localStorage

  async attemptTokenRefresh(): Promise<boolean> {
    try {
      const storedData = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!storedData) {
        console.log('❌ No session data available for token refresh');
        return false;
      }

      const sessionData: SessionData = JSON.parse(storedData);
      if (!sessionData.refreshToken) {
        console.log('❌ No refresh token available');
        this.clearStoredSession();
        return false;
      }

      console.log('🔄 Attempting token refresh...');
      
      if (USE_MOCK_DATA) {
        console.log('🚧 Development Mode: Mock token refresh successful');
        // Just update the expiration time for mock data
        const newExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        const updatedSessionData = {
          ...sessionData,
          expiresAt: newExpiresAt
        };
        this.storeSession(updatedSessionData);
        return true;
      }

      const response = await axios.post(`${API_BASE_URL}/refresh-token`, {
        refreshToken: sessionData.refreshToken
      });

      if (response.data.success) {
        console.log('✅ Token refresh successful');
        
        // Update tokens
        this.sessionToken = response.data.sessionToken;
        this.currentUser = sessionData.username;
        
        // Store new session data
        this.storeSession({
          sessionToken: response.data.sessionToken,
          refreshToken: response.data.refreshToken,
          username: sessionData.username,
          expiresAt: response.data.expiresAt,
          serverUrl: sessionData.serverUrl
        });
        
        return true;
      } else {
        console.log('❌ Token refresh failed');
        this.clearStoredSession();
        return false;
      }
    } catch (error: any) {
      console.error('💥 Token refresh error:', error);
      this.clearStoredSession();
      return false;
    }
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  private async validateSessionWithServer(sessionToken: string): Promise<boolean> {
    try {
      // In development with mock data, skip server validation
      if (USE_MOCK_DATA) {
        console.log('🚧 Development Mode: Skipping server session validation');
        return true;
      }

      console.log('🌐 Validating session with server...');
      console.log('🔑 Session token (first 20 chars):', sessionToken.substring(0, 20) + '...');
      
      const response = await axios.post(`${API_BASE_URL}/validate-session`, {}, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      console.log('📡 Server response status:', response.status);
      console.log('📋 Server response data:', response.data);
      
      const isValid = response.data.valid === true;
      console.log('✅ Session validation result:', isValid);
      
      return isValid;
    } catch (error: any) {
      console.error('💥 Session validation failed:', error.message);
      if (error.response) {
        console.error('📡 Response status:', error.response.status);
        console.error('📋 Response data:', error.response.data);
      }
      return false;
    }
  }

  async validateCurrentSession(): Promise<boolean> {
    if (!this.sessionToken) {
      console.log('❌ No session token available for validation');
      return false;
    }
    
    console.log('🔍 Validating current session...');
    return await this.validateSessionWithServer(this.sessionToken);
  }

  async refreshSession(): Promise<boolean> {
    if (!this.sessionToken) {
      console.log('❌ No session token available for refresh');
      return false;
    }

    try {
      console.log('🔄 Refreshing session...');
      
      // For now, we just validate the session
      // In the future, we could implement a proper session refresh endpoint
      const isValid = await this.validateSessionWithServer(this.sessionToken);
      
      if (isValid) {
        // Update the local expiration time by validating again
        // The validation call would have updated the last_accessed time on the server
        console.log('✅ Session refreshed successfully');
      }
      
      return isValid;
    } catch (error) {
      console.error('💥 Session refresh failed:', error);
      return false;
    }
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      // Mock login in development mode
      if (USE_MOCK_DATA) {
        console.log('🚧 Development Mode: Mock login successful');
        this.currentUser = username;
        
        // Create mock session
        const mockSessionToken = 'mock_session_' + Date.now();
        const mockRefreshToken = 'mock_refresh_' + Date.now();
        const mockExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours
        this.sessionToken = mockSessionToken;
        
        this.storeSession({
          sessionToken: mockSessionToken,
          refreshToken: mockRefreshToken,
          username,
          expiresAt: mockExpiresAt,
          serverUrl: process.env.REACT_APP_API_URL || 'http://0.0.0.0:5001'
        });
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          success: true,
          username,
          serverUrl: process.env.REACT_APP_API_URL || 'http://0.0.0.0:5001',
          sessionToken: mockSessionToken,
          refreshToken: mockRefreshToken,
          expiresAt: mockExpiresAt
        };
      }

      const response = await axios.post<LoginResponse>(`${API_BASE_URL}/login`, {
        username,
        password
      });

      if (response.data.success && response.data.sessionToken && response.data.refreshToken && response.data.expiresAt) {
        this.currentUser = username;
        this.sessionToken = response.data.sessionToken;
        
        // Store session data
        this.storeSession({
          sessionToken: response.data.sessionToken,
          refreshToken: response.data.refreshToken,
          username,
          expiresAt: response.data.expiresAt,
          serverUrl: response.data.serverUrl
        });
      }

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('🚪 LOGOUT CALLED - Current user:', this.currentUser);
      console.trace('🔍 Logout call stack:'); // This will show us where logout was called from
      
      // Mock logout in development mode
      if (USE_MOCK_DATA) {
        console.log('🚧 Development Mode: Mock logout');
        this.currentUser = null;
        this.clearStoredSession();
        return;
      }

      if (this.currentUser) {
        const sessionToken = this.sessionToken;
        console.log('📡 Calling logout API with session token:', sessionToken ? sessionToken.substring(0, 20) + '...' : 'NONE');
        await axios.post(`${API_BASE_URL}/logout`, {
          username: this.currentUser
        }, {
          headers: sessionToken ? {
            'Authorization': `Bearer ${sessionToken}`
          } : {}
        });
      }
    } catch (error) {
      console.error('💥 Logout error:', error);
    } finally {
      console.log('🧹 Clearing local session data');
      this.currentUser = null;
      this.clearStoredSession();
    }
  }

  async manualLogout(): Promise<void> {
    // Manual logout - same as regular logout now (no credentials to clear)
    await this.logout();
  }

  getCurrentUser(): string | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    // In mock mode, always consider authenticated if we have a current user
    if (USE_MOCK_DATA) {
      return this.currentUser !== null;
    }
    return this.currentUser !== null && this.sessionToken !== null;
  }

  // Get session info (useful for debugging)
  getSessionInfo(): { username: string | null; timeRemaining: number | null } {
    try {
      const storedData = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (storedData && this.currentUser) {
        const sessionData: SessionData = JSON.parse(storedData);
        const now = new Date();
        const expiresAt = new Date(sessionData.expiresAt);
        const timeRemaining = expiresAt.getTime() - now.getTime();
        return {
          username: this.currentUser,
          timeRemaining: timeRemaining > 0 ? timeRemaining : 0
        };
      }
    } catch (error) {
      console.error('Error getting session info:', error);
    }
    return { username: this.currentUser, timeRemaining: null };
  }

  // Check if session is close to expiring (within 30 minutes)
  isSessionExpiringSoon(): boolean {
    const sessionInfo = this.getSessionInfo();
    if (sessionInfo.timeRemaining === null) return false;
    return sessionInfo.timeRemaining < (30 * 60 * 1000); // 30 minutes
  }
}

const authService = new AuthService();
export default authService; 