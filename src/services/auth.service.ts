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

class AuthService {
  private currentUser: string | null = null;
  private sessionToken: string | null = null;
  private readonly SESSION_STORAGE_KEY = 'ez_tracking_session';

  constructor() {
    // Restore session from localStorage on service initialization (async)
    this.restoreSession().catch(error => {
      console.error('Failed to restore session:', error);
    });
  }

  private async restoreSession(): Promise<void> {
    try {
      const storedData = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (storedData) {
        const sessionData: SessionData = JSON.parse(storedData);
        const now = new Date();
        const expiresAt = new Date(sessionData.expiresAt);
        
        // Check if session is still valid locally
        if (expiresAt > now) {
          // Validate session with server
          const isValidOnServer = await this.validateSessionWithServer(sessionData.sessionToken);
          
          if (isValidOnServer) {
            this.currentUser = sessionData.username;
            this.sessionToken = sessionData.sessionToken;
            console.log('🔄 Session restored and validated for user:', sessionData.username);
          } else {
            console.log('🚫 Session invalid on server, clearing stored data');
            this.clearStoredSession();
          }
        } else {
          // Session expired, clear stored data
          console.log('⏰ Session expired, clearing stored data');
          this.clearStoredSession();
        }
      }
    } catch (error) {
      console.error('Error restoring session:', error);
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

      const response = await axios.post(`${API_BASE_URL}/validate-session`, {}, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      return response.data.valid === true;
    } catch (error) {
      console.error('Session validation failed:', error);
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
        
        this.storeSession({
          sessionToken: response.data.sessionToken,
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
      // Mock logout in development mode
      if (USE_MOCK_DATA) {
        console.log('🚧 Development Mode: Mock logout');
        this.currentUser = null;
        this.clearStoredSession();
        return;
      }

      if (this.currentUser) {
        await axios.post(`${API_BASE_URL}/logout`, {
          username: this.currentUser
        });
      }
    } catch (error) {
      // Ignore logout errors
    } finally {
      this.currentUser = null;
      this.clearStoredSession();
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
    return this.currentUser !== null;
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