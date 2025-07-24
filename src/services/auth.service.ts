import axios, { AxiosInstance } from 'axios';
import { LoginRequest, LoginResponse, UserInfo } from '../types/api.types';

const AUTH_API_URL = 'https://login.ezinfra.net/api';
let API_BASE_URL = 'https://srvprod.ezinfra.net/ezderm-webservice/rest';

class AuthService {
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor to include auth token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const token = await this.getValidToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Load stored tokens on initialization
    this.loadStoredTokens();
  }

  private loadStoredTokens() {
    const storedData = localStorage.getItem('authData');
    if (storedData) {
      const data = JSON.parse(storedData);
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.tokenExpiresAt = data.tokenExpiresAt;
      
      // Update base URL if available from stored data
      if (data.serverUrl) {
        API_BASE_URL = data.serverUrl + 'ezderm-webservice/rest/api';
        this.axiosInstance.defaults.baseURL = API_BASE_URL;
        console.log('Restored API base URL to:', API_BASE_URL);
      }
    }
  }

  private saveTokens(loginResponse: LoginResponse, userInfo?: UserInfo) {
    this.accessToken = loginResponse.accessToken;
    this.refreshToken = loginResponse.refreshToken;
    // Set token expiration to 10 minutes from now (default for JWT tokens)
    this.tokenExpiresAt = Date.now() + (10 * 60 * 1000);

    // Update API base URL from server response
    if (loginResponse.servers?.app) {
      API_BASE_URL = loginResponse.servers.app + 'ezderm-webservice/rest/api';
      this.axiosInstance.defaults.baseURL = API_BASE_URL;
      console.log('Updated API base URL to:', API_BASE_URL);
    }

    const authData = {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      tokenExpiresAt: this.tokenExpiresAt,
      userInfo: userInfo,
      serverUrl: loginResponse.servers?.app
    };

    localStorage.setItem('authData', JSON.stringify(authData));
  }

  async login(credentials: { username: string; password: string }): Promise<LoginResponse> {
    try {
      const loginRequest: LoginRequest = {
        username: credentials.username,
        password: credentials.password,
        application: 'EZDERM',
        timeZoneId: 'America/Detroit',
        clientVersion: '4.28.0'
      };

      const response = await axios.post<LoginResponse>(
        `${AUTH_API_URL}/login`,
        loginRequest,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      // For now, create mock user info since it's not in the login response
      // In a real implementation, you might need to fetch this from another endpoint
      const mockUserInfo: UserInfo = {
        id: 'user-id',
        username: credentials.username,
        firstName: 'User',
        lastName: 'Name',
        practiceId: 'practice-id',
        clinicIds: ['clinic-1', 'clinic-2']
      };

      this.saveTokens(response.data, mockUserInfo);
      console.log('Login successful');
      return response.data;
    } catch (error: any) {
      console.error('Login failed:', error);
      console.error('Login error details:', error.response?.data);
      throw error;
    }
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      // Note: This endpoint URL might need to be updated based on actual API documentation
      const response = await axios.post<{ accessToken: string }>(
        `${AUTH_API_URL}/refreshToken/getAccessToken`,
        { refreshToken: this.refreshToken },
                  {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
      );

      this.accessToken = response.data.accessToken;
      // Set token expiration to 10 minutes from now
      this.tokenExpiresAt = Date.now() + (10 * 60 * 1000);

      // Update stored data
      const storedData = localStorage.getItem('authData');
      if (storedData) {
        const data = JSON.parse(storedData);
        data.accessToken = this.accessToken;
        data.tokenExpiresAt = this.tokenExpiresAt;
        localStorage.setItem('authData', JSON.stringify(data));
      }

      return this.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.logout();
      throw error;
    }
  }

  async getValidToken(): Promise<string | null> {
    if (!this.accessToken || !this.tokenExpiresAt) {
      return null;
    }

    // Check if token is about to expire (5 minutes buffer)
    if (Date.now() >= this.tokenExpiresAt - (5 * 60 * 1000)) {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        return null;
      }
    }

    return this.accessToken;
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    localStorage.removeItem('authData');
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.tokenExpiresAt && Date.now() < this.tokenExpiresAt;
  }

  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  getUserInfo() {
    const storedData = localStorage.getItem('authData');
    if (storedData) {
      const data = JSON.parse(storedData);
      return data.userInfo;
    }
    return null;
  }
}

const authService = new AuthService();
export default authService; 