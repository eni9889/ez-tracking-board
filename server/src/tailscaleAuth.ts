import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

interface TailscaleAuthConfig {
  tailnet: string;          // Your tailnet name (e.g., "yourcompany.com" or "tail12345.ts.net")
  apiKey: string;           // Tailscale API key
  bypassInDevelopment?: boolean;
}

interface TailscaleDevice {
  id: string;
  name: string;
  user: string;
  tailnetLockKey?: string;
  addresses: string[];
  authorized: boolean;
  blocked: boolean;
  created: string;
  expires: string;
  hostname: string;
  isExternal: boolean;
  keyExpiryDisabled: boolean;
  lastSeen: string;
  machineKey: string;
  nodeKey: string;
  os: string;
  updateAvailable: boolean;
}

interface TailscaleUser {
  id: string;
  loginName: string;
  displayName: string;
  profilePicURL?: string;
  tailnetID: string;
  role: string;
  status: string;
  type: string;
  created: string;
  currentlyConnected: boolean;
  deviceCount: number;
  lastSeen: string;
}

class TailscaleAuthService {
  private config: TailscaleAuthConfig;
  private deviceCache = new Map<string, { device: TailscaleDevice; timestamp: number }>();
  private userCache = new Map<string, { user: TailscaleUser; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config: TailscaleAuthConfig) {
    this.config = config;
  }

  /**
   * Express middleware to verify Tailscale authentication
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Bypass in development if configured
        if (this.config.bypassInDevelopment && process.env.NODE_ENV === 'development') {
          console.log('🔓 Tailscale auth bypassed in development');
          return next();
        }

        // Get client IP
        const clientIP = this.getClientIP(req);
        console.log(`🔍 Checking Tailscale auth for IP: ${clientIP}`);

        // Check if IP is from Tailscale network
        const isAuthorized = await this.verifyTailscaleAccess(clientIP);

        if (isAuthorized) {
          console.log(`✅ Tailscale auth successful for IP: ${clientIP}`);
          return next();
        } else {
          console.log(`❌ Tailscale auth failed for IP: ${clientIP}`);
          return this.sendUnauthorizedResponse(res);
        }

      } catch (error) {
        console.error('🚨 Tailscale auth error:', error);
        
        // Fail securely - deny access on error
        return this.sendUnauthorizedResponse(res);
      }
    };
  }

  /**
   * Get client IP from request, considering proxies
   */
  private getClientIP(req: Request): string {
    const ip = (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      (req.socket as any)?.remoteAddress ||
      req.ip ||
      'unknown'
    );
    return ip.split(',')[0].trim();
  }

  /**
   * Verify if the client IP belongs to an authorized Tailscale device
   */
  private async verifyTailscaleAccess(clientIP: string): Promise<boolean> {
    try {
      // Check cache first
      const cached = this.deviceCache.get(clientIP);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.device.authorized && !cached.device.blocked;
      }

      // Fetch devices from Tailscale API
      const devices = await this.getTailscaleDevices();
      
      // Find device with matching IP
      const device = devices.find(d => 
        d.addresses.includes(clientIP) && 
        d.authorized && 
        !d.blocked
      );

      if (device) {
        // Cache the result
        this.deviceCache.set(clientIP, { device, timestamp: Date.now() });
        return true;
      }

      return false;

    } catch (error) {
      console.error('Error verifying Tailscale access:', error);
      return false;
    }
  }

  /**
   * Fetch all devices in the Tailnet
   */
  private async getTailscaleDevices(): Promise<TailscaleDevice[]> {
    const response = await axios.get(
      `https://api.tailscale.com/api/v2/tailnet/${this.config.tailnet}/devices`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        timeout: 10000,
      }
    );

    return response.data.devices || [];
  }

  /**
   * Get user information for a device
   */
  async getUserInfo(clientIP: string): Promise<TailscaleUser | null> {
    try {
      // Check cache first
      const cached = this.userCache.get(clientIP);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.user;
      }

      const devices = await this.getTailscaleDevices();
      const device = devices.find(d => d.addresses.includes(clientIP));
      
      if (!device) {
        return null;
      }

      // Fetch user details
      const response = await axios.get(
        `https://api.tailscale.com/api/v2/tailnet/${this.config.tailnet}/users`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: 10000,
        }
      );

      const users: TailscaleUser[] = response.data.users || [];
      const user = users.find(u => u.id === device.user);

      if (user) {
        // Cache the result
        this.userCache.set(clientIP, { user, timestamp: Date.now() });
        return user;
      }

      return null;

    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  /**
   * Send unauthorized response
   */
  private sendUnauthorizedResponse(res: Response) {
    res.status(403).json({
      error: 'Access Denied',
      message: 'This application is only accessible through our company VPN. Please connect to the VPN and try again.',
      code: 'TAILSCALE_AUTH_REQUIRED'
    });
  }

  /**
   * Health check endpoint that shows Tailscale status
   */
  async healthCheck(): Promise<{ 
    status: string; 
    tailnet: string; 
    deviceCount: number; 
    userCount: number; 
  }> {
    try {
      const devices = await this.getTailscaleDevices();
      const activeDevices = devices.filter(d => d.authorized && !d.blocked);
      
      const response = await axios.get(
        `https://api.tailscale.com/api/v2/tailnet/${this.config.tailnet}/users`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: 10000,
        }
      );

      const users = response.data.users || [];
      const activeUsers = users.filter((u: TailscaleUser) => u.currentlyConnected);

      return {
        status: 'healthy',
        tailnet: this.config.tailnet,
        deviceCount: activeDevices.length,
        userCount: activeUsers.length,
      };

    } catch (error) {
      console.error('Tailscale health check failed:', error);
      return {
        status: 'error',
        tailnet: this.config.tailnet,
        deviceCount: 0,
        userCount: 0,
      };
    }
  }
}

export { TailscaleAuthService, TailscaleAuthConfig };
