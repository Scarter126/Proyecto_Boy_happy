/**
 * Sistema de Hooks estilo React Query
 * Para usar con Alpine.js
 *
 * Incluye:
 * - useQuery: Para GET requests con cache
 * - useMutation: Para POST/PUT/DELETE con estados
 * - useInfiniteQuery: Para paginación infinita
 *
 * Uso:
 * <div x-data="useQuery('/usuarios')">
 *   <template x-if="loading">Cargando...</template>
 *   <template x-if="error">Error: <span x-text="error.message"></span></template>
 *   <template x-if="data">
 *     <div x-text="data.length + ' usuarios'"></div>
 *   </template>
 * </div>
 */

// Helpers para acceder a dependencias globales (lazy loading)
const getApiClient = () => {
  if (!window.apiClient) {
    throw new Error('apiClient no está disponible. Asegúrate de cargar http-client.js primero.');
  }
  return window.apiClient;
};

const getQueryCache = () => {
  if (!window.queryCache) {
    throw new Error('queryCache no está disponible. Asegúrate de cargar http-client.js primero.');
  }
  return window.queryCache;
};

// ==========================================
// useQuery - Para consultas GET con cache
// ==========================================

/**
 * Hook para consultas (GET) con cache automático
 *
 * @param {string|Function} queryKey - Clave única o función que retorna la URL
 * @param {Object} options - Opciones de configuración
 * @returns {Object} - Estado reactivo { data, loading, error, refetch, invalidate }
 *
 * Ejemplo:
 * x-data="useQuery('/usuarios', { enabled: true })"
 */
window.useQuery = function(queryKey, options = {}) {
  const {
    enabled = true,           // Si está habilitado por defecto
    refetchOnMount = true,    // Re-fetch al montar
    staleTime = 5 * 60 * 1000, // 5 minutos - tiempo antes de considerar datos obsoletos
    cacheTime = 10 * 60 * 1000, // 10 minutos - tiempo en cache
    retry = 1,                // Número de reintentos
    retryDelay = 1000,        // Delay entre reintentos
    onSuccess = null,         // Callback al tener éxito
    onError = null,           // Callback en error
    transform = null          // Transformar datos antes de guardar
  } = options;

  // Normalizar queryKey (puede ser string o función)
  const getQueryKey = typeof queryKey === 'function' ? queryKey : () => queryKey;

  // ✅ USAR Alpine.reactive() para que Alpine detecte cambios
  const state = typeof Alpine !== 'undefined' && Alpine.reactive ? Alpine.reactive({
    data: null,
    loading: false,
    error: null,
    isFetching: false,
    lastUpdated: null,

    async init() {
      if (enabled && refetchOnMount) {
        await this.fetch();
      } else {
        // Intentar cargar desde cache
        const cached = getQueryCache().get(getQueryKey());
        if (cached) {
          this.data = cached;
          this.lastUpdated = Date.now();
        }
      }

      // Suscribirse a cambios en cache (para invalidaciones)
      this.unsubscribe = getQueryCache().subscribe(getQueryKey(), (data) => {
        if (data === null) {
          // Cache invalidado - refetch
          this.fetch();
        } else {
          this.data = data;
          this.lastUpdated = Date.now();
        }
      });
    },

    async fetch(retryCount = 0) {
      this.loading = true;
      this.isFetching = true;
      this.error = null;

      try {
        const url = getQueryKey();
        const response = await getApiClient().get(url);

        // Transformar datos si hay función transform
        this.data = transform ? transform(response) : response;
        this.lastUpdated = Date.now();

        // Guardar en cache
        getQueryCache().set(url, this.data, cacheTime);

        // Callback de éxito
        if (onSuccess) {
          onSuccess(this.data);
        }

        return this.data;

      } catch (error) {
        this.error = error;

        // Reintentar si es necesario
        if (retryCount < retry) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return this.fetch(retryCount + 1);
        }

        // Callback de error
        if (onError) {
          onError(error);
        } else {
          // Mostrar notificación por defecto
          if (window.Notify) {
            Notify.error(error.message || 'Error al cargar datos');
          }
        }

        throw error;

      } finally {
        this.loading = false;
        this.isFetching = false;
      }
    },

    async refetch() {
      return await this.fetch();
    },

    invalidate() {
      getQueryCache().invalidate(getQueryKey());
    },

    // Verificar si los datos están obsoletos
    get isStale() {
      if (!this.lastUpdated) return true;
      return Date.now() - this.lastUpdated > staleTime;
    },

    // Limpieza al destruir componente
    destroy() {
      if (this.unsubscribe) {
        this.unsubscribe();
      }
    }
  }) : {
    // Fallback si Alpine no está disponible (no debería pasar)
    data: null,
    loading: false,
    error: null,
    isFetching: false,
    lastUpdated: null,
    async init() {},
    async fetch() {},
    async refetch() {},
    invalidate() {},
    get isStale() { return true; },
    destroy() {}
  };

  return state;
};

// ==========================================
// useMutation - Para POST/PUT/DELETE
// ==========================================

/**
 * Hook para mutaciones (POST, PUT, DELETE)
 *
 * @param {Function} mutationFn - Función que ejecuta la mutación
 * @param {Object} options - Opciones de configuración
 * @returns {Object} - Estado reactivo { mutate, loading, error, data, reset }
 *
 * Ejemplo:
 * x-data="useMutation((data) => apiClient.post('/usuarios', data))"
 */
window.useMutation = function(mutationFn, options = {}) {
  const {
    onSuccess = null,
    onError = null,
    onSettled = null,        // Se ejecuta siempre (success o error)
    invalidateQueries = [],  // Queries a invalidar después de mutar
    showSuccessNotification = true,
    showErrorNotification = true,
    successMessage = 'Operación exitosa',
    errorMessage = null
  } = options;

  // ✅ USAR Alpine.reactive() para que Alpine detecte cambios
  const state = typeof Alpine !== 'undefined' && Alpine.reactive ? Alpine.reactive({
    data: null,
    loading: false,
    error: null,
    isSuccess: false,
    isError: false,

    async mutate(variables) {
      this.loading = true;
      this.error = null;
      this.isSuccess = false;
      this.isError = false;

      try {
        const result = await mutationFn(variables);
        this.data = result;
        this.isSuccess = true;

        // Invalidar queries relacionadas
        if (invalidateQueries.length > 0) {
          invalidateQueries.forEach(key => {
            getQueryCache().invalidate(key);
          });
        }

        // Callback de éxito
        if (onSuccess) {
          await onSuccess(result, variables);
        }

        // Notificación de éxito
        if (showSuccessNotification && window.Notify) {
          Notify.success(successMessage);
        }

        return result;

      } catch (error) {
        this.error = error;
        this.isError = true;

        // Callback de error
        if (onError) {
          await onError(error, variables);
        }

        // Notificación de error
        if (showErrorNotification && window.Notify) {
          const msg = errorMessage || error.message || 'Error en la operación';
          Notify.error(msg);
        }

        throw error;

      } finally {
        this.loading = false;

        // Callback que siempre se ejecuta
        if (onSettled) {
          await onSettled(this.data, this.error, variables);
        }
      }
    },

    reset() {
      this.data = null;
      this.error = null;
      this.loading = false;
      this.isSuccess = false;
      this.isError = false;
    }
  }) : {
    // Fallback si Alpine no está disponible
    data: null,
    loading: false,
    error: null,
    isSuccess: false,
    isError: false,
    async mutate() {},
    reset() {}
  };

  return state;
};

// ==========================================
// usePaginatedQuery - Para paginación
// ==========================================

/**
 * Hook para queries paginadas
 *
 * @param {Function} queryFn - Función que recibe { page, limit } y retorna data
 * @param {Object} options - Opciones
 * @returns {Object} - Estado con paginación
 */
window.usePaginatedQuery = function(queryFn, options = {}) {
  const {
    initialPage = 1,
    pageSize = 10,
    onSuccess = null,
    onError = null
  } = options;

  return {
    data: [],
    loading: false,
    error: null,
    currentPage: initialPage,
    totalPages: 1,
    totalItems: 0,
    hasMore: false,

    async init() {
      await this.fetch();
    },

    async fetch() {
      this.loading = true;
      this.error = null;

      try {
        const result = await queryFn({
          page: this.currentPage,
          limit: pageSize
        });

        // Esperar formato { data, total } o { items, total }
        this.data = result.data || result.items || result;
        this.totalItems = result.total || this.data.length;
        this.totalPages = Math.ceil(this.totalItems / pageSize);
        this.hasMore = this.currentPage < this.totalPages;

        if (onSuccess) {
          onSuccess(result);
        }

      } catch (error) {
        this.error = error;

        if (onError) {
          onError(error);
        } else if (window.Notify) {
          Notify.error(error.message);
        }

      } finally {
        this.loading = false;
      }
    },

    async nextPage() {
      if (this.hasMore) {
        this.currentPage++;
        await this.fetch();
      }
    },

    async prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        await this.fetch();
      }
    },

    async goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
        await this.fetch();
      }
    },

    async refetch() {
      await this.fetch();
    }
  };
};

// ==========================================
// useInfiniteQuery - Para scroll infinito
// ==========================================

/**
 * Hook para queries con scroll infinito
 *
 * @param {Function} queryFn - Función que recibe { page } y retorna data
 * @param {Object} options - Opciones
 */
window.useInfiniteQuery = function(queryFn, options = {}) {
  const {
    initialPage = 1,
    pageSize = 10,
    onSuccess = null
  } = options;

  return {
    data: [],
    loading: false,
    error: null,
    currentPage: initialPage,
    hasMore: true,
    isFetchingMore: false,

    async init() {
      await this.fetch();
    },

    async fetch() {
      this.loading = true;
      this.error = null;

      try {
        const result = await queryFn({
          page: this.currentPage,
          limit: pageSize
        });

        const newData = result.data || result.items || result;

        // Agregar nuevos datos al array existente
        this.data = [...this.data, ...newData];

        // Verificar si hay más datos
        this.hasMore = newData.length === pageSize;

        if (onSuccess) {
          onSuccess(result);
        }

      } catch (error) {
        this.error = error;
        if (window.Notify) {
          Notify.error(error.message);
        }

      } finally {
        this.loading = false;
        this.isFetchingMore = false;
      }
    },

    async fetchMore() {
      if (this.hasMore && !this.isFetchingMore) {
        this.isFetchingMore = true;
        this.currentPage++;
        await this.fetch();
      }
    },

    reset() {
      this.data = [];
      this.currentPage = initialPage;
      this.hasMore = true;
    }
  };
};

// ==========================================
// Helpers para construcción de queries
// ==========================================

/**
 * Constructor de query strings
 */
window.buildQueryString = function(params) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.append(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};

/**
 * Helper para crear query keys dinámicos
 */
window.createQueryKey = function(base, params = {}) {
  return base + buildQueryString(params);
};

// ==========================================
// Gestor global de queries
// ==========================================

window.QueryClient = {
  /**
   * Invalidar múltiples queries por patrón
   */
  invalidateQueries(pattern) {
    if (typeof pattern === 'string') {
      getQueryCache().invalidate(pattern);
    } else if (pattern instanceof RegExp) {
      // Invalidar todas las queries que coincidan con el patrón
      getQueryCache().cache.forEach((_, key) => {
        if (pattern.test(key)) {
          getQueryCache().invalidate(key);
        }
      });
    } else if (Array.isArray(pattern)) {
      // Invalidar array de keys
      pattern.forEach(key => getQueryCache().invalidate(key));
    }
  },

  /**
   * Invalidar todo el cache
   */
  invalidateAll() {
    getQueryCache().invalidateAll();
  },

  /**
   * Pre-cargar datos en cache
   */
  setQueryData(key, data) {
    getQueryCache().set(key, data);
  },

  /**
   * Obtener datos del cache
   */
  getQueryData(key) {
    return getQueryCache().get(key);
  },

  /**
   * Refetch todas las queries activas
   */
  refetchQueries(pattern) {
    // TODO: Implementar si es necesario
    console.warn('refetchQueries aún no implementado');
  }
};

console.log('✅ Hooks (useQuery, useMutation) cargados correctamente');
console.log('✅ hooks.js cargado');
