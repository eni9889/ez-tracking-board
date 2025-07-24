import axios from 'axios';
import { Encounter, EncountersRequest, EncountersResponse } from '../types/api.types';
import authService from './auth.service';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

class PatientTrackingService {
  async getEncounters(params?: Partial<EncountersRequest>): Promise<Encounter[]> {
    try {
      const username = authService.getCurrentUser();
      if (!username) {
        throw new Error('User not authenticated');
      }

      // Set default date range to today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const request: EncountersRequest = {
        username,
        dateRangeStart: params?.dateRangeStart || today.toISOString(),
        dateRangeEnd: params?.dateRangeEnd || tomorrow.toISOString(),
        clinicId: params?.clinicId,
        providerIds: params?.providerIds
      };

      const response = await axios.post<EncountersResponse>(
        `${API_BASE_URL}/encounters`,
        request
      );

      return response.data.encounters;
    } catch (error: any) {
      console.error('Failed to fetch encounters:', error);
      if (error.response?.status === 401) {
        // Session expired, redirect to login
        await authService.logout();
        window.location.href = '/login';
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
}

export default new PatientTrackingService(); 