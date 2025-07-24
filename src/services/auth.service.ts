import axios from 'axios';
import { LoginRequest, LoginResponse } from '../types/api.types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

class AuthService {
  private currentUser: string | null = null;

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(`${API_BASE_URL}/login`, {
        username,
        password
      });

      if (response.data.success) {
        this.currentUser = username;
        localStorage.setItem('currentUser', username);
      }

      return response.data;
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  async logout(): Promise<void> {
    try {
      const username = this.getCurrentUser();
      if (username) {
        await axios.post(`${API_BASE_URL}/logout`, { username });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.currentUser = null;
      localStorage.removeItem('currentUser');
    }
  }

  getCurrentUser(): string | null {
    if (!this.currentUser) {
      this.currentUser = localStorage.getItem('currentUser');
    }
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }
}

export default new AuthService(); 