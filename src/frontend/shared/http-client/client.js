/**
 * Cliente HTTP Centralizado
 * Inspirado en Axios
 *
 * Responsabilidad ÚNICA:
 * - Ejecutar peticiones HTTP
 * - Interceptores request/response/error
 * - Headers globales + auth
 * - Timeout + AbortController
 */

class HttpClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || (window.APP_CONFIG?.API_URL || '');
    this.timeout = config.timeout || 30000;
    this.headers = config.headers || {};

    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }

  addRequestInterceptor(fn) {
    this.requestInterceptors.push(fn);
  }

  addResponseInterceptor(fn) {
    this.responseInterceptors.push(fn);
  }

  addErrorInterceptor(fn) {
    this.errorInterceptors.push(fn);
  }

  async request(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    let config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
        ...options.headers
      },
      credentials: 'include',
      ...options
    };

    // Ejecutar interceptores de request
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config, fullUrl);
    }

    try {
      // Timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      config.signal = controller.signal;

      // Fetch
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

  // Métodos convenientes
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
// INSTANCIA GLOBAL
// ==========================================

const apiClient = new HttpClient({
  baseURL: window.APP_CONFIG?.API_URL || ''
});

// Interceptor: Auth
apiClient.addRequestInterceptor((config, url) => {
  const token = localStorage.getItem('idToken') || localStorage.getItem('token');

  if (token && !document.cookie.includes('idToken')) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  return config;
});

// Interceptor: Logs en desarrollo
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
  if (error.status === 401) {
    console.error('❌ No autenticado - Redirigiendo a login');
    localStorage.clear();
    window.location.href = '/login';
  }

  console.error(`❌ ${config.method} ${error.message}`, error);
  return error;
});

// ==========================================
// CACHE SIMPLE
// ==========================================

class QueryCache {
  constructor() {
    this.cache = new Map();
    this.listeners = new Map();
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key, data, ttl = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      expiresAt: ttl ? Date.now() + ttl : null
    });

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

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

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

console.log('✅ http-client.js cargado');