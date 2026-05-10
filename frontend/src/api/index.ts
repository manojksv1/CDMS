import axios, { type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import type { ApiError } from '../types/api';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
});

// ---------------------------------------------------------------------------
// Token refresh queue
// ---------------------------------------------------------------------------

interface QueueItem {
  resolve: () => void;
  reject: (err: unknown) => void;
}

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown): void {
  failedQueue.forEach((item) => {
    if (error) {
      item.reject(error);
    } else {
      item.resolve();
    }
  });
  failedQueue = [];
}

// ---------------------------------------------------------------------------
// Response interceptor
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const showNotification = useNotificationStore.getState().show;

    // Handle 401 — attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
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

    // Extract message from our standardised error shape
    const data = error.response?.data as ApiError | undefined;
    const message = data?.message ?? error.message ?? 'An unexpected error occurred';

    // Don't show notification for 401 on the refresh endpoint itself
    const isRefreshEndpoint = error.config?.url?.includes('/auth/refresh');
    if (!isRefreshEndpoint) {
      showNotification(message, 'error');
    }

    return Promise.reject(error);
  },
);

export default api;
