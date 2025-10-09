/**
 * Sistema de Hooks estilo React Query
 * Para usar con Alpine.js
 *
 * Responsabilidad ÚNICA:
 * - Manejo de estados reactivos (data, loading, error)
 * - Integración con Alpine.reactive()
 * - Cache + invalidación
 *
 * NO maneja:
 * - Configuración HTTP (eso es de http-client.js)
 * - Definición de endpoints (eso es de api.js)
 */

const getApiClient = () => {
  if (!window.apiClient) {
    throw new Error('apiClient no disponible. Carga http-client.js primero.');
  }
  return window.apiClient;
};

const getQueryCache = () => {
  if (!window.queryCache) {
    throw new Error('queryCache no disponible. Carga http-client.js primero.');
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
 */
window.useQuery = function(queryKey, options = {}) {
  const {
    enabled = true,
    refetchOnMount = true,
    staleTime = 5 * 60 * 1000,
    cacheTime = 10 * 60 * 1000,
    onSuccess = null,
    onError = null,
    transform = null
  } = options;

  const getQueryKey = typeof queryKey === 'function' ? queryKey : () => queryKey;

  const state = typeof Alpine !== 'undefined' && Alpine.reactive ? Alpine.reactive({
    data: null,
    loading: false,
    error: null,
    isFetching: false,
    lastUpdated: null,

    async init() {
      // Intentar cargar desde cache
      const cached = getQueryCache().get(getQueryKey());
      if (cached) {
        this.data = cached;
        this.lastUpdated = Date.now();
      }

      // Fetch si está habilitado y necesario
      if (enabled && (!cached || (refetchOnMount && this.isStale))) {
        await this.fetch();
      }

      // Suscribirse a invalidaciones
      this.unsubscribe = getQueryCache().subscribe(getQueryKey(), (data) => {
        if (data === null) {
          this.fetch();
        } else {
          this.data = data;
          this.lastUpdated = Date.now();
        }
      });
    },

    async fetch(force = false) {
      if (!force && this.data && !this.isStale) {
        console.log(`📦 [Cache] ${getQueryKey()}`);
        return this.data;
      }

      this.loading = true;
      this.isFetching = true;
      this.error = null;

      try {
        const url = getQueryKey();
        console.log(`🌐 [Fetch] ${url}`);
        const response = await getApiClient().get(url);

        this.data = transform ? transform(response) : response;
        this.lastUpdated = Date.now();

        getQueryCache().set(url, this.data, cacheTime);

        if (onSuccess) onSuccess(this.data);

        return this.data;

      } catch (error) {
        this.error = error;

        if (onError) {
          onError(error);
        } else if (window.Notify) {
          Notify.error(error.message || 'Error al cargar datos');
        }

        throw error;

      } finally {
        this.loading = false;
        this.isFetching = false;
      }
    },

    async refetch() {
      return await this.fetch(true);
    },

    invalidate() {
      getQueryCache().invalidate(getQueryKey());
    },

    get isStale() {
      if (!this.lastUpdated) return true;
      return Date.now() - this.lastUpdated > staleTime;
    },

    destroy() {
      if (this.unsubscribe) this.unsubscribe();
    }
  }) : {
    data: null,
    loading: false,
    error: null,
    async init() {},
    async fetch() {},
    async refetch() {},
    invalidate() {},
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
 */
window.useMutation = function(mutationFn, options = {}) {
  const {
    onSuccess = null,
    onError = null,
    onSettled = null,
    invalidateQueries = [],
    showSuccessNotification = true,
    showErrorNotification = true,
    successMessage = 'Operación exitosa',
    errorMessage = null
  } = options;

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

        if (onSuccess) await onSuccess(result, variables);

        if (showSuccessNotification && window.Notify) {
          Notify.success(successMessage);
        }

        return result;

      } catch (error) {
        this.error = error;
        this.isError = true;

        if (onError) await onError(error, variables);

        if (showErrorNotification && window.Notify) {
          const msg = errorMessage || error.message || 'Error en la operación';
          Notify.error(msg);
        }

        throw error;

      } finally {
        this.loading = false;
        if (onSettled) await onSettled(this.data, this.error, variables);
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
    data: null,
    loading: false,
    error: null,
    async mutate() {},
    reset() {}
  };

  return state;
};

// ==========================================
// usePaginatedQuery - Para paginación
// ==========================================

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

        this.data = result.data || result.items || result;
        this.totalItems = result.total || this.data.length;
        this.totalPages = Math.ceil(this.totalItems / pageSize);
        this.hasMore = this.currentPage < this.totalPages;

        if (onSuccess) onSuccess(result);

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
        this.data = [...this.data, ...newData];
        this.hasMore = newData.length === pageSize;

        if (onSuccess) onSuccess(result);

      } catch (error) {
        this.error = error;
        if (window.Notify) Notify.error(error.message);

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
// Helpers
// ==========================================

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

window.createQueryKey = function(base, params = {}) {
  return base + buildQueryString(params);
};

// ==========================================
// Query Client Global
// ==========================================

window.QueryClient = {
  invalidateQueries(pattern) {
    if (typeof pattern === 'string') {
      getQueryCache().invalidate(pattern);
    } else if (pattern instanceof RegExp) {
      getQueryCache().cache.forEach((_, key) => {
        if (pattern.test(key)) {
          getQueryCache().invalidate(key);
        }
      });
    } else if (Array.isArray(pattern)) {
      pattern.forEach(key => getQueryCache().invalidate(key));
    }
  },

  invalidateAll() {
    getQueryCache().invalidateAll();
  },

  setQueryData(key, data) {
    getQueryCache().set(key, data);
  },

  getQueryData(key) {
    return getQueryCache().get(key);
  }
};

console.log('✅ http-client-hooks.js cargado');
