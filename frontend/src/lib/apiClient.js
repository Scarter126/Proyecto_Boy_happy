import axios from 'axios';
import Swal from 'sweetalert2';
import { getApiConfig } from '../stores/configStore';

// Normalizar baseURL para evitar dobles barras
const normalizeURL = (url) => url.replace(/\/+$/, '');

// Obtener configuración dinámica de API
const getBaseURL = () => {
  const apiConfig = getApiConfig();
  const baseURL = `${normalizeURL(apiConfig.baseURL)}/api`;
  console.log('[apiClient] baseURL configurado:', baseURL);
  return baseURL;
};

// Crear cliente axios
const apiClient = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const baseURL = getBaseURL();

    if (config.url && !config.url.startsWith('http')) {
      config.url = `${baseURL}${config.url}`;
      console.log('[apiClient] Request URL completa:', config.url);
    }

    // Agregar token solo para Galería (/images)
    if (config.url.includes('/images')) {
      let token = localStorage.getItem('idToken') || localStorage.getItem('token');

      if (!token) {
        try {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            const parsed = JSON.parse(authStorage);
            token = parsed.state?.token;
          }
        } catch (e) {
          console.warn('Error parseando auth-storage:', e);
        }
      }

      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      const authStorage = localStorage.getItem('auth-storage');
      const isMockToken = authStorage && JSON.parse(authStorage).state?.token?.startsWith('mock.');

      if (isMockToken) {
        console.warn('⚠️ [Dev] API 401 con mock user - El backend requiere autenticación real');
      } else {
        console.error('❌ No autenticado - Redirigiendo a login');
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('userData');
        localStorage.removeItem('token');
        localStorage.removeItem('idToken');
        document.cookie = 'idToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
        window.location.href = '/';
      }
    } else if (error.response?.status >= 500) {
      Swal.fire({
        icon: 'error',
        title: 'Error del servidor',
        text: error.response?.data?.message || 'Ha ocurrido un error. Por favor, inténtalo de nuevo.',
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
