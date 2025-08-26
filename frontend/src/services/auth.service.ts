import axios from 'axios';
import { LoginResponse } from '../types/api.types';

const API_BASE_URL = 'http://localhost:5001/api';

// Development flag - matches the one in patientTracking.service.ts
const USE_MOCK_DATA = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

interface SessionData {
  sessionToken: string;
  username: string;
  expiresAt: string;
  serverUrl?: string;
}

interface CredentialData {
  username: string;
  password: string;
  rememberCredentials: boolean;
  lastLoginAt: string;
}

class AuthService {
  private currentUser: string | null = null;
  private sessionToken: string | null = null;
  private readonly SESSION_STORAGE_KEY = 'ez_tracking_session';
  private readonly CREDENTIALS_STORAGE_KEY = 'ez_tracking_credentials';
  private storedCredentials: CredentialData | null = null;

  private sessionRestorePromise: Promise<void>;

  constructor() {
    // Load stored credentials
    this.loadStoredCredentials();
    
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
          console.log('🚫 Session invalid on server, attempting auto-reauth...');
          await this.attemptAutoReauth();
        }
      } else {
        // Session expired, attempt auto-reauth
        console.log('⏰ Session expired locally, attempting auto-reauth...');
        await this.attemptAutoReauth();
      }
    } catch (error) {
      console.error('💥 Error restoring session:', error);
      await this.attemptAutoReauth();
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

  private loadStoredCredentials(): void {
    try {
      const storedData = localStorage.getItem(this.CREDENTIALS_STORAGE_KEY);
      if (storedData) {
        this.storedCredentials = JSON.parse(storedData);
        console.log('🔐 Loaded stored credentials for clinic dashboard');
      }
    } catch (error) {
      console.error('💥 Error loading stored credentials:', error);
      this.storedCredentials = null;
    }
  }

  private storeCredentials(username: string, password: string, rememberCredentials: boolean = true): void {
    if (rememberCredentials) {
      const credentialData: CredentialData = {
        username,
        password,
        rememberCredentials,
        lastLoginAt: new Date().toISOString()
      };
      
      try {
        localStorage.setItem(this.CREDENTIALS_STORAGE_KEY, JSON.stringify(credentialData));
        this.storedCredentials = credentialData;
        console.log('🔐 Credentials stored for always-on dashboard');
      } catch (error) {
        console.error('💥 Error storing credentials:', error);
      }
    }
  }

  private clearStoredCredentials(): void {
    localStorage.removeItem(this.CREDENTIALS_STORAGE_KEY);
    this.storedCredentials = null;
    console.log('🗑️ Cleared stored credentials');
  }

  async attemptAutoReauth(): Promise<boolean> {
    try {
      if (!this.storedCredentials) {
        console.log('❌ No stored credentials available for auto-reauth');
        this.clearStoredSession();
        return false;
      }

      console.log('🔄 Attempting automatic re-authentication for clinic dashboard...');
      console.log('📅 Last login was at:', this.storedCredentials.lastLoginAt);

      // Attempt to login with stored credentials
      const response = await this.login(
        this.storedCredentials.username, 
        this.storedCredentials.password
      );

      if (response.success) {
        console.log('✅ Auto-reauth successful - clinic dashboard stays online!');
        return true;
      } else {
        console.log('❌ Auto-reauth failed');
        this.clearStoredSession();
        return false;
      }
    } catch (error) {
      console.error('💥 Auto-reauth error:', error);
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
        const storedData = localStorage.getItem(this.SESSION_STORAGE_KEY);
        if (storedData) {
          const sessionData: SessionData = JSON.parse(storedData);
          // The validation call would have updated the last_accessed time on the server
          console.log('✅ Session refreshed successfully');
        }
      }
      
      return isValid;
    } catch (error) {
      console.error('💥 Session refresh failed:', error);
      return false;
    }
  }

  async login(username: string, password: string, rememberCredentials: boolean = true): Promise<LoginResponse> {
    try {
      // Mock login in development mode
      if (USE_MOCK_DATA) {
        console.log('🚧 Development Mode: Mock login successful');
        this.currentUser = username;
        
        // Create mock session
        const mockSessionToken = 'mock_session_' + Date.now();
        const mockExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours
        this.sessionToken = mockSessionToken;
        
        this.storeSession({
          sessionToken: mockSessionToken,
          username,
          expiresAt: mockExpiresAt,
          serverUrl: 'http://localhost:5001'
        });
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          success: true,
          username,
          serverUrl: 'http://localhost:5001',
          sessionToken: mockSessionToken,
          expiresAt: mockExpiresAt
        };
      }

      const response = await axios.post<LoginResponse>(`${API_BASE_URL}/login`, {
        username,
        password
      });

      if (response.data.success && response.data.sessionToken && response.data.expiresAt) {
        this.currentUser = username;
        this.sessionToken = response.data.sessionToken;
        
        // Store session data
        this.storeSession({
          sessionToken: response.data.sessionToken,
          username,
          expiresAt: response.data.expiresAt,
          serverUrl: response.data.serverUrl
        });

        // Store credentials for always-on dashboard
        this.storeCredentials(username, password, rememberCredentials);
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
      // Note: We keep stored credentials for always-on dashboard
      // Only clear them if it's a manual logout (not auto-reauth failure)
    }
  }

  async manualLogout(): Promise<void> {
    // Manual logout clears everything including stored credentials
    try {
      await this.logout();
    } finally {
      this.clearStoredCredentials();
      console.log('🏥 Manual logout - credentials cleared for clinic dashboard');
    }
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

export default new AuthService(); 