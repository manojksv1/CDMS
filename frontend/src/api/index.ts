import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // Crucial for HttpOnly cookies
});

// Request Interceptor: No longer needs to add token from localStorage
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 by attempting to refresh token
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const showNotification = useNotificationStore.getState().show;
    
    // If error is 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    if (error.response) {
      const message = error.response.data?.detail || 'An unexpected error occurred';
      showNotification(message, 'error');
    } else {
      showNotification('Could not connect to the server', 'error');
    }
    
    return Promise.reject(error);
  }
);

export default api;
