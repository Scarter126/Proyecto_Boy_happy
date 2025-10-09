/**
 * Admin Modules Index
 * Valida que todos los componentes Alpine.js se hayan registrado correctamente
 *
 * Estructura modular:
 * - dashboard-app.js: Dashboard de indicadores con semáforos
 * - usuarios-app.js: Gestión completa de usuarios (CRUD, roles, activación)
 * - asistencia-app.js: Supervisión de asistencia con filtros y estadísticas
 * - materiales-app.js: Supervisión de materiales pedagógicos
 * - comparativo-app.js: Análisis comparativo multi-curso con gráficos
 * - matriculas-app.js: Gestión de solicitudes de matrícula
 * - swal-config.js: Configuración global de SweetAlert2
 */

// Todos los módulos ahora usan Alpine.data() y se registran en alpine:init
// No necesitan exponerse como funciones globales en window

// ===============================================
// Funciones globales para manejo de tabs
// ===============================================

// Función para manejar tabs de Comunicaciones
window.showComTab = function(tabName, evt) {
  // Ocultar todos los tabs
  document.querySelectorAll('#comunicaciones .tab-content').forEach(tab => {
    tab.style.display = 'none';
  });

  // Remover active de todos los botones
  document.querySelectorAll('#comunicaciones .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Mostrar el tab seleccionado
  const selectedTab = document.getElementById(`com-${tabName}`);
  if (selectedTab) {
    selectedTab.style.display = 'block';
  }

  // Marcar el botón como activo
  if (evt?.target) {
    evt.target.classList.add('active');
  }

  // Cargar datos según el tab
  if (tabName === 'anuncios') {
    if (typeof cargarAnuncios === 'function') cargarAnuncios();
  } else if (tabName === 'retroalimentacion') {
    if (typeof cargarUsuariosParaRetro === 'function') cargarUsuariosParaRetro();
    if (typeof cargarHistorialRetro === 'function') cargarHistorialRetro();
  }
};

// Función para manejar tabs de Configuración
window.showConfigTab = function(tabName, evt) {
  // Ocultar todos los tabs
  document.querySelectorAll('#configuracion .tab-content').forEach(tab => {
    tab.style.display = 'none';
    tab.classList.remove('active');
  });

  // Remover active de todos los botones
  document.querySelectorAll('#configuracion .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Mostrar el tab seleccionado
  const selectedTab = document.getElementById(`config-${tabName}`);
  if (selectedTab) {
    selectedTab.style.display = 'block';
    selectedTab.classList.add('active');
  }

  // Marcar el botón como activo
  if (evt?.target) {
    evt.target.classList.add('active');
  }

  // Cargar datos según el tab
  if (tabName === 'general') {
    if (typeof cargarConfiguracion === 'function') cargarConfiguracion();
  } else if (tabName === 'categorias') {
    if (typeof cargarCategorias === 'function') cargarCategorias();
  }
};

console.log('✅ Admin modules index loaded');
console.log('ℹ️  Los componentes Alpine se registran vía alpine:init event');
