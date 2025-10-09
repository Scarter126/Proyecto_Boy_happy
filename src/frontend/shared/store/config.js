/**
 * Config Store - Configuración de la Aplicación
 *
 * Responsabilidad:
 * - Configuración global de la app
 * - Feature flags (activar/desactivar funcionalidades)
 * - Constantes de configuración
 * - Parámetros del sistema
 */

document.addEventListener('alpine:init', () => {
  Alpine.store('config', {
    // Información de la aplicación
    appName: 'Boy Happy',
    appVersion: '1.0.0',
    environment: window.location.hostname === 'localhost' ? 'development' : 'production',

    // Features flags
    features: {
      darkMode: true,
      exportExcel: true,
      exportPDF: true,
      notifications: true,
      chat: false,
      analytics: false,
      backups: true
    },

    // Configuración de UI
    ui: {
      itemsPerPage: 10,
      defaultLanguage: 'es-CL',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      currency: 'CLP'
    },

    // Límites y restricciones
    limits: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFilesPerUpload: 5,
      sessionTimeout: 30 * 60 * 1000, // 30 minutos
      cacheTime: 5 * 60 * 1000 // 5 minutos
    },

    // Notificaciones
    notifications: {
      enabled: true,
      duration: 5000,
      position: 'top-right'
    },

    // ==========================================
    // MÉTODOS
    // ==========================================

    isFeatureEnabled(feature) {
      return this.features[feature] || false;
    },

    toggleFeature(feature) {
      if (this.features.hasOwnProperty(feature)) {
        this.features[feature] = !this.features[feature];
      }
    },

    get isDevelopment() {
      return this.environment === 'development';
    },

    get isProduction() {
      return this.environment === 'production';
    },

    getSetting(key) {
      return this.ui[key] || this.limits[key] || this.notifications[key] || null;
    },

    updateSetting(category, key, value) {
      if (this[category] && this[category].hasOwnProperty(key)) {
        this[category][key] = value;
      }
    }
  });
});

console.log('✅ config.js cargado');
