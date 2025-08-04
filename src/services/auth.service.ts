import axios from 'axios';
import { LoginResponse } from '../types/api.types';

const API_BASE_URL = 'http://localhost:5001/api';

// Development flag - matches the one in patientTracking.service.ts
const USE_MOCK_DATA = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

interface StoredAuthData {
  username: string;
  loginTime: number;
  serverUrl?: string;
}

class AuthService {
  private currentUser: string | null = null;
  private readonly AUTH_STORAGE_KEY = 'ez_tracking_auth';
  private readonly SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

  constructor() {
    // Restore session from localStorage on service initialization
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      const storedData = localStorage.getItem(this.AUTH_STORAGE_KEY);
      if (storedData) {
        const authData: StoredAuthData = JSON.parse(storedData);
        const now = Date.now();
        
        // Check if session is still valid (within session duration)
        if (now - authData.loginTime < this.SESSION_DURATION) {
          this.currentUser = authData.username;
          console.log('🔄 Session restored for user:', authData.username);
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

  private storeSession(username: string, serverUrl?: string): void {
    try {
      const authData: StoredAuthData = {
        username,
        loginTime: Date.now(),
        serverUrl
      };
      localStorage.setItem(this.AUTH_STORAGE_KEY, JSON.stringify(authData));
      console.log('💾 Session stored for user:', username);
    } catch (error) {
      console.error('Error storing session:', error);
    }
  }

  private clearStoredSession(): void {
    try {
      localStorage.removeItem(this.AUTH_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing stored session:', error);
    }
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      // Mock login in development mode
      if (USE_MOCK_DATA) {
        console.log('🚧 Development Mode: Mock login successful');
        this.currentUser = username;
        this.storeSession(username, 'http://localhost:5001');
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          success: true,
          username,
          serverUrl: 'http://localhost:5001'
        };
      }

      const response = await axios.post<LoginResponse>(`${API_BASE_URL}/login`, {
        username,
        password
      });

      if (response.data.success) {
        this.currentUser = username;
        this.storeSession(username, response.data.serverUrl);
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
}

export default new AuthService(); 