/**
 * Config Store - Configuración de la Aplicación (Zustand)
 *
 * Responsabilidad:
 * - Configuración global de la app
 * - Feature flags (activar/desactivar funcionalidades)
 * - Constantes de configuración
 * - Parámetros del sistema
 * - Preferencias de usuario (persiste en localStorage)
 *
 * USAGE:
 * ```jsx
 * import useConfigStore from './configStore';
 *
 * function MyComponent() {
 *   const { isFeatureEnabled, toggleFeature, isDevelopment } = useConfigStore();
 *
 *   if (isFeatureEnabled('exportPDF')) {
 *     return <ExportButton />;
 *   }
 *
 *   if (isDevelopment()) {
 *     console.log('Running in dev mode');
 *   }
 * }
 * ```
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env } from '../config/env';

const useConfigStore = create(
  persist(
    (set, get) => ({
      // ==========================================
      // STATE
      // ==========================================

      // Información de la aplicación
      appName: 'Boy Happy',
      appVersion: '1.0.0',

      /** @type {'development'|'production'} Entorno actual */
      environment: env.NODE_ENV || 'production',

      // Features flags - Activar/desactivar funcionalidades
      features: {
        darkMode: true,
        exportExcel: true,
        exportPDF: true,
        notifications: true,
        chat: false,
        analytics: false,
        backups: true,
      },

      // Configuración de UI
      ui: {
        itemsPerPage: 10,
        defaultLanguage: 'es-CL',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        currency: 'CLP',
      },

      // Límites y restricciones
      limits: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFilesPerUpload: 5,
        sessionTimeout: 30 * 60 * 1000, // 30 minutos
        cacheTime: 5 * 60 * 1000, // 5 minutos
      },

      // Configuración de notificaciones
      notifications: {
        enabled: true,
        duration: 5000,
        position: 'top-right',
      },

      // Configuración de API
      api: {
        // Detectar baseURL automáticamente
        baseURL: (() => {
          const isLocalhost = typeof window !== 'undefined' &&
                             (window.location.hostname === 'localhost' ||
                              window.location.hostname === '127.0.0.1');

          // En localhost (desarrollo), usar rutas relativas para que el proxy funcione
          if (isLocalhost && typeof window !== 'undefined') {
            // Si estamos en el puerto del dev server (3005), usar vacío para activar el proxy
            if (window.location.port === '3005') {
              return '';
            }
            // Si estamos en otro puerto, usar el puerto actual
            const port = window.location.port || '3000';
            return `${window.location.protocol}//${window.location.hostname}:${port}`;
          }

          // PRODUCCIÓN: Usar API Gateway URL directamente
          // Si hay API_URL en .env (producción), usarla
          if (env.API_URL && env.API_URL !== '') {
            return env.API_URL;
          }

          // Fallback: NO usar window.location.origin en producción
          // porque el frontend está en S3 y el API está en API Gateway
          return '';
        })(),
      },

      // Timeouts configurables por entorno
      timeouts: {
        api: (env.NODE_ENV === 'development') ? 60000 : 30000, // 60s dev, 30s prod
        upload: 120000, // 2 minutos para uploads
        download: 180000, // 3 minutos para downloads
      },

      // Cache configuration
      cache: {
        enabled: false,
        ttl: (env.NODE_ENV === 'development') ? 60000 : 300000, // 1min dev, 5min prod
      },

      // ==========================================
      // METHODS - FEATURE FLAGS
      // ==========================================

      /**
       * Verifica si una feature está habilitada
       * @param {string} feature - Nombre de la feature
       * @returns {boolean}
       */
      isFeatureEnabled: (feature) => {
        const { features } = get();
        return features[feature] || false;
      },

      /**
       * Alterna una feature on/off
       * @param {string} feature - Nombre de la feature
       */
      toggleFeature: (feature) => {
        set((state) => {
          if (state.features.hasOwnProperty(feature)) {
            return {
              features: {
                ...state.features,
                [feature]: !state.features[feature],
              },
            };
          }
          return state;
        });
      },

      /**
       * Establece el estado de una feature
       * @param {string} feature - Nombre de la feature
       * @param {boolean} enabled - Estado de la feature
       */
      setFeature: (feature, enabled) => {
        set((state) => ({
          features: {
            ...state.features,
            [feature]: enabled,
          },
        }));
      },

      // ==========================================
      // METHODS - ENVIRONMENT
      // ==========================================

      /**
       * Verifica si está en modo desarrollo
       * @returns {boolean}
       */
      isDevelopment: () => {
        return get().environment === 'development';
      },

      /**
       * Verifica si está en modo producción
       * @returns {boolean}
       */
      isProduction: () => {
        return get().environment === 'production';
      },

      // ==========================================
      // METHODS - SETTINGS
      // ==========================================

      /**
       * Obtiene una configuración por key
       * Busca en ui, limits y notifications
       *
       * @param {string} key - Key de la configuración
       * @returns {any} Valor de la configuración o null
       */
      getSetting: (key) => {
        const { ui, limits, notifications } = get();
        return ui[key] || limits[key] || notifications[key] || null;
      },

      /**
       * Actualiza una configuración
       * @param {string} category - Categoría (ui, limits, notifications)
       * @param {string} key - Key de la configuración
       * @param {any} value - Nuevo valor
       */
      updateSetting: (category, key, value) => {
        set((state) => {
          if (state[category] && state[category].hasOwnProperty(key)) {
            return {
              [category]: {
                ...state[category],
                [key]: value,
              },
            };
          }
          return state;
        });
      },

      /**
       * Actualiza múltiples configuraciones de UI a la vez
       * @param {Object} settings - Objeto con las configuraciones a actualizar
       */
      updateUISettings: (settings) => {
        set((state) => ({
          ui: {
            ...state.ui,
            ...settings,
          },
        }));
      },

      /**
       * Actualiza múltiples límites a la vez
       * @param {Object} limits - Objeto con los límites a actualizar
       */
      updateLimits: (limits) => {
        set((state) => ({
          limits: {
            ...state.limits,
            ...limits,
          },
        }));
      },

      /**
       * Actualiza configuración de notificaciones
       * @param {Object} settings - Configuración de notificaciones
       */
      updateNotificationSettings: (settings) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            ...settings,
          },
        }));
      },

      // ==========================================
      // UTILITIES
      // ==========================================

      /**
       * Construye una URL completa de API
       * @param {string} endpoint - Endpoint sin /api (ej: '/usuarios' o 'usuarios')
       * @returns {string} URL completa
       *
       * @example
       * buildApiUrl('/usuarios') // => 'http://localhost:3000/api/usuarios'
       * buildApiUrl('usuarios') // => 'http://localhost:3000/api/usuarios'
       * buildApiUrl('/api/usuarios') // => 'http://localhost:3000/api/usuarios'
       */
      buildApiUrl: (endpoint) => {
        const { api } = get();

        // Asegurar que empiece con /
        if (!endpoint.startsWith('/')) {
          endpoint = '/' + endpoint;
        }

        // Si ya tiene /api, no agregarlo
        if (endpoint.startsWith('/api/')) {
          return `${api.baseURL}${endpoint}`;
        }

        // Agregar /api automáticamente si no lo tiene
        return `${api.baseURL}/api${endpoint}`;
      },

      /**
       * Obtiene la configuración de API
       * @returns {Object} Configuración de API
       */
      getApiConfig: () => {
        const { api, timeouts } = get();
        return {
          baseURL: api.baseURL,
          timeout: timeouts.api,
          uploadTimeout: timeouts.upload,
          downloadTimeout: timeouts.download,
        };
      },

      /**
       * Obtiene toda la configuración como objeto
       * @returns {Object} Objeto con toda la configuración
       */
      getAllConfig: () => {
        const state = get();
        return {
          appName: state.appName,
          appVersion: state.appVersion,
          environment: state.environment,
          features: { ...state.features },
          ui: { ...state.ui },
          limits: { ...state.limits },
          notifications: { ...state.notifications },
          api: { ...state.api },
          timeouts: { ...state.timeouts },
          cache: { ...state.cache },
        };
      },

      /**
       * Resetea la configuración a valores por defecto
       */
      reset: () => {
        set({
          features: {
            darkMode: true,
            exportExcel: true,
            exportPDF: true,
            notifications: true,
            chat: false,
            analytics: false,
            backups: true,
          },
          ui: {
            itemsPerPage: 10,
            defaultLanguage: 'es-CL',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '24h',
            currency: 'CLP',
          },
          limits: {
            maxFileSize: 10 * 1024 * 1024,
            maxFilesPerUpload: 5,
            sessionTimeout: 30 * 60 * 1000,
            cacheTime: 5 * 60 * 1000,
          },
          notifications: {
            enabled: true,
            duration: 5000,
            position: 'top-right',
          },
        });
      },
    }),
    {
      name: 'config-storage', // Nombre en localStorage
      // Persistir solo lo que tiene sentido persistir
      partialize: (state) => ({
        features: state.features,
        ui: state.ui,
        notifications: state.notifications,
        // NO persistir limits y environment (son constantes del sistema)
      }),
    }
  )
);

// ==========================================
// HELPERS - Funciones exportadas para uso directo
// ==========================================

/**
 * Obtiene el entorno actual sin necesidad de hook
 * @returns {'development'|'production'}
 */
export const getEnvironment = () => {
  return env.NODE_ENV || 'production';
};

/**
 * Verifica si está en desarrollo sin necesidad de hook
 * @returns {boolean}
 */
export const isDevelopment = () => {
  return getEnvironment() === 'development';
};

/**
 * Verifica si está en producción sin necesidad de hook
 * @returns {boolean}
 */
export const isProduction = () => {
  return getEnvironment() === 'production';
};

/**
 * Construye una URL de API sin necesidad de hook
 * @param {string} endpoint - Endpoint sin /api (ej: '/usuarios')
 * @returns {string} URL completa
 *
 * @example
 * buildApiUrl('/usuarios') // => 'http://localhost:3000/api/usuarios'
 */
export const buildApiUrl = (endpoint) => {
  // Detectar baseURL
  const isLocalhost = typeof window !== 'undefined' &&
                     (window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1');

  let baseURL = '';

  // Si hay VITE_API_URL en .env, usarla
  if (process.env.VITE_API_URL) {
    baseURL = process.env.VITE_API_URL;
  }
  // Si estamos en localhost, usar el puerto actual
  else if (isLocalhost && typeof window !== 'undefined') {
    const port = window.location.port || '3000';
    baseURL = `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  // En producción o dev remoto, usar el origen actual
  else if (typeof window !== 'undefined') {
    baseURL = window.location.origin;
  }

  // Asegurar que empiece con /
  if (!endpoint.startsWith('/')) {
    endpoint = '/' + endpoint;
  }

  // Si ya tiene /api, no agregarlo
  if (endpoint.startsWith('/api/')) {
    return `${baseURL}${endpoint}`;
  }

  // Agregar /api automáticamente si no lo tiene
  return `${baseURL}/api${endpoint}`;
};

/**
 * Obtiene la configuración de API sin necesidad de hook
 * @returns {Object} Configuración de API
 */
export const getApiConfig = () => {
  const isLocalhost = typeof window !== 'undefined' &&
                     (window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1');

  let baseURL = '';

  // En localhost (desarrollo), usar rutas relativas para que el proxy funcione
  if (isLocalhost && typeof window !== 'undefined') {
    // Si estamos en el puerto del dev server (3005), usar vacío para activar el proxy
    if (window.location.port === '3005') {
      baseURL = '';
    } else {
      // Si estamos en otro puerto, usar el puerto actual
      const port = window.location.port || '3000';
      baseURL = `${window.location.protocol}//${window.location.hostname}:${port}`;
    }
  } else if (env.API_URL && env.API_URL !== '') {
    // En producción o dev remoto, usar el API_URL del .env
    baseURL = env.API_URL;
    console.log('[ConfigStore] Using API_URL from env:', baseURL);
  } else {
    // CRÍTICO: NO usar window.location.origin como fallback
    // porque el frontend está en S3 y el backend en API Gateway
    console.warn('[ConfigStore] API_URL not found in env, baseURL will be empty');
    baseURL = '';
  }

  return {
    baseURL,
    timeout: (env.NODE_ENV === 'development') ? 60000 : 30000,
    uploadTimeout: 120000,
    downloadTimeout: 180000,
  };
};

export default useConfigStore;
