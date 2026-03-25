import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
});

// Request Interceptor: Add the JWT token to headers if it exists
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const showNotification = useNotificationStore.getState().show;
    
    if (error.response) {
      if (error.response.status === 401) {
        // Clear token and redirect to login
        useAuthStore.getState().logout();
      } else {
        const message = error.response.data?.detail || 'An unexpected error occurred';
        showNotification(message, 'error');
      }
    } else {
      showNotification('Could not connect to the server', 'error');
    }
    
    return Promise.reject(error);
  }
);

export default api;
