import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? (window.location.port === '5000'
            ? window.location.origin
            : `http://${window.location.hostname}:5000`)
        : 'https://raktdoot-backend-g8fz.onrender.com')
    : 'https://raktdoot-backend-g8fz.onrender.com'
);
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
});

// Attach JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('delivery_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('delivery_token');
      localStorage.removeItem('delivery_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
