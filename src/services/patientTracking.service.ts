import { SchedulerData, SchedulerDataRequest, PracticeInfo, AppointmentType, EncounterFilterRequest, EncounterDetail } from '../types/api.types';
import authService from './auth.service';
import { format, startOfDay, endOfDay } from 'date-fns';

class PatientTrackingService {
  private axios = authService.getAxiosInstance();

  async getPracticeInfo(): Promise<PracticeInfo> {
    try {
      const userInfo = authService.getUserInfo();
      const response = await this.axios.get<PracticeInfo>('/practice/info', {
        params: { username: userInfo?.username }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch practice info:', error);
      throw error;
    }
  }

  async getSchedulerData(clinicId: string, date: Date = new Date()): Promise<SchedulerData[]> {
    try {
      const userInfo = authService.getUserInfo();
      if (!userInfo?.practiceId) {
        throw new Error('Practice ID not found');
      }

      const request: SchedulerDataRequest = {
        dateSelection: 'SPECIFY_RANGE',
        dateOfServiceRangeLow: format(startOfDay(date), "yyyy-MM-dd'T'HH:mm:ss"),
        dateOfServiceRangeHigh: format(endOfDay(date), "yyyy-MM-dd'T'HH:mm:ss"),
        clinicId: clinicId,
        practiceId: userInfo.practiceId,
        providerIds: [], // Empty array fetches all providers
        lightBean: false
      };

      const response = await this.axios.post<SchedulerData[]>(
        '/event/multipleUserSchedulerData',
        request
      );

      // Sort by appointment time
      return response.data.sort((a, b) => 
        new Date(a.dateOfService).getTime() - new Date(b.dateOfService).getTime()
      );
    } catch (error) {
      console.error('Failed to fetch scheduler data:', error);
      throw error;
    }
  }

  async getEncountersByFilter(clinicId: string, date: Date = new Date(), providerIds: string[] = []): Promise<EncounterDetail[]> {
    try {
      const userInfo = authService.getUserInfo();
      if (!userInfo?.practiceId) {
        throw new Error('Practice ID not found');
      }

      // Format dates to match the exact API format with timezone
      const formatWithTimezone = (date: Date, isEndOfDay: boolean = false) => {
        const targetDate = isEndOfDay ? endOfDay(date) : startOfDay(date);
        return format(targetDate, "yyyy-MM-dd'T'HH:mm:ssXXX");
      };

      const request: EncounterFilterRequest = {
        dateSelection: 'SPECIFY_RANGE',
        lightBean: true,
        dateOfServiceRangeLow: formatWithTimezone(date, false),
        dateOfServiceRangeHigh: formatWithTimezone(date, true),
        clinicId: clinicId,
        practiceId: userInfo.practiceId,
        providerIds: providerIds // Use provided provider IDs or empty array for all
      };

      const response = await this.axios.post<EncounterDetail[]>(
        '/encounter/getByFilter',
        request,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      // Sort by appointment time
      return response.data.sort((a, b) => 
        new Date(a.dateOfService).getTime() - new Date(b.dateOfService).getTime()
      );
    } catch (error) {
      console.error('Failed to fetch encounter data:', error);
      throw error;
    }
  }

  async getEnhancedSchedulerData(clinicId: string, date: Date = new Date()): Promise<SchedulerData[]> {
    try {
      // Get both scheduler data and encounters
      const [schedulerData, encounters] = await Promise.allSettled([
        this.getSchedulerData(clinicId, date),
        this.getEncountersByFilter(clinicId, date)
      ]);

      let appointments: SchedulerData[] = [];
      
      if (schedulerData.status === 'fulfilled') {
        appointments = schedulerData.value;
      } else {
        console.warn('Failed to fetch scheduler data:', schedulerData.reason);
      }

      if (encounters.status === 'fulfilled') {
        // Enhance appointments with encounter data
        appointments = appointments.map(appointment => {
          const encounter = encounters.value.find(enc => 
            enc.patientInfo.id === appointment.patientInfo.id &&
            new Date(enc.dateOfService).toDateString() === new Date(appointment.dateOfService).toDateString()
          );

          if (encounter) {
            return {
              ...appointment,
              checkInTime: encounter.dateOfArrival || appointment.checkInTime,
              chiefComplaint: encounter.chiefComplaintName || appointment.chiefComplaint,
              // Map encounter status to appointment status if more detailed
              status: this.mapEncounterStatusToAppointmentStatus(encounter.status, appointment.status)
            };
          }

          return appointment;
        });
      } else {
        console.warn('Failed to fetch encounter data:', encounters.reason);
      }

      return appointments;
    } catch (error) {
      console.error('Failed to fetch enhanced scheduler data:', error);
      throw error;
    }
  }

  private mapEncounterStatusToAppointmentStatus(encounterStatus: string, currentStatus: any): any {
    // Map encounter statuses to our appointment statuses
    switch (encounterStatus) {
      case 'SCHEDULED':
        return 'SCHEDULED';
      case 'CHECKED_IN':
        return 'CHECKED_IN';
      case 'IN_ROOM':
        return 'IN_ROOM';
      case 'WITH_PROVIDER':
        return 'WITH_PROVIDER';
      case 'COMPLETED':
        return 'CHECKED_OUT';
      default:
        return currentStatus; // Keep existing status if we can't map
    }
  }

  async updateAppointmentStatus(appointmentId: string, status: string): Promise<void> {
    try {
      await this.axios.put(`/appointment/${appointmentId}/status`, { status });
    } catch (error) {
      console.error('Failed to update appointment status:', error);
      throw error;
    }
  }

  async assignRoom(appointmentId: string, roomNumber: string): Promise<void> {
    try {
      await this.axios.put(`/appointment/${appointmentId}/room`, { roomNumber });
    } catch (error) {
      console.error('Failed to assign room:', error);
      throw error;
    }
  }

  async getProviders(clinicId: string): Promise<any[]> {
    try {
      const response = await this.axios.get(`/provider/getByClinic/${clinicId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      throw error;
    }
  }

  // Mock data generator for testing
  generateMockSchedulerData(count: number = 20): SchedulerData[] {
    const statuses = ['SCHEDULED', 'CHECKED_IN', 'IN_ROOM', 'WITH_PROVIDER', 'CHECKED_OUT'];
    const providers = [
      { id: '1', firstName: 'Dr. John', lastName: 'Smith', title: 'MD' },
      { id: '2', firstName: 'Dr. Sarah', lastName: 'Johnson', title: 'MD' },
      { id: '3', firstName: 'Dr. Michael', lastName: 'Williams', title: 'DO' }
    ];
    const rooms = ['101', '102', '103', '104', '105', '106'];
    const chiefComplaints = [
      'Annual skin check',
      'Rash consultation',
      'Acne follow-up',
      'Mole evaluation',
      'Psoriasis treatment',
      'Eczema management'
    ];

    const appointments: SchedulerData[] = [];
    const today = new Date();
    
    for (let i = 0; i < count; i++) {
      const hour = 8 + Math.floor(i * 0.5);
      const minute = (i % 2) * 30;
      const appointmentTime = new Date(today.setHours(hour, minute, 0, 0));
      const statusIndex = Math.min(Math.floor(i / 4), statuses.length - 1);
      const status = statuses[statusIndex] as any;
      const provider = providers[i % providers.length];

      appointments.push({
        id: `apt-${i + 1}`,
        dateModified: new Date().toISOString(),
        active: true,
        providerId: provider.id,
        clinicId: '1',
        dateOfService: appointmentTime.toISOString(),
        duration: 30,
        status: status,
        type: AppointmentType.OFFICE_VISIT,
        patientInfo: {
          id: `pat-${i + 1}`,
          firstName: ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana'][i % 6],
          lastName: ['Doe', 'Smith', 'Johnson', 'Brown', 'Davis', 'Wilson'][i % 6],
          dateOfBirth: '1980-01-01',
          mrn: `MRN${1000 + i}`,
          phone: '555-0100'
        },
        clinicInfo: {
          id: '1',
          name: 'Main Dermatology Clinic'
        },
        providerInfo: provider,
        roomNumber: status === 'IN_ROOM' || status === 'WITH_PROVIDER' ? rooms[i % rooms.length] : undefined,
        room: status === 'IN_ROOM' || status === 'WITH_PROVIDER' ? parseInt(rooms[i % rooms.length]) : 0,
        checkInTime: statusIndex >= 1 ? new Date(appointmentTime.getTime() - 10 * 60000).toISOString() : undefined,
        roomTime: statusIndex >= 2 ? new Date(appointmentTime.getTime() - 5 * 60000).toISOString() : undefined,
        providerTime: statusIndex >= 3 ? appointmentTime.toISOString() : undefined,
        checkOutTime: statusIndex >= 4 ? new Date(appointmentTime.getTime() + 20 * 60000).toISOString() : undefined,
        chiefComplaint: chiefComplaints[i % chiefComplaints.length]
      });
    }

    return appointments;
  }
}

const patientTrackingService = new PatientTrackingService();
export default patientTrackingService; 