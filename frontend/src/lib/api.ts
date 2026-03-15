import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('phoenix_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    config.headers['X-Request-ID'] = crypto.randomUUID();
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      if (!window.location.pathname.startsWith('/login')) {
        localStorage.removeItem('phoenix_token');
        localStorage.removeItem('phoenix_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
