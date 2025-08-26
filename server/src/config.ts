import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
  dotenvConfig();
}

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  tls?: boolean;
}

interface EZDermConfig {
  serviceUser: string;
  servicePassword: string;
}

interface TailscaleConfig {
  enabled: boolean;
  tailnet: string;
  apiKey: string;
  bypassInDevelopment: boolean;
}

interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  ezderm: EZDermConfig;
  tailscale: TailscaleConfig;
}

// Parse secrets from AWS Secrets Manager
function parseDbSecret(secretString: string | undefined): DatabaseConfig {
  if (!secretString) {
    // Fallback to individual environment variables
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'vital_signs_tracking',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };
  }

  try {
    const secret = JSON.parse(secretString);
    return {
      host: secret.host,
      port: secret.port,
      database: secret.dbname,
      user: secret.username,
      password: secret.password,
    };
  } catch (error) {
    console.error('Failed to parse DB secret:', error);
    throw new Error('Invalid database secret format');
  }
}

function parseRedisSecret(secretString: string | undefined): RedisConfig {
  if (!secretString) {
    // Fallback to individual environment variables or defaults
    const config: RedisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      tls: process.env.REDIS_TLS === 'true',
    };
    if (process.env.REDIS_PASSWORD) {
      config.password = process.env.REDIS_PASSWORD;
    }
    return config;
  }

  try {
    const secret = JSON.parse(secretString);
    return {
      host: secret.host,
      port: secret.port,
      password: secret.auth_token,
      tls: secret.tls || false,
    };
  } catch (error) {
    console.error('Failed to parse Redis secret:', error);
    throw new Error('Invalid Redis secret format');
  }
}

// Create configuration object
export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  database: parseDbSecret(process.env.DB_SECRET),
  redis: parseRedisSecret(process.env.REDIS_SECRET),
  ezderm: {
    serviceUser: process.env.EZDERM_USER || '',
    servicePassword: process.env.EZDERM_PASS || '',
  },
  tailscale: {
    enabled: process.env.TAILSCALE_ENABLED === 'true',
    tailnet: process.env.TAILSCALE_TAILNET || '',
    apiKey: process.env.TAILSCALE_API_KEY || '',
    bypassInDevelopment: process.env.TAILSCALE_BYPASS_DEV !== 'false',
  },
};

// Log configuration (without sensitive data)
console.log('App Configuration:', {
  port: appConfig.port,
  nodeEnv: appConfig.nodeEnv,
  corsOrigin: appConfig.corsOrigin,
  database: {
    host: appConfig.database.host,
    port: appConfig.database.port,
    database: appConfig.database.database,
    user: appConfig.database.user,
  },
  redis: {
    host: appConfig.redis.host,
    port: appConfig.redis.port,
    tls: appConfig.redis.tls,
  },
  ezderm: {
    serviceUser: appConfig.ezderm.serviceUser ? '***configured***' : 'not set',
    servicePasswordConfigured: !!appConfig.ezderm.servicePassword,
  },
}); 