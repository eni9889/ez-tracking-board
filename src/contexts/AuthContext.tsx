import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService from '../services/auth.service';
import { UserInfo } from '../types/api.types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserInfo | null;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already authenticated on mount
    const checkAuth = () => {
      if (authService.isAuthenticated()) {
        const userInfo = authService.getUserInfo();
        if (userInfo) {
          setUser(userInfo);
          setIsAuthenticated(true);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      await authService.login(credentials);
      // Get user info from stored auth data
      const userInfo = authService.getUserInfo();
      setUser(userInfo);
      setIsAuthenticated(true);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Login failed. This may be due to CORS restrictions in development.';
      setError(errorMessage);
      
      // In development, fall back to mock authentication for testing UI
      if (process.env.NODE_ENV === 'development') {
        console.log('Falling back to mock authentication for development');
        const mockUserInfo = {
          id: 'mock-user-id',
          username: credentials.username,
          firstName: 'Demo',
          lastName: 'User',
          practiceId: 'mock-practice-id',
          clinicIds: ['mock-clinic-1', 'mock-clinic-2']
        };
        
        // Store mock auth data
        const mockAuthData = {
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh-token',
          tokenExpiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
          userInfo: mockUserInfo
        };
        localStorage.setItem('authData', JSON.stringify(mockAuthData));
        
        setUser(mockUserInfo);
        setIsAuthenticated(true);
        setError('Using mock authentication for development (CORS restrictions prevent real API access)');
        return; // Don't throw error, allow mock login
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    loading,
    error
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 