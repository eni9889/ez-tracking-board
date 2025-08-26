import axios from 'axios';
import { Encounter, EncountersRequest, EncountersResponse } from '../types/api.types';
import authService from './auth.service';
import { mockEncounters } from './mockData';

const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : 'http://localhost:5001/api';

// Development flag - set to true to use mock data
const USE_MOCK_DATA = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_MOCK_DATA === 'true';

class PatientTrackingService {
  private async makeAPICallWithRetry<T>(apiCall: () => Promise<T>, maxRetries: number = 2): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        console.log(`🔄 API call failed (attempt ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt === maxRetries || error.response?.status !== 401) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    throw new Error('Max retries exceeded');
  }

  async getEncounters(params?: Partial<EncountersRequest>): Promise<Encounter[]> {
    try {
      // Return mock data in development mode if flag is set
      if (USE_MOCK_DATA) {
        console.log('🚧 Development Mode: Using mock data');
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        return mockEncounters;
      }

      // Wait for session restoration to complete
      await authService.waitForSessionRestore();

      const sessionToken = authService.getSessionToken();
      if (!sessionToken) {
        throw new Error('User not authenticated');
      }

      console.log('📡 Making encounters request with session token:', sessionToken.substring(0, 20) + '...');

      const request: EncountersRequest = {
        username: '', // No longer needed, but kept for type compatibility
        clinicId: params?.clinicId,
        providerIds: params?.providerIds
      };

      const response = await this.makeAPICallWithRetry(async () => {
        return await axios.post<EncountersResponse>(
          `${API_BASE_URL}/encounters`,
          request,
          {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          }
        );
      });

      console.log('✅ Encounters request successful, got', response.data.encounters.length, 'encounters');

      return response.data.encounters;
    } catch (error: any) {
      console.error('💥 Failed to fetch encounters:', error);
      console.error('📊 Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        url: error.config?.url
      });
      
      if (error.response?.status === 401) {
        console.log('🚨 Got 401 from encounters API - attempting auto-recovery...');
        
        // For clinic dashboard, try to auto-recover instead of immediate logout
        try {
          const reauthed = await authService.attemptAutoReauth();
          if (reauthed) {
            console.log('✅ Auto-recovery successful - clinic dashboard stays online');
            // Could retry the request here, but for now just let user retry manually
          } else {
            console.log('❌ Auto-recovery failed - manual intervention needed');
            // Only show error, don't force logout for clinic dashboard
            throw new Error('Authentication failed. Please refresh the page or check credentials.');
          }
        } catch (authError) {
          console.error('💥 Auto-recovery error:', authError);
          throw new Error('Unable to maintain connection. Please refresh the page.');
        }
      }
      throw new Error(error.response?.data?.error || 'Failed to fetch patient data');
    }
  }

  // Helper method to format patient status
  getStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      'SCHEDULED': '#757575',
      'CHECKED_IN': '#2196F3',
      'IN_ROOM': '#FF9800',
      'WITH_PROVIDER': '#4CAF50',
      'CHECKED_OUT': '#9C27B0'
    };
    return statusColors[status] || '#757575';
  }

  // Helper method to format appointment time
  formatAppointmentTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Helper method to get primary provider
  getPrimaryProvider(providers: any[]): string {
    const primaryProvider = providers.find(p => p.role === 'PROVIDER');
    if (primaryProvider) {
      return `${primaryProvider.name}${primaryProvider.title ? `, ${primaryProvider.title}` : ''}`;
    }
    return 'No provider assigned';
  }

  // Helper method to get all staff members
  getAllStaff(providers: any[]): string {
    if (!providers || providers.length === 0) {
      return 'No staff assigned';
    }

    // Sort by role priority: PROVIDER first, then others
    const roleOrder = ['PROVIDER', 'SECONDARY_PROVIDER', 'COSIGNING_PROVIDER', 'STAFF'];
    const sortedProviders = [...providers].sort((a, b) => {
      const aIndex = roleOrder.indexOf(a.role);
      const bIndex = roleOrder.indexOf(b.role);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    return sortedProviders.map(provider => {
      const roleLabel = this.formatRole(provider.role);
      const title = provider.title ? `, ${provider.title}` : '';
      return `${provider.name}${title} (${roleLabel})`;
    }).join('\n');
  }

  // Helper method to format role names
  formatRole(role: string): string {
    const roleMap: { [key: string]: string } = {
      'PROVIDER': 'Provider',
      'SECONDARY_PROVIDER': 'Secondary',
      'COSIGNING_PROVIDER': 'Cosigning',
      'STAFF': 'Staff'
    };
    return roleMap[role] || role;
  }

  // Helper method to calculate wait time
  calculateWaitTime(arrivalTime?: string): string {
    if (!arrivalTime) return 'N/A';
    
    const arrival = new Date(arrivalTime);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - arrival.getTime()) / 60000);
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  }

  // Helper method to check if patient has been waiting too long (more than 10 minutes)
  isWaitingTooLong(arrivalTime?: string): boolean {
    if (!arrivalTime) return false;
    
    const arrival = new Date(arrivalTime);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - arrival.getTime()) / 60000);
    
    return diffMinutes > 10;
  }


}

export default new PatientTrackingService(); 