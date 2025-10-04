/**
 * ⭐ ALPINE STORES - Estado Global Reactivo
 * Sistema de stores usando Alpine.store()
 *
 * Uso:
 * <div x-data>
 *   <span x-text="$store.usuarios.data.length"></span>
 *   <button @click="$store.usuarios.fetch()">Cargar</button>
 * </div>
 */

document.addEventListener('alpine:init', () => {

  // ==========================================
  // 🔥 QUERY STORE - Para GET requests
  // ==========================================
  window.createQueryStore = (name, endpoint, options = {}) => {
    Alpine.store(name, {
      // Estado
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,

      // Config
      endpoint,
      cacheTime: options.cacheTime || 5 * 60 * 1000,
      staleTime: options.staleTime || 30 * 1000,

      // Métodos
      async fetch(params = {}) {
        this.loading = true;
        this.error = null;

        try {
          const queryString = new URLSearchParams(params).toString();
          const url = queryString ? `${endpoint}?${queryString}` : endpoint;

          const response = await window.apiClient.get(url);
          this.data = response.data || response;
          this.lastUpdated = Date.now();

          return this.data;
        } catch (error) {
          this.error = error.message;
          throw error;
        } finally {
          this.loading = false;
        }
      },

      async refetch() {
        return await this.fetch();
      },

      invalidate() {
        this.data = null;
        this.lastUpdated = null;
      },

      get isStale() {
        if (!this.lastUpdated) return true;
        return Date.now() - this.lastUpdated > this.staleTime;
      }
    });
  };

  // ==========================================
  // 🔥 MUTATION STORE - Para POST/PUT/DELETE
  // ==========================================
  window.createMutationStore = (name, mutationFn, options = {}) => {
    Alpine.store(name, {
      // Estado
      data: null,
      loading: false,
      error: null,
      isSuccess: false,

      // Config
      invalidateStores: options.invalidateStores || [],

      // Método
      async mutate(variables) {
        this.loading = true;
        this.error = null;
        this.isSuccess = false;

        try {
          const result = await mutationFn(variables);
          this.data = result;
          this.isSuccess = true;

          // Invalidar stores relacionados
          this.invalidateStores.forEach(storeName => {
            const store = Alpine.store(storeName);
            if (store && store.invalidate) {
              store.invalidate();
            }
          });

          // Mostrar notificación
          if (options.successMessage) {
            Notify.success(options.successMessage);
          }

          return result;
        } catch (error) {
          this.error = error.message;
          if (options.errorMessage) {
            Notify.error(options.errorMessage);
          }
          throw error;
        } finally {
          this.loading = false;
        }
      },

      reset() {
        this.data = null;
        this.error = null;
        this.isSuccess = false;
      }
    });
  };

  // ==========================================
  // 🔥 STORES PREDEFINIDOS - Domain Stores
  // ==========================================

  // Store de Usuarios
  createQueryStore('usuarios', '/usuarios');

  createMutationStore('createUsuario',
    (data) => window.apiClient.post('/usuarios', data),
    {
      invalidateStores: ['usuarios'],
      successMessage: '✅ Usuario creado'
    }
  );

  createMutationStore('updateUsuario',
    ({ rut, data }) => window.apiClient.put(`/usuarios?rut=${rut}`, data),
    {
      invalidateStores: ['usuarios'],
      successMessage: '✅ Usuario actualizado'
    }
  );

  createMutationStore('deleteUsuario',
    (rut) => window.apiClient.delete(`/usuarios?rut=${rut}`),
    {
      invalidateStores: ['usuarios'],
      successMessage: '✅ Usuario eliminado'
    }
  );

  // Store de Asistencia
  createQueryStore('asistencia', '/asistencia');

  createMutationStore('createAsistencia',
    (data) => window.apiClient.post('/asistencia', data),
    {
      invalidateStores: ['asistencia'],
      successMessage: '✅ Asistencia registrada'
    }
  );

  // Store de Materiales
  createQueryStore('materiales', '/materiales');

  createMutationStore('updateMaterial',
    ({ id, data }) => window.apiClient.put(`/materiales?id=${id}`, data),
    {
      invalidateStores: ['materiales'],
      successMessage: '✅ Material actualizado'
    }
  );

  // Store de Matrículas
  createQueryStore('matriculas', '/matriculas');

  // ==========================================
  // 🔥 AUTH STORE - Autenticación global
  // ==========================================
  Alpine.store('auth', {
    user: null,
    token: null,
    loading: false,

    async init() {
      // Cargar token y usuario del localStorage
      this.token = localStorage.getItem('idToken');
      const userData = localStorage.getItem('userData');

      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (e) {
          console.error('Error parseando userData');
        }
      }
    },

    get isAuthenticated() {
      return !!this.token && !!this.user;
    },

    get isAdmin() {
      return this.user?.rol === 'admin';
    },

    get isProfesor() {
      return this.user?.rol === 'profesor';
    },

    get isFono() {
      return this.user?.rol === 'fono';
    },

    async login(credentials) {
      this.loading = true;
      try {
        const response = await window.apiClient.post('/login', credentials);
        this.token = response.token;
        this.user = response.user;

        localStorage.setItem('idToken', this.token);
        localStorage.setItem('userData', JSON.stringify(this.user));

        return response;
      } catch (error) {
        Notify.error('Error al iniciar sesión');
        throw error;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.user = null;
      this.token = null;
      localStorage.clear();
      window.location.href = '/login';
    }
  });

  // ==========================================
  // 🔥 UI STORE - Estado de UI global
  // ==========================================
  Alpine.store('ui', {
    sidebarOpen: true,
    theme: 'light',
    notifications: [],

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },

    setTheme(theme) {
      this.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    },

    addNotification(message, type = 'info') {
      const id = Date.now();
      this.notifications.push({ id, message, type });

      // Auto-remover después de 5 segundos
      setTimeout(() => {
        this.removeNotification(id);
      }, 5000);
    },

    removeNotification(id) {
      this.notifications = this.notifications.filter(n => n.id !== id);
    }
  });

  // ==========================================
  // 🎨 UTILS STORE - Utilidades compartidas
  // ==========================================
  Alpine.store('utils', {
    // Paleta de colores para cursos
    cursoColors: [
      '#667eea', // Púrpura
      '#f093fb', // Rosa
      '#4facfe', // Azul cielo
      '#43e97b', // Verde
      '#fa709a', // Rosa-naranja
      '#feca57'  // Amarillo
    ],

    // Obtener color por índice de curso
    getCursoColor(index) {
      return this.cursoColors[index % this.cursoColors.length];
    },

    // Obtener color por código de curso
    getCursoColorByCode(codigo) {
      const cursos = [
        'medio-mayor',
        'prekinder-a',
        'prekinder-b',
        'kinder',
        'extension'
      ];
      const index = cursos.indexOf(codigo);
      return this.getCursoColor(index >= 0 ? index : 0);
    },

    // Formatear fecha
    formatDate(date, format = 'short') {
      if (!date) return '-';
      const d = new Date(date);

      if (format === 'short') {
        return d.toLocaleDateString('es-CL');
      } else if (format === 'long') {
        return d.toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } else if (format === 'time') {
        return d.toLocaleString('es-CL');
      }
      return d.toLocaleDateString('es-CL');
    },

    // Formatear RUT
    formatRut(rut) {
      if (!rut) return '-';
      // Formato: 12.345.678-9
      const clean = rut.replace(/[^0-9kK]/g, '');
      if (clean.length < 2) return rut;

      const dv = clean.slice(-1);
      const nums = clean.slice(0, -1);
      const formatted = nums.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

      return `${formatted}-${dv}`;
    },

    // Colores por estado
    getEstadoColor(estado) {
      const colores = {
        'pendiente': '#ffa726',
        'aprobado': '#66bb6a',
        'aprobada': '#66bb6a',
        'rechazado': '#ef5350',
        'rechazada': '#ef5350',
        'requiere_correccion': '#ff9800',
        'activo': '#4caf50',
        'inactivo': '#9e9e9e'
      };
      return colores[estado] || '#999';
    },

    // Texto por estado
    getEstadoTexto(estado) {
      const textos = {
        'pendiente': 'Pendiente',
        'aprobado': 'Aprobado',
        'aprobada': 'Aprobada',
        'rechazado': 'Rechazado',
        'rechazada': 'Rechazada',
        'requiere_correccion': 'Requiere Corrección',
        'activo': 'Activo',
        'inactivo': 'Inactivo'
      };
      return textos[estado] || estado;
    }
  });

});

console.log('✅ alpine-stores.js cargado');
