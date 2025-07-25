import axios from 'axios';
import { LoginResponse } from '../types/api.types';

const API_BASE_URL = 'http://localhost:5001/api';

// Development flag - matches the one in patientTracking.service.ts
const USE_MOCK_DATA = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

class AuthService {
  private currentUser: string | null = null;

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      // Mock login in development mode
      if (USE_MOCK_DATA) {
        console.log('🚧 Development Mode: Mock login successful');
        this.currentUser = username;
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