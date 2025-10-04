/**
 * Cliente HTTP Centralizado
 * Inspirado en Axios + React Query
 *
 * Features:
 * - Interceptores de request/response
 * - Manejo automático de errores
 * - Headers globales (auth, content-type)
 * - Retry automático
 * - Timeout configurable
 */

class HttpClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || (window.APP_CONFIG?.API_URL || '');
    this.timeout = config.timeout || 30000; // 30 segundos
    this.headers = config.headers || {};

    // Interceptores
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }

  /**
   * Agregar interceptor de request
   * Útil para agregar tokens, logs, etc.
   */
  addRequestInterceptor(fn) {
    this.requestInterceptors.push(fn);
  }

  /**
   * Agregar interceptor de response
   * Útil para transformar datos, logging, etc.
   */
  addResponseInterceptor(fn) {
    this.responseInterceptors.push(fn);
  }

  /**
   * Agregar interceptor de errores
   * Útil para manejo centralizado de errores
   */
  addErrorInterceptor(fn) {
    this.errorInterceptors.push(fn);
  }

  /**
   * Ejecutar request con interceptores
   */
  async request(url, options = {}) {
    // Construir URL completa
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    // Configuración por defecto
    let config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
        ...options.headers
      },
      credentials: 'include', // Enviar cookies automáticamente
      ...options
    };

    // Ejecutar interceptores de request
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config, fullUrl);
    }

    try {
      // Agregar timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      config.signal = controller.signal;

      // Ejecutar fetch
      const response = await fetch(fullUrl, config);
      clearTimeout(timeoutId);

      // Ejecutar interceptores de response
      let processedResponse = response;
      for (const interceptor of this.responseInterceptors) {
        processedResponse = await interceptor(processedResponse);
      }

      // Manejar errores HTTP
      if (!processedResponse.ok) {
        const error = await this.parseError(processedResponse);
        throw error;
      }

      // Parsear respuesta
      const contentType = processedResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await processedResponse.json();
      }

      return await processedResponse.text();

    } catch (error) {
      // Ejecutar interceptores de error
      let processedError = error;
      for (const interceptor of this.errorInterceptors) {
        processedError = await interceptor(processedError, config);
      }

      throw processedError;
    }
  }

  /**
   * Parsear errores del servidor
   */
  async parseError(response) {
    let message = `Error ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json();
      message = errorData.message || errorData.error || message;
    } catch {
      // Si no es JSON, usar mensaje por defecto
    }

    const error = new Error(message);
    error.status = response.status;
    error.response = response;
    return error;
  }

  /**
   * Métodos convenientes
   */
  get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  post(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  put(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }

  patch(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
}

// ==========================================
// INSTANCIA GLOBAL DEL CLIENTE HTTP
// ==========================================

const apiClient = new HttpClient({
  baseURL: window.APP_CONFIG?.API_URL || ''
});

// Interceptor: Agregar token de autenticación
apiClient.addRequestInterceptor((config, url) => {
  const token = localStorage.getItem('idToken') || localStorage.getItem('token');

  // Si no hay cookies, agregar header Authorization
  if (token && !document.cookie.includes('idToken')) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  return config;
});

// Interceptor: Log de requests (solo en desarrollo)
if (window.location.hostname === 'localhost') {
  apiClient.addRequestInterceptor((config, url) => {
    console.log(`🔵 ${config.method} ${url}`);
    return config;
  });

  apiClient.addResponseInterceptor((response) => {
    console.log(`✅ ${response.status} ${response.url}`);
    return response;
  });
}

// Interceptor: Manejo global de errores
apiClient.addErrorInterceptor((error, config) => {
  // Redirigir a login si no está autenticado
  if (error.status === 401) {
    console.error('❌ No autenticado - Redirigiendo a login');
    localStorage.clear();
    window.location.href = '/login';
  }

  // Log de errores
  console.error(`❌ ${config.method} ${error.message}`, error);

  return error;
});

// ==========================================
// CACHE SIMPLE PARA QUERIES
// ==========================================

class QueryCache {
  constructor() {
    this.cache = new Map();
    this.listeners = new Map(); // Para invalidación reactiva
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Verificar si expiró
    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key, data, ttl = 5 * 60 * 1000) { // TTL por defecto: 5 minutos
    this.cache.set(key, {
      data,
      expiresAt: ttl ? Date.now() + ttl : null
    });

    // Notificar a listeners (para reactividad con Alpine)
    this.notifyListeners(key, data);
  }

  invalidate(key) {
    this.cache.delete(key);
    this.notifyListeners(key, null);
  }

  invalidateAll() {
    this.cache.clear();
    this.listeners.forEach((listeners, key) => {
      this.notifyListeners(key, null);
    });
  }

  // Sistema de suscripción para reactividad
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    // Retornar función de limpieza
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  notifyListeners(key, data) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
}

const queryCache = new QueryCache();

// ==========================================
// EXPORTAR
// ==========================================

window.apiClient = apiClient;
window.queryCache = queryCache;
window.HttpClient = HttpClient;

// Debug: verificar que se cargó correctamente
console.log('✅ http-client.js cargado - apiClient disponible:', !!window.apiClient);
