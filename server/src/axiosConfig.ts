import axios, { AxiosResponse } from 'axios';

// Configure axios to be less verbose
axios.defaults.timeout = 10000;

// Only log errors and important info, not all requests
if (process.env.NODE_ENV === 'development') {
  // Request interceptor - only log for debugging when needed
  axios.interceptors.request.use(
    (config) => {
      // Only log if DEBUG_AXIOS is enabled
      if (process.env.DEBUG_AXIOS === 'true') {
        console.log(`🌐 ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    },
    (error) => {
      console.error('❌ Request Error:', error.message);
      return Promise.reject(error);
    }
  );

  // Response interceptor - only log errors and important responses
  axios.interceptors.response.use(
    (response) => {
      // Only log if DEBUG_AXIOS is enabled
      if (process.env.DEBUG_AXIOS === 'true') {
        console.log(`✅ ${response.status} ${response.config.url}`);
      }
      return response;
    },
    (error) => {
      // Always log errors (but make them concise)
      const url = error.config?.url || 'unknown';
      const status = error.response?.status || 'network error';
      const message = error.response?.data?.message || error.message;
      
      console.error(`❌ HTTP Error [${status}] ${url}: ${message}`);
      return Promise.reject(error);
    }
  );
} else {
  // Production: Only log errors
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error(`API Error: ${error.response?.status || 'Network'} - ${error.config?.url}`);
      return Promise.reject(error);
    }
  );
}

export default axios;
export { AxiosResponse };
