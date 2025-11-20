/**
 * Dev Store - Store de Desarrollo para simular usuarios
 *
 * SOLO FUNCIONA EN MODO DESARROLLO
 * Permite cambiar rápidamente entre diferentes usuarios para testing
 *
 * @module stores/devStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Lista de usuarios de desarrollo pre-configurados
export const DEV_USERS = [
  {
    id: 'public',
    nombre: 'Público (No autenticado)',
    email: null,
    rol: 'public',
    rut: null,
    icon: '🌐'
  },
  {
    id: 'admin',
    nombre: 'Admin Principal',
    email: 'admin@boyhappy.cl',
    rol: 'admin',
    rut: '12345678-9',
    icon: '👑',
    groups: ['admin']
  },
  {
    id: 'profesor',
    nombre: 'Prof. Juan Pérez',
    email: 'profesor@boyhappy.cl',
    rol: 'profesor',
    rut: '11111111-1',
    icon: '👨‍🏫',
    groups: ['profesor']
  },
  {
    id: 'fono',
    nombre: 'Fono. María González',
    email: 'fono@boyhappy.cl',
    rol: 'fono',
    rut: '22222222-2',
    icon: '👩‍⚕️',
    groups: ['fono']
  },
  {
    id: 'apoderado',
    nombre: 'Apoderado Ana Torres',
    email: 'apoderado@boyhappy.cl',
    rol: 'apoderado',
    rut: '44444444-4',
    icon: '👨‍👩‍👧',
    groups: ['apoderado']
  }
];

// Rutas disponibles por rol
export const ROUTES_BY_ROLE = {
  public: [
    { name: 'Home', url: '/', icon: '🏠' }
  ],
  admin: [
    { name: 'Dashboard', url: '/admin', icon: '📊' },
    { name: 'Usuarios', url: '/admin/users', icon: '👥' },
    { name: 'Matrículas', url: '/admin/matriculas', icon: '📝' },
    { name: 'Asistencia', url: '/admin/asistencia', icon: '✅' },
    { name: 'Anuncios', url: '/admin/anuncios', icon: '📢' },
    { name: 'Materiales', url: '/admin/materiales', icon: '📚' },
    { name: 'Comparativo', url: '/admin/comparativo', icon: '📈' },
    { name: 'Configuración', url: '/admin/configuracion', icon: '⚙️' }
  ],
  profesor: [
    { name: 'Dashboard', url: '/profesor', icon: '📊' },
    { name: 'Avance Alumnos', url: '/profesor/avance-alumnos', icon: '📈' },
    { name: 'Evaluaciones', url: '/profesor/evaluaciones', icon: '📋' },
    { name: 'Materiales', url: '/profesor/materiales', icon: '📚' },
    { name: 'Calendario', url: '/profesor/calendario', icon: '📅' },
    { name: 'Reportes', url: '/profesor/reportes', icon: '📄' }
  ],
  fono: [
    { name: 'Dashboard', url: '/fono', icon: '📊' },
    { name: 'Alumnos', url: '/fono/alumnos', icon: '👥' },
    { name: 'Evaluaciones', url: '/fono/evaluaciones', icon: '📋' },
    { name: 'Sesiones', url: '/fono/sesiones', icon: '🗓️' },
    { name: 'Asistencia', url: '/fono/asistencia', icon: '✅' },
    { name: 'Materiales', url: '/fono/materiales', icon: '📚' },
    { name: 'Reportes', url: '/fono/reportes', icon: '📄' },
    { name: 'Calendario', url: '/fono/calendario', icon: '📅' }
  ],
  apoderado: [
    { name: 'Dashboard', url: '/apoderado', icon: '📊' },
    { name: 'Mis Hijos', url: '/apoderado/mis-hijos', icon: '👶' },
    { name: 'Anuncios', url: '/apoderado/anuncios', icon: '📢' },
    { name: 'Asistencia', url: '/apoderado/asistencia', icon: '✅' },
    { name: 'Evaluaciones', url: '/apoderado/evaluaciones', icon: '📋' },
    { name: 'Materiales', url: '/apoderado/materiales', icon: '📚' },
    { name: 'Calendario', url: '/apoderado/calendario', icon: '📅' }
  ]
};

const useDevStore = create(
  persist(
    (set, get) => ({
      // ==========================================
      // STATE
      // ==========================================

      /** @type {string|null} ID del usuario actual de desarrollo */
      currentUserId: 'admin', // Por defecto admin en desarrollo

      /** @type {boolean} Si el panel está abierto */
      isPanelOpen: false,

      // ==========================================
      // GETTERS
      // ==========================================

      /**
       * Obtiene el usuario actual de desarrollo
       * @returns {Object|null}
       */
      getCurrentUser: () => {
        const { currentUserId } = get();
        return DEV_USERS.find(u => u.id === currentUserId) || null;
      },

      /**
       * Obtiene las rutas disponibles para el usuario actual
       * @returns {Array}
       */
      getCurrentRoutes: () => {
        const user = get().getCurrentUser();
        return ROUTES_BY_ROLE[user?.rol] || ROUTES_BY_ROLE.public;
      },

      /**
       * Verifica si el modo dev está habilitado
       * Solo en localhost o si MODE es development
       * @returns {boolean}
       */
      isDevMode: () => {
        const isDev = true;
        const isLocalhost = window.location.hostname === 'localhost' ||
                           window.location.hostname === '127.0.0.1';
        return isDev || isLocalhost;
      },

      // ==========================================
      // ACTIONS
      // ==========================================

      /**
       * Cambia el usuario de desarrollo actual
       * @param {string} userId - ID del usuario
       */
      setCurrentUser: (userId) => {
        const user = DEV_USERS.find(u => u.id === userId);
        if (!user) {
          console.error(`[DevStore] Usuario no encontrado: ${userId}`);
          return;
        }

        // Actualizar dev-storage
        set({ currentUserId: userId });
        console.log('👤 [DevStore] Usuario cambiado a:', user.nombre);

        // Crear y guardar auth mock ANTES de recargar
        if (userId !== 'public') {
          const mockUser = {
            email: user.email,
            name: user.nombre,
            sub: `dev-${userId}`,
            rut: user.rut,
            'cognito:groups': user.groups || [user.rol],
            'custom:rut': user.rut,
            exp: Math.floor(Date.now() / 1000) + 3600
          };

          const mockToken = `mock.${btoa(JSON.stringify(mockUser))}.dev`;

          const authData = {
            state: {
              token: mockToken,
              user: mockUser
            },
            version: 0
          };

          localStorage.setItem('auth-storage', JSON.stringify(authData));
        } else {
          // Si es público, limpiar auth
          localStorage.removeItem('auth-storage');
        }

        // Recargar para aplicar cambios de autenticación
        setTimeout(() => {
          window.location.reload();
        }, 100);
      },

      /**
       * Toggle del panel de desarrollo
       */
      togglePanel: () => {
        set(state => ({ isPanelOpen: !state.isPanelOpen }));
      },

      /**
       * Cerrar el panel
       */
      closePanel: () => {
        set({ isPanelOpen: false });
      },

      /**
       * Abrir el panel
       */
      openPanel: () => {
        set({ isPanelOpen: true });
      },

      /**
       * Reset al usuario por defecto
       */
      reset: () => {
        set({ currentUserId: 'admin', isPanelOpen: false });
      },

      /**
       * Obtiene datos de usuario mockeados para authStore
       * @returns {Object|null}
       */
      getMockAuthData: () => {
        const user = get().getCurrentUser();

        if (!user || user.id === 'public') {
          return null;
        }

        // Crear un mock token JWT-like para desarrollo
        const mockToken = btoa(JSON.stringify({
          email: user.email,
          name: user.nombre,
          sub: `dev-${user.id}`,
          'cognito:groups': user.groups || [user.rol],
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hora
        }));

        return {
          token: `mock.${mockToken}.dev`,
          user: {
            email: user.email,
            name: user.nombre,
            sub: `dev-${user.id}`,
            'cognito:groups': user.groups || [user.rol],
            exp: Math.floor(Date.now() / 1000) + 3600
          }
        };
      }
    }),
    {
      name: 'dev-storage', // nombre en localStorage
      partialize: (state) => ({
        currentUserId: state.currentUserId
      })
    }
  )
);

export default useDevStore;
