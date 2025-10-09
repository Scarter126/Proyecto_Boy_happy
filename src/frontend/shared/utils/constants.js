/**
 * Constants - Constantes del Dominio
 *
 * Responsabilidad ÚNICA:
 * - Definir constantes de la aplicación
 * - Colores, estados, cursos, etc.
 * - Mapeos y diccionarios
 *
 * NO maneja:
 * - Lógica de negocio
 * - Estado reactivo
 * - Peticiones HTTP
 */

// ==========================================
// CURSOS
// ==========================================

const CURSOS = [
  'medio-mayor',
  'prekinder-a',
  'prekinder-b',
  'kinder',
  'extension'
];

const CURSO_COLORS = [
  '#667eea', // Púrpura - medio-mayor
  '#f093fb', // Rosa - prekinder-a
  '#4facfe', // Azul cielo - prekinder-b
  '#43e97b', // Verde - kinder
  '#fa709a', // Rosa-naranja - extension
  '#feca57'  // Amarillo - extra
];

/**
 * Obtener color de curso por índice
 * @param {number} index - Índice del curso
 * @returns {string} Color hexadecimal
 */
function getCursoColor(index) {
  return CURSO_COLORS[index % CURSO_COLORS.length];
}

/**
 * Obtener color de curso por código
 * @param {string} codigo - Código del curso
 * @returns {string} Color hexadecimal
 */
function getCursoColorByCode(codigo) {
  const index = CURSOS.indexOf(codigo);
  return getCursoColor(index >= 0 ? index : 0);
}

// ==========================================
// ESTADOS
// ==========================================

const ESTADO_COLORS = {
  // Estados generales
  'pendiente': '#ffa726',
  'aprobado': '#66bb6a',
  'aprobada': '#66bb6a',
  'rechazado': '#ef5350',
  'rechazada': '#ef5350',
  'requiere_correccion': '#ff9800',
  'activo': '#4caf50',
  'inactivo': '#9e9e9e',

  // Asistencia
  'presente': '#4caf50',
  'ausente': '#ef5350',
  'justificado': '#ff9800',
  'atrasado': '#ffa726'
};

const ESTADO_TEXTOS = {
  // Estados generales
  'pendiente': 'Pendiente',
  'aprobado': 'Aprobado',
  'aprobada': 'Aprobada',
  'rechazado': 'Rechazado',
  'rechazada': 'Rechazada',
  'requiere_correccion': 'Requiere Corrección',
  'activo': 'Activo',
  'inactivo': 'Inactivo',

  // Asistencia
  'presente': 'Presente',
  'ausente': 'Ausente',
  'justificado': 'Justificado',
  'atrasado': 'Atrasado'
};

/**
 * Obtener color de estado
 * @param {string} estado - Estado
 * @returns {string} Color hexadecimal
 */
function getEstadoColor(estado) {
  return ESTADO_COLORS[estado] || '#999';
}

/**
 * Obtener texto de estado
 * @param {string} estado - Estado
 * @returns {string} Texto formateado
 */
function getEstadoTexto(estado) {
  return ESTADO_TEXTOS[estado] || estado;
}

// ==========================================
// ROLES
// ==========================================

const ROLES = {
  ADMIN: 'admin',
  PROFESOR: 'profesor',
  FONO: 'fono',
  ALUMNO: 'alumno',
  APODERADO: 'apoderado'
};

const ROLES_TEXTOS = {
  'admin': 'Administrador',
  'profesor': 'Profesor',
  'fono': 'Fonoaudiólogo',
  'alumno': 'Alumno',
  'apoderado': 'Apoderado'
};

/**
 * Obtener texto de rol
 * @param {string} rol - Rol
 * @returns {string} Texto formateado
 */
function getRolTexto(rol) {
  return ROLES_TEXTOS[rol] || rol;
}

// ==========================================
// ASIGNATURAS
// ==========================================

const ASIGNATURAS = [
  'Lenguaje',
  'Matemáticas',
  'Ciencias',
  'Historia',
  'Inglés',
  'Educación Física',
  'Artes',
  'Música'
];

// ==========================================
// TIPOS DE EVALUACIÓN
// ==========================================

const TIPOS_EVALUACION = [
  'Prueba',
  'Trabajo',
  'Exposición',
  'Taller',
  'Proyecto',
  'Control',
  'Examen'
];

// ==========================================
// EXPORTAR AL SCOPE GLOBAL
// ==========================================

window.Constants = {
  // Cursos
  CURSOS,
  CURSO_COLORS,
  getCursoColor,
  getCursoColorByCode,

  // Estados
  ESTADO_COLORS,
  ESTADO_TEXTOS,
  getEstadoColor,
  getEstadoTexto,

  // Roles
  ROLES,
  ROLES_TEXTOS,
  getRolTexto,

  // Otros
  ASIGNATURAS,
  TIPOS_EVALUACION
};

// Alias para uso en Alpine templates
if (typeof Alpine !== 'undefined') {
  Alpine.magic('constants', () => window.Constants);
}

console.log('✅ utils/constants.js cargado');
