/**
 * UI Store - Estado de Interfaz de Usuario
 *
 * Responsabilidad:
 * - Estado de componentes UI (sidebar, modals, theme)
 * - Notificaciones
 * - Navegación entre secciones
 * - Preferencias de usuario
 */

document.addEventListener('alpine:init', () => {
  Alpine.store('ui', {
    sidebarOpen: true,
    theme: 'light',
    notifications: [],
    activeSection: localStorage.getItem('activeSection') || 'dashboard',
    modalOpen: false,
    modalContent: null,

    init() {
      // Restaurar tema guardado
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        this.setTheme(savedTheme);
      }

      // Restaurar estado del sidebar
      const sidebarState = localStorage.getItem('sidebarOpen');
      if (sidebarState !== null) {
        this.sidebarOpen = sidebarState === 'true';
      }
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
      localStorage.setItem('sidebarOpen', this.sidebarOpen);
    },

    setTheme(theme) {
      this.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    },

    toggleTheme() {
      const newTheme = this.theme === 'light' ? 'dark' : 'light';
      this.setTheme(newTheme);
    },

    get isDarkMode() {
      return this.theme === 'dark';
    },

    addNotification(message, type = 'info') {
      const id = Date.now();
      this.notifications.push({ id, message, type });
      setTimeout(() => {
        this.removeNotification(id);
      }, 5000);
    },

    removeNotification(id) {
      this.notifications = this.notifications.filter(n => n.id !== id);
    },

    clearNotifications() {
      this.notifications = [];
    },

    navigateTo(section) {
      this.activeSection = section;
      localStorage.setItem('activeSection', section);
    },

    isActive(section) {
      return this.activeSection === section;
    },

    openModal(content) {
      this.modalContent = content;
      this.modalOpen = true;
    },

    closeModal() {
      this.modalOpen = false;
      this.modalContent = null;
    }
  });
});

console.log('✅ ui.js cargado');
