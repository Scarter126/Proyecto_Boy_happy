/**
 * Menu Store - Zustand
 * Store centralizado para gestión de menús dinámicos y navegación SPA
 *
 * FEATURES:
 * - Gestión de menús dinámicos
 * - Navegación SPA entre secciones
 * - Filtrado por permisos
 * - Badges dinámicos
 * - Detección automática de página actual
 *
 * USAGE:
 * ```jsx
 * import useMenuStore from './menuStore';
 * import useAuthStore from './authStore';
 * import { useLocation } from 'react-router-dom';
 *
 * function MyComponent() {
 *   const { items, activeSection, setActiveSection } = useMenuStore();
 *   const location = useLocation();
 *
 *   useEffect(() => {
 *     // Detectar página actual desde React Router
 *     const pageName = menuStore.detectCurrentPage(location.pathname);
 *     if (pageName) {
 *       menuStore.loadMenuForPage(pageName);
 *     }
 *   }, [location]);
 *
 *   return <nav>...</nav>;
 * }
 * ```
 */

import { create } from 'zustand';

const useMenuStore = create((set, get) => ({
  // ==========================================
  // STATE
  // ==========================================

  /** @type {Array} Items del menú actual */
  items: [],

  /** @type {string} Sección activa */
  activeSection: 'dashboard',

  /** @type {string|null} Nombre de la página actual (admin, profesor, fono, apoderado) */
  pageName: null,

  /** @type {Object|null} Configuración completa de la página */
  pageConfig: null,

  /** @type {boolean} Estado de carga */
  loading: false,

  /** @type {string|null} Error en carga */
  error: null,

  // ==========================================
  // INIT
  // ==========================================

  /**
   * Inicializa el menu store
   * NOTA: En React, llama a esto en un useEffect del componente raíz o usa React Router
   */
  init: () => {
    console.log('🔧 Menu store initialized');
    // En React, la detección de página se hace con useLocation de React Router
    // Ver ejemplo de uso en los comentarios del archivo
  },

  // ==========================================
  // DETECTION
  // ==========================================

  /**
   * Detecta la página actual desde el pathname
   * USO CON REACT ROUTER:
   * ```jsx
   * const location = useLocation();
   * const pageName = menuStore.detectCurrentPage(location.pathname);
   * ```
   *
   * @param {string} pathname - Pathname de React Router (location.pathname)
   * @returns {string|null} Nombre de la página detectada
   */
  detectCurrentPage: (pathname) => {
    // Mapeo de rutas a páginas
    const pageMap = {
      '/admin': 'admin',
      '/profesor': 'profesor',
      '/profesores': 'profesor',
      '/fono': 'fono',
      '/apoderado': 'apoderado',
      '/alumnos': 'apoderado',
    };

    for (const [route, page] of Object.entries(pageMap)) {
      if (pathname.startsWith(route)) {
        set({ pageName: page });
        console.log(`📄 Detected page: ${page}`);
        return page;
      }
    }

    console.warn('⚠️  Could not detect page from path:', pathname);
    return null;
  },

  // ==========================================
  // MENU LOADING
  // ==========================================

  /**
   * Carga el menú para una página específica
   * NOTA: Por ahora deshabilitado. El menú se define estáticamente en cada página.
   * En el futuro, page.config.js podría usarse para generar el sidebar dinámicamente.
   *
   * @param {string} pageName - Nombre de la página (admin, profesor, etc)
   */
  loadMenuForPage: async (pageName) => {
    console.log(`📋 Menu loading disabled for: ${pageName}`);
    console.log(`ℹ️  Using static menu definition from sidebar component`);

    // TODO: Si en el futuro quieres cargar el menú dinámicamente desde page.config.js,
    // descomenta este código y usa dynamic imports de Vite
    /*
    set({ loading: true, error: null });

    try {
      // Dynamic import con Vite
      const configModule = await import(`/pages/${pageName}/page.config.js`);
      const pageConfig = configModule.default;
      const processedItems = get().processMenuItems(pageConfig.menu || []);

      set({
        pageConfig,
        items: processedItems,
        activeSection: pageConfig.defaultSection || 'dashboard',
        loading: false,
      });
    } catch (error) {
      console.error('❌ Error loading menu:', error);
      set({ items: [], error: error.message, loading: false });
    }
    */
  },

  /**
   * Procesa items de menú aplicando filtros y permisos
   * @param {Array} menuItems - Items de menú crudos
   * @returns {Array} Items procesados y filtrados
   */
  processMenuItems: (menuItems) => {
    const { hasPermissions } = get();

    return menuItems
      .filter((item) => {
        // Si tiene permisos definidos, verificar
        if (item.permissions && item.permissions.length > 0) {
          return hasPermissions(item.permissions);
        }

        // Sin restricciones de permisos
        return true;
      })
      .map((item) => {
        // Evaluar badge si es función
        if (typeof item.badge === 'function') {
          try {
            item.badgeValue = item.badge();
          } catch (e) {
            console.error('Error evaluating badge:', e);
            item.badgeValue = 0;
          }
        } else {
          item.badgeValue = item.badge || 0;
        }

        return item;
      });
  },

  /**
   * Verifica si el usuario tiene los permisos necesarios
   * INTEGRACIÓN CON AUTHSTORE:
   * ```jsx
   * import useAuthStore from './authStore';
   * const authStore = useAuthStore.getState();
   * const hasPerms = authStore.hasRole(...permissions);
   * ```
   *
   * @param {Array} permissions - Array de permisos requeridos (roles)
   * @returns {boolean}
   */
  hasPermissions: (permissions) => {
    // Importar authStore de forma dinámica para evitar dependencias circulares
    // NOTA: Esto funciona porque Zustand permite acceder al store sin hooks
    try {
      // En React, importa useAuthStore y usa getState()
      const { default: useAuthStore } = require('./authStore');
      const authState = useAuthStore.getState();

      if (!authState.user || !authState.user['cognito:groups']) {
        // Si no hay usuario logueado, denegar acceso
        console.warn('⚠️  No user found, denying access');
        return false;
      }

      const userGroups = authState.user['cognito:groups'] || [];

      // Usuario debe tener AL MENOS uno de los permisos requeridos
      return permissions.some((permission) => userGroups.includes(permission));
    } catch (error) {
      console.error('Error checking permissions:', error);
      // En caso de error, denegar acceso por seguridad
      return false;
    }
  },

  // ==========================================
  // NAVIGATION
  // ==========================================

  /**
   * Establece la sección activa
   * USO CON REACT ROUTER:
   * ```jsx
   * const navigate = useNavigate();
   * menuStore.setActiveSection('usuarios');
   * navigate('/admin/usuarios');
   * ```
   *
   * @param {string} sectionId - ID de la sección
   */
  setActiveSection: (sectionId) => {
    set({ activeSection: sectionId });
  },

  /**
   * Verifica si una sección está activa
   * @param {string} sectionId - ID de la sección
   * @returns {boolean}
   */
  isActive: (sectionId) => {
    return get().activeSection === sectionId;
  },

  // ==========================================
  // UTILITIES
  // ==========================================

  /**
   * Obtiene el item de menú activo
   * @returns {Object|null}
   */
  getActiveMenuItem: () => {
    const { items, activeSection } = get();
    return items.find((item) => item.id === activeSection) || null;
  },

  /**
   * Recarga los badges dinámicos
   * Útil para actualizar contadores en tiempo real
   */
  refreshBadges: () => {
    const { pageConfig, processMenuItems } = get();
    if (pageConfig?.menu) {
      const processedItems = processMenuItems(pageConfig.menu);
      set({ items: processedItems });
    }
  },

  /**
   * Establece items de menú manualmente
   * Útil para definir menús estáticos en componentes
   *
   * @param {Array} menuItems - Items de menú a establecer
   */
  setMenuItems: (menuItems) => {
    const processedItems = get().processMenuItems(menuItems);
    set({ items: processedItems });
  },

  /**
   * Resetea el store (útil para logout)
   */
  reset: () => {
    set({
      items: [],
      activeSection: 'dashboard',
      pageName: null,
      pageConfig: null,
      loading: false,
      error: null,
    });
  },
}));

export default useMenuStore;
