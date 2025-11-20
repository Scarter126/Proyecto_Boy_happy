import axios from 'axios';
import Swal from 'sweetalert2';
import { getApiConfig } from '../stores/configStore';

// Obtener configuración dinámica de API
const apiConfig = getApiConfig();

// Normalizar baseURL para evitar dobles barras
const normalizeURL = (url) => {
  return url.replace(/\/+$/, ''); // Eliminar barras finales
};

const apiClient = axios.create({
  baseURL: `${normalizeURL(apiConfig.baseURL)}/api`,
  timeout: apiConfig.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Intentar obtener el token de múltiples fuentes
    let token = localStorage.getItem('idToken') || localStorage.getItem('token');

    // Si no hay token, intentar desde auth-storage (Zustand persist)
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

    // Enviar token en header Authorization si existe y no está en cookies
    if (token && !document.cookie.includes('idToken')) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Verificar si es un usuario mock (desarrollo)
      const authStorage = localStorage.getItem('auth-storage');
      const isMockToken = authStorage && JSON.parse(authStorage).state?.token?.startsWith('mock.');

      if (isMockToken) {
        // En modo desarrollo con mock user, solo loguear el error, no redirigir
        console.warn('⚠️ [Dev] API 401 con mock user - El backend requiere autenticación real');
      } else {
        // En producción o sin mock, limpiar sesión y redirigir
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
