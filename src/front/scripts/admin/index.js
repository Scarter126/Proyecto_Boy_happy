/**
 * Admin Modules Index
 * Importa y configura todos los componentes Alpine.js para el panel de administración
 *
 * Estructura modular:
 * - dashboard-app.js: Dashboard de indicadores con semáforos
 * - usuarios-app.js: Gestión completa de usuarios (CRUD, roles, activación)
 * - asistencia-app.js: Supervisión de asistencia con filtros y estadísticas
 * - materiales-app.js: Supervisión de materiales pedagógicos
 * - comparativo-app.js: Análisis comparativo multi-curso con gráficos
 * - swal-config.js: Configuración global de SweetAlert2
 */

// No necesitamos importar aquí porque usamos <script src="..."> en HTML
// Los módulos se cargan en orden y exponen funciones globales en window

console.log('✅ Admin modules loaded');
console.log('Available apps:', {
  dashboardApp: typeof window.dashboardApp !== 'undefined',
  usuariosApp: typeof window.usuariosApp !== 'undefined',
  asistenciaApp: typeof window.asistenciaApp !== 'undefined',
  materialesApp: typeof window.materialesApp !== 'undefined',
  comparativoApp: typeof window.comparativoApp !== 'undefined'
});
