import axios from 'axios';

// Configure axios with the base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to handle authentication
api.interceptors.request.use(
  (config) => {
    // Add any auth tokens or common headers here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors here
    if (error.response?.status === 401) {
      // Handle unauthorized access
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Export the base URL for reference
export { API_BASE_URL };