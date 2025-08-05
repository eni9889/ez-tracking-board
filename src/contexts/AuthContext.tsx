import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/auth.service';
import { AuthContextType, User } from '../types/api.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for session restoration to complete before checking auth status
    const initializeAuth = async () => {
      try {
        console.log('🔄 AuthContext: Waiting for session restoration...');
        await authService.waitForSessionRestore();
        
        const username = authService.getCurrentUser();
        console.log('🔍 AuthContext: Session restoration complete, current user:', username);
        
        if (username) {
          setUser({ username });
          console.log('✅ AuthContext: User authenticated');
        } else {
          console.log('❌ AuthContext: No authenticated user');
        }
      } catch (error) {
        console.error('💥 AuthContext: Error during session restoration:', error);
        setError('Failed to restore session');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await authService.login(username, password);
      setUser({ username });
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    error
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 