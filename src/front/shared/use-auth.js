/**
 * Hook de Autenticación
 * Maneja estado del usuario autenticado, rol, permisos
 *
 * Uso:
 * <div x-data="useAuth()" x-init="init()">
 *   <template x-if="isAuthenticated">
 *     <p>Bienvenido, <span x-text="user.nombre"></span></p>
 *     <p>Rol: <span x-text="user.rol"></span></p>
 *   </template>
 * </div>
 */

window.useAuth = function(options = {}) {
  return {
    user: null,
    loading: true,
    isAuthenticated: false,
    error: null,

    // Rol del usuario
    get rol() {
      return this.user?.rol || null;
    },

    // Verificadores de rol
    get isAdmin() {
      return this.rol === 'admin';
    },

    get isProfesor() {
      return this.rol === 'profesor';
    },

    get isFono() {
      return this.rol === 'fono';
    },

    get isAlumno() {
      return this.rol === 'alumno';
    },

    /**
     * Inicializar - cargar usuario desde localStorage/cookies
     */
    async init() {
      this.loading = true;

      try {
        // Verificar si hay token en localStorage
        const token = localStorage.getItem('idToken') || localStorage.getItem('token');

        if (!token && !document.cookie.includes('idToken')) {
          // No hay sesión
          this.isAuthenticated = false;
          this.user = null;
          return;
        }

        // Decodificar token JWT para obtener info del usuario
        const userData = this.parseJWT(token);

        if (userData) {
          this.user = {
            email: userData.email || userData['cognito:username'],
            nombre: userData.name || userData.email,
            rol: userData['custom:rol'] || 'alumno',
            rut: userData['custom:rut'] || null,
            sub: userData.sub
          };

          this.isAuthenticated = true;

          // Opcional: Validar token con el servidor
          if (options.validateOnServer) {
            await this.validateSession();
          }
        }

      } catch (error) {
        console.error('Error al inicializar auth:', error);
        this.error = error;
        this.logout();

      } finally {
        this.loading = false;
      }
    },

    /**
     * Parsear JWT token (sin verificar firma - solo para leer claims)
     */
    parseJWT(token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
      } catch (error) {
        console.error('Error parsing JWT:', error);
        return null;
      }
    },

    /**
     * Validar sesión con el servidor (opcional)
     */
    async validateSession() {
      try {
        const response = await apiClient.get('/auth/validate');
        return response.valid;
      } catch (error) {
        console.error('Sesión inválida:', error);
        this.logout();
        return false;
      }
    },

    /**
     * Login (redirigir a Cognito)
     */
    login() {
      const cognitoDomain = window.COGNITO_DOMAIN;
      const clientId = window.CLIENT_ID;
      const redirectUri = window.REDIRECT_URI || window.location.origin;

      const loginUrl = `https://${cognitoDomain}/login?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `scope=email+openid+phone&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}`;

      window.location.href = loginUrl;
    },

    /**
     * Logout
     */
    logout() {
      // Limpiar localStorage
      localStorage.removeItem('idToken');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('token');

      // Limpiar cookies
      document.cookie = 'idToken=; Max-Age=0; path=/';
      document.cookie = 'accessToken=; Max-Age=0; path=/';

      // Limpiar estado
      this.user = null;
      this.isAuthenticated = false;

      // Redirigir a home o login
      window.location.href = '/';
    },

    /**
     * Verificar permiso
     */
    can(permission) {
      if (!this.isAuthenticated) return false;

      const permissions = {
        // Admin tiene todos los permisos
        admin: ['*'],

        // Profesor
        profesor: [
          'ver_alumnos',
          'gestionar_notas',
          'gestionar_asistencia',
          'gestionar_materiales',
          'ver_calendario'
        ],

        // Fonoaudiólogo
        fono: [
          'ver_alumnos',
          'gestionar_agenda',
          'gestionar_evaluaciones',
          'gestionar_informes',
          'ver_calendario'
        ],

        // Alumno
        alumno: [
          'ver_notas',
          'ver_asistencia',
          'ver_materiales',
          'ver_calendario',
          'ver_anuncios'
        ]
      };

      const userPermissions = permissions[this.rol] || [];

      return userPermissions.includes('*') || userPermissions.includes(permission);
    },

    /**
     * Verificar si es el propio usuario
     */
    isOwner(rut) {
      return this.user?.rut === rut;
    },

    /**
     * Guard para rutas (redirigir si no tiene permiso)
     */
    requireAuth(redirectTo = '/') {
      if (!this.isAuthenticated) {
        window.location.href = redirectTo;
        return false;
      }
      return true;
    },

    /**
     * Guard para roles específicos
     */
    requireRole(roles, redirectTo = '/') {
      if (!this.isAuthenticated) {
        window.location.href = redirectTo;
        return false;
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(this.rol)) {
        window.location.href = redirectTo;
        return false;
      }

      return true;
    }
  };
};

/**
 * Hook simple para obtener el usuario actual
 */
window.useCurrentUser = function() {
  const auth = useAuth();

  return {
    ...auth,

    // Alias útiles
    get username() {
      return this.user?.nombre || this.user?.email;
    },

    get initials() {
      if (!this.user?.nombre) return '?';
      const names = this.user.nombre.split(' ');
      return names.map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
  };
};

console.log('✅ Hook de autenticación (useAuth) cargado');
