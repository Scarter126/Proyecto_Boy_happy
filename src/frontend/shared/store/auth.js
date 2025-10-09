/**
 * Auth Store - Autenticación y Sesión
 *
 * Responsabilidad:
 * - Capa reactiva sobre las funciones de autenticación
 * - Usa AuthUtils (shared/auth/auth.js) para la lógica real
 * - Integración con Alpine.js para reactividad
 *
 * IMPORTANTE: Este store NO duplica lógica.
 * Todas las funciones de auth vienen de window.AuthUtils
 */

document.addEventListener('alpine:init', () => {
  Alpine.store('auth', {
    loading: false,
    _initialized: false,

    init() {
      // Verificar que AuthUtils esté disponible
      if (!window.AuthUtils) {
        console.error('AuthUtils no disponible. Asegúrate de cargar shared/auth/auth.js primero.');
        return;
      }
      this._initialized = true;
    },

    // ==========================================
    // GETTERS REACTIVOS (usan AuthUtils)
    // ==========================================

    get token() {
      return window.AuthUtils?.getSessionToken() || null;
    },

    get user() {
      return window.AuthUtils?.getUser() || null;
    },

    get isAuthenticated() {
      return window.AuthUtils?.isAuthenticated() || false;
    },

    get isAdmin() {
      return window.AuthUtils?.hasRole('admin') || false;
    },

    get isProfesor() {
      return window.AuthUtils?.hasRole('profesor') || false;
    },

    get isFono() {
      return window.AuthUtils?.hasRole('fono') || false;
    },

    get isAlumno() {
      return window.AuthUtils?.hasRole('alumno') || false;
    },

    get isApoderado() {
      return window.AuthUtils?.hasRole('apoderado') || false;
    },

    get isTokenExpired() {
      return window.AuthUtils?.isTokenExpired() || false;
    },

    // ==========================================
    // MÉTODOS (delegan a AuthUtils)
    // ==========================================

    hasRole(...roles) {
      if (!window.AuthUtils) return false;
      return roles.some(role => window.AuthUtils.hasRole(role));
    },

    logout() {
      if (window.AuthUtils) {
        window.AuthUtils.cerrarSesion();
      }
    },

    updateUser(userData) {
      if (window.AuthUtils) {
        window.AuthUtils.saveUserData(userData);
      }
    },

    requireAuth() {
      return window.AuthUtils?.requireAuth() || false;
    },

    // ==========================================
    // MÉTODO DE LOGIN (opcional si usas Cognito Hosted UI)
    // ==========================================

    /**
     * Login manual (si tienes un endpoint /login custom)
     * Si usas Cognito Hosted UI, este método no se usa
     */
    async login(credentials) {
      if (!window.apiClient) {
        console.error('apiClient no disponible');
        return;
      }

      this.loading = true;
      try {
        const response = await window.apiClient.post('/login', credentials);

        // Guardar token en cookie (como hace Cognito)
        if (response.token) {
          document.cookie = `idToken=${response.token}; path=/; secure; samesite=strict`;
        }

        // Guardar datos adicionales en localStorage
        if (response.user) {
          window.AuthUtils.saveUserData(response.user);
        }

        if (window.Notify) {
          Notify.success('Sesión iniciada correctamente');
        }

        return response;
      } catch (error) {
        if (window.Notify) {
          Notify.error('Error al iniciar sesión');
        }
        throw error;
      } finally {
        this.loading = false;
      }
    }
  });
});

console.log('✅ auth.js store cargado');
