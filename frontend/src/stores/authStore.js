import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cognitoAuth } from '../services/cognitoAuth';
import apiClient from '../lib/apiClient';

const useAuthStore = create(
  persist(
    (set, get) => ({
  // State
  token: null,
  user: null,
  loading: false,
  isMockUser: false, // Flag para indicar si es un usuario mockeado

  // Init - called on app start
  init: async () => {
    // En modo desarrollo, intentar cargar usuario mockeado primero
    const isDev = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1';

    if (isDev) {
      const mockAuth = get().getDevMockAuth();
      if (mockAuth) {
        set({
          token: mockAuth.token,
          user: mockAuth.user,
          isMockUser: true
        });
        console.log('🔧 [AuthStore] Usando mock user:', mockAuth.user.name);
        return;
      }
    }

    // Helper para validar y restaurar token
    const restoreTokenIfValid = (token, source) => {
      const user = get().decodeToken(token);

      // CRÍTICO: Validar expiración ANTES de restaurar
      if (!user || !user.exp) {
        console.warn(`⚠️ [AuthStore] Token inválido desde ${source}`);
        return false;
      }

      const isExpired = Date.now() >= user.exp * 1000;

      if (isExpired) {
        console.warn(`⚠️ [AuthStore] Token expirado desde ${source} (exp: ${new Date(user.exp * 1000).toLocaleString()})`);
        return false; // No limpiar aquí, intentaremos refresh primero
      }

      // Token válido, restaurar
      set({ token, user, isMockUser: false });
      console.log(`✅ [AuthStore] Sesión restaurada desde ${source}:`, user.name || user.email);
      return true;
    };

    // Helper para intentar refrescar el token
    const tryRefreshToken = async () => {
      try {
        console.log('🔄 [AuthStore] Intentando refrescar token...');
        const result = await cognitoAuth.refreshToken();
        if (result.success && result.tokens.idToken) {
          const user = get().decodeToken(result.tokens.idToken);
          if (user && user.exp && Date.now() < user.exp * 1000) {
            set({ token: result.tokens.idToken, user, isMockUser: false });
            localStorage.setItem('idToken', result.tokens.idToken);
            console.log('✅ [AuthStore] Token refrescado exitosamente:', user.name || user.email);
            return true;
          }
        }
      } catch (error) {
        console.warn('⚠️ [AuthStore] No se pudo refrescar el token:', error.message || error);
      }
      return false;
    };

    // Helper para limpiar todos los tokens
    const clearAllTokens = () => {
      get().clearAuth();
      localStorage.removeItem('idToken');
      localStorage.removeItem('token');
      document.cookie = 'idToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
    };

    // Si no hay mock user, proceder con autenticación normal
    try {
      // 1. Intentar obtener token de Cognito session (esto usa refreshToken internamente)
      const cognitoUser = cognitoAuth.getCurrentUser();

      if (cognitoUser) {
        // Cognito maneja el refresh automáticamente en getSession
        const token = await cognitoAuth.getSessionToken();
        if (token && restoreTokenIfValid(token, 'Cognito')) {
          return;
        }

        // Si el token de Cognito expiró, intentar refresh explícito
        if (await tryRefreshToken()) {
          return;
        }
      }

      // 2. Fallback: intentar leer de localStorage
      const tokenFromStorage = localStorage.getItem('idToken') || localStorage.getItem('token');
      if (tokenFromStorage && restoreTokenIfValid(tokenFromStorage, 'localStorage')) {
        return;
      }

      // 3. Fallback: intentar leer de cookies
      const tokenFromCookie = get().getTokenFromCookie();
      if (tokenFromCookie && restoreTokenIfValid(tokenFromCookie, 'cookies')) {
        return;
      }

      // 4. Si hay usuario de Cognito pero tokens expirados, intentar refresh una última vez
      if (cognitoUser && await tryRefreshToken()) {
        return;
      }

      // No hay sesión válida, limpiar todo
      console.log('ℹ️ [AuthStore] No hay sesión activa');
      clearAllTokens();

    } catch (error) {
      console.error('❌ [AuthStore] Error al inicializar sesión:', error);
      clearAllTokens();
    }
  },

  // Obtener datos de autenticación mockeados desde devStore
  getDevMockAuth: () => {
    try {
      // Leer directamente de localStorage para evitar dependencia circular
      const devStorage = localStorage.getItem('dev-storage');
      if (!devStorage) return null;

      const { state } = JSON.parse(devStorage);
      const currentUserId = state?.currentUserId;

      if (!currentUserId || currentUserId === 'public') {
        return null;
      }

      // Mapear usuarios de desarrollo (debe coincidir con devStore.js)
      const devUsers = {
        admin: {
          email: 'admin@boyhappy.cl',
          name: 'Admin Principal',
          sub: 'dev-admin',
          rut: '12345678-9',
          'cognito:groups': ['admin'],
          'custom:rut': '12345678-9',
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        profesor: {
          email: 'profesor@boyhappy.cl',
          name: 'Prof. Juan Pérez',
          sub: 'dev-profesor',
          rut: '11111111-1',
          'cognito:groups': ['profesor'],
          'custom:rut': '11111111-1',
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        fono: {
          email: 'fono@boyhappy.cl',
          name: 'Fono. María González',
          sub: 'dev-fono',
          rut: '22222222-2',
          'cognito:groups': ['fono'],
          'custom:rut': '22222222-2',
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        apoderado: {
          email: 'apoderado@boyhappy.cl',
          name: 'Apoderado Ana Torres',
          sub: 'dev-apoderado',
          rut: '44444444-4',
          'cognito:groups': ['apoderado'],
          'custom:rut': '44444444-4',
          exp: Math.floor(Date.now() / 1000) + 3600
        }
      };

      const mockUser = devUsers[currentUserId];
      if (!mockUser) return null;

      const mockToken = `mock.${btoa(JSON.stringify(mockUser))}.dev`;

      return {
        token: mockToken,
        user: mockUser
      };
    } catch (error) {
      console.error('[AuthStore] Error getting dev mock auth:', error);
      return null;
    }
  },

  // Getters (computed)
  isAuthenticated: () => {
    const { token, isTokenExpired } = get();
    return !!token && !isTokenExpired();
  },

  isAdmin: () => get().hasRole('admin'),
  isProfesor: () => get().hasRole('profesor'),
  isFono: () => get().hasRole('fono'),
  isApoderado: () => get().hasRole('apoderado'),

  isTokenExpired: () => {
    const { user } = get();
    if (!user || !user.exp) return true;
    return Date.now() >= user.exp * 1000;
  },

  // Actions
  getTokenFromCookie: () => {
    const name = 'idToken=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    return null;
  },

  decodeToken: (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  },

  hasRole: (...roles) => {
    const { user } = get();
    if (!user || !user['cognito:groups']) {
      return false;
    }
    const userGroups = user['cognito:groups'];
    return roles.some(role => userGroups.includes(role));
  },

  logout: () => {
    // Clear cookie
    document.cookie = 'idToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';

    // Clear localStorage (solo auth, no todo para no afectar otras stores)
    localStorage.removeItem('auth-storage');
    localStorage.removeItem('userData');
    localStorage.removeItem('token');
    localStorage.removeItem('idToken');

    // Clear state
    set({ token: null, user: null });

    // Redirect to login
    window.location.href = '/';
  },

  updateUser: (userData) => {
    if (userData) {
      localStorage.setItem('userData', JSON.stringify(userData));
      set(state => ({ user: { ...state.user, ...userData } }));
    }
  },

  login: async (credentials) => {
    set({ loading: true });
    try {
      const data = await apiClient.post('/login', credentials);

      if (data.token) {
        document.cookie = `idToken=${data.token}; path=/; secure; samesite=strict`;
        const user = get().decodeToken(data.token);
        set({ token: data.token, user });
      }

      if (data.user) {
        get().updateUser(data.user);
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  // Método para establecer autenticación desde cognitoAuth service
  setAuth: (token, user) => {
    set({ token, user });
  },

  // Método para limpiar autenticación
  clearAuth: () => {
    set({ token: null, user: null });
  },

  // Redirección por rol después del login
  redirectByRole: () => {
    const { user } = get();
    if (!user || !user['cognito:groups']) {
      window.location.href = '/';
      return;
    }

    const groups = user['cognito:groups'];

    if (groups.includes('admin')) {
      window.location.href = '/admin';
    } else if (groups.includes('profesor')) {
      window.location.href = '/profesor';
    } else if (groups.includes('fono')) {
      window.location.href = '/fono';
    } else if (groups.includes('apoderado')) {
      window.location.href = '/apoderado';
    } else {
      window.location.href = '/';
    }
  },
}),
    {
      name: 'auth-storage', // Nombre en localStorage
      // Persistir solo token y user, no loading ni isMockUser
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      // CRÍTICO: Validar token al hidratar desde localStorage
      // NOTA: No limpiamos tokens expirados aquí, init() intentará refrescarlos
      onRehydrateStorage: () => (state) => {
        if (state && state.token && state.user) {
          // Validar expiración del token al cargar desde persist
          const isExpired = !state.user.exp || Date.now() >= state.user.exp * 1000;

          if (isExpired) {
            console.log('ℹ️ [AuthStore Persist] Token expirado detectado, init() intentará refrescar...');
            // NO limpiar aquí - init() intentará usar refreshToken de Cognito
          } else {
            console.log('✅ [AuthStore Persist] Token válido cargado:', state.user.name || state.user.email);
          }
        }
      }
    }
  )
);

export default useAuthStore;
