/**
 * Constants - Constantes de la Aplicación
 *
 * Responsabilidad:
 * - Constantes de UI (colores, textos, variantes)
 * - Mapeos de estados, roles, tipos
 * - Textos estáticos
 * - Enums y configuraciones
 *
 * IMPORTANTE: Las constantes compartidas con el backend se importan desde shared-constants.js
 *
 * USAGE:
 * ```jsx
 * import { ROLES, ESTADOS_MATRICULA, getEstadoTexto } from './';
 *
 * function MyComponent() {
 *   const estado = 'aprobada';
 *   const texto = getEstadoTexto(estado);
 *   const color = ESTADOS_MATRICULA[estado].color;
 * }
 * ```
 */

// ==========================================
// IMPORTAR CONSTANTES COMPARTIDAS (SINGLE SOURCE OF TRUTH)
// ==========================================

export {
  ROLES,
  ROLES_TEXTOS,
  ESTADOS_FLUJO,
  ESTADOS_CONFIG,
  LIMITS,
  TIPOS_SESION,
  TIPOS_SESION_TEXTOS,
  TIPOS_EVENTO,
  TIPOS_EVENTO_TEXTOS,
} from './shared-constants';

import {
  ROLES,
  ROLES_TEXTOS,
  ESTADOS_CONFIG,
  ESTADOS_FLUJO,
  TIPOS_SESION,
  TIPOS_SESION_TEXTOS,
  TIPOS_EVENTO,
  TIPOS_EVENTO_TEXTOS,
} from './shared-constants';

/**
 * Obtiene el texto de un rol
 * @param {string} rol - Rol
 * @returns {string} Texto del rol
 */
export const getRolTexto = (rol) => {
  return ROLES_TEXTOS[rol] || rol;
};

// ==========================================
// ESTADOS DE MATRÍCULA (Usa ESTADOS_CONFIG compartido)
// ==========================================

export const ESTADOS_MATRICULA = {
  [ESTADOS_FLUJO.PENDIENTE]: {
    texto: ESTADOS_CONFIG[ESTADOS_FLUJO.PENDIENTE].texto,
    color: ESTADOS_CONFIG[ESTADOS_FLUJO.PENDIENTE].color,
    variant: ESTADOS_CONFIG[ESTADOS_FLUJO.PENDIENTE].variant,
  },
  [ESTADOS_FLUJO.APROBADO]: {
    texto: ESTADOS_CONFIG[ESTADOS_FLUJO.APROBADO].textoFem, // Femenino para matrícula
    color: ESTADOS_CONFIG[ESTADOS_FLUJO.APROBADO].color,
    variant: ESTADOS_CONFIG[ESTADOS_FLUJO.APROBADO].variant,
  },
  [ESTADOS_FLUJO.RECHAZADO]: {
    texto: ESTADOS_CONFIG[ESTADOS_FLUJO.RECHAZADO].textoFem, // Femenino para matrícula
    color: ESTADOS_CONFIG[ESTADOS_FLUJO.RECHAZADO].color,
    variant: ESTADOS_CONFIG[ESTADOS_FLUJO.RECHAZADO].variant,
  },
  [ESTADOS_FLUJO.REQUIERE_CORRECCION]: {
    texto: ESTADOS_CONFIG[ESTADOS_FLUJO.REQUIERE_CORRECCION].texto,
    color: ESTADOS_CONFIG[ESTADOS_FLUJO.REQUIERE_CORRECCION].color,
    variant: ESTADOS_CONFIG[ESTADOS_FLUJO.REQUIERE_CORRECCION].variant,
  },
};

// ==========================================
// ESTADOS DE MATERIAL (Usa ESTADOS_CONFIG compartido)
// ==========================================

export const ESTADOS_MATERIAL = {
  [ESTADOS_FLUJO.PENDIENTE]: {
    texto: ESTADOS_CONFIG[ESTADOS_FLUJO.PENDIENTE].texto,
    color: ESTADOS_CONFIG[ESTADOS_FLUJO.PENDIENTE].color,
    variant: ESTADOS_CONFIG[ESTADOS_FLUJO.PENDIENTE].variant,
  },
  [ESTADOS_FLUJO.APROBADO]: {
    texto: ESTADOS_CONFIG[ESTADOS_FLUJO.APROBADO].texto, // Masculino para material
    color: ESTADOS_CONFIG[ESTADOS_FLUJO.APROBADO].color,
    variant: ESTADOS_CONFIG[ESTADOS_FLUJO.APROBADO].variant,
  },
  [ESTADOS_FLUJO.RECHAZADO]: {
    texto: ESTADOS_CONFIG[ESTADOS_FLUJO.RECHAZADO].texto, // Masculino para material
    color: ESTADOS_CONFIG[ESTADOS_FLUJO.RECHAZADO].color,
    variant: ESTADOS_CONFIG[ESTADOS_FLUJO.RECHAZADO].variant,
  },
  [ESTADOS_FLUJO.REQUIERE_CORRECCION]: {
    texto: ESTADOS_CONFIG[ESTADOS_FLUJO.REQUIERE_CORRECCION].texto,
    color: ESTADOS_CONFIG[ESTADOS_FLUJO.REQUIERE_CORRECCION].color,
    variant: ESTADOS_CONFIG[ESTADOS_FLUJO.REQUIERE_CORRECCION].variant,
  },
};

/**
 * Obtiene el texto de un estado
 * @param {string} estado - Estado
 * @returns {string} Texto del estado
 */
export const getEstadoTexto = (estado) => {
  return (
    ESTADOS_MATRICULA[estado]?.texto ||
    ESTADOS_MATERIAL[estado]?.texto ||
    estado
  );
};

/**
 * Obtiene el color de un estado
 * @param {string} estado - Estado
 * @returns {string} Color del estado
 */
export const getEstadoColor = (estado) => {
  return (
    ESTADOS_MATRICULA[estado]?.color || ESTADOS_MATERIAL[estado]?.color || 'default'
  );
};

/**
 * Obtiene la variante de un estado
 * @param {string} estado - Estado
 * @returns {string} Variante del estado
 */
export const getEstadoVariant = (estado) => {
  return (
    ESTADOS_MATRICULA[estado]?.variant ||
    ESTADOS_MATERIAL[estado]?.variant ||
    'default'
  );
};

// ==========================================
// COLORES DE VARIANTES
// ==========================================

export const BADGE_VARIANTS = {
  DEFAULT: 'default',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
  INFO: 'info',
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
};

export const BADGE_COLORS = {
  [BADGE_VARIANTS.DEFAULT]: {
    bg: '#6c757d',
    text: '#ffffff',
  },
  [BADGE_VARIANTS.SUCCESS]: {
    bg: '#28a745',
    text: '#ffffff',
  },
  [BADGE_VARIANTS.WARNING]: {
    bg: '#ffc107',
    text: '#000000',
  },
  [BADGE_VARIANTS.DANGER]: {
    bg: '#dc3545',
    text: '#ffffff',
  },
  [BADGE_VARIANTS.INFO]: {
    bg: '#17a2b8',
    text: '#ffffff',
  },
  [BADGE_VARIANTS.PRIMARY]: {
    bg: '#007bff',
    text: '#ffffff',
  },
  [BADGE_VARIANTS.SECONDARY]: {
    bg: '#6c757d',
    text: '#ffffff',
  },
};

// ==========================================
// TIPOS DE SESIÓN
// ==========================================

export const TIPOS_SESION = {
  INDIVIDUAL: 'individual',
  GRUPAL: 'grupal',
  EVALUACION: 'evaluacion',
};

export const TIPOS_SESION_TEXTOS = {
  [TIPOS_SESION.INDIVIDUAL]: 'Individual',
  [TIPOS_SESION.GRUPAL]: 'Grupal',
  [TIPOS_SESION.EVALUACION]: 'Evaluación',
};

/**
 * Obtiene el texto de un tipo de sesión
 * @param {string} tipo - Tipo de sesión
 * @returns {string} Texto del tipo
 */
export const getTipoSesionTexto = (tipo) => {
  return TIPOS_SESION_TEXTOS[tipo] || tipo;
};

// ==========================================
// TIPOS DE EVENTO
// ==========================================

export const TIPOS_EVENTO = {
  REUNION: 'reunion',
  EVALUACION: 'evaluacion',
  TALLER: 'taller',
  CEREMONIA: 'ceremonia',
  OTRO: 'otro',
};

export const TIPOS_EVENTO_TEXTOS = {
  [TIPOS_EVENTO.REUNION]: 'Reunión',
  [TIPOS_EVENTO.EVALUACION]: 'Evaluación',
  [TIPOS_EVENTO.TALLER]: 'Taller',
  [TIPOS_EVENTO.CEREMONIA]: 'Ceremonia',
  [TIPOS_EVENTO.OTRO]: 'Otro',
};

/**
 * Obtiene el texto de un tipo de evento
 * @param {string} tipo - Tipo de evento
 * @returns {string} Texto del tipo
 */
export const getTipoEventoTexto = (tipo) => {
  return TIPOS_EVENTO_TEXTOS[tipo] || tipo;
};

// ==========================================
// DÍAS DE LA SEMANA
// ==========================================

export const DIAS_SEMANA = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export const DIAS_SEMANA_CORTO = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

/**
 * Obtiene el nombre del día de la semana
 * @param {number} dia - Día (0-6)
 * @param {boolean} corto - Usar formato corto
 * @returns {string} Nombre del día
 */
export const getDiaSemana = (dia, corto = false) => {
  return corto ? DIAS_SEMANA_CORTO[dia] : DIAS_SEMANA[dia];
};

// ==========================================
// MESES
// ==========================================

export const MESES = {
  0: 'Enero',
  1: 'Febrero',
  2: 'Marzo',
  3: 'Abril',
  4: 'Mayo',
  5: 'Junio',
  6: 'Julio',
  7: 'Agosto',
  8: 'Septiembre',
  9: 'Octubre',
  10: 'Noviembre',
  11: 'Diciembre',
};

export const MESES_CORTO = {
  0: 'Ene',
  1: 'Feb',
  2: 'Mar',
  3: 'Abr',
  4: 'May',
  5: 'Jun',
  6: 'Jul',
  7: 'Ago',
  8: 'Sep',
  9: 'Oct',
  10: 'Nov',
  11: 'Dic',
};

/**
 * Obtiene el nombre del mes
 * @param {number} mes - Mes (0-11)
 * @param {boolean} corto - Usar formato corto
 * @returns {string} Nombre del mes
 */
export const getMes = (mes, corto = false) => {
  return corto ? MESES_CORTO[mes] : MESES[mes];
};

// ==========================================
// RUTAS DE NAVEGACIÓN
// ==========================================

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  ADMIN: '/admin',
  PROFESOR: '/profesor',
  FONO: '/fono',
  APODERADO: '/apoderado',
  ALUMNOS: '/alumnos',
};

// ==========================================
// LÍMITES Y RESTRICCIONES
// ==========================================

export const LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES_PER_UPLOAD: 5,
  MAX_UPLOAD_SIZE: 50 * 1024 * 1024, // 50MB total
  ITEMS_PER_PAGE: 10,
  MAX_SEARCH_RESULTS: 100,
};

// ==========================================
// FORMATOS
// ==========================================

export const DATE_FORMATS = {
  SHORT: 'DD/MM/YYYY',
  LONG: 'dddd, D [de] MMMM [de] YYYY',
  TIME: 'DD/MM/YYYY HH:mm',
  ISO: 'YYYY-MM-DD',
  TIME_ONLY: 'HH:mm',
};

export const TIME_FORMATS = {
  '12H': '12h',
  '24H': '24h',
};

// ==========================================
// HELPERS - Objeto para compatibilidad con window.Constants
// ==========================================

/**
 * Objeto de constantes para uso global
 * Compatible con window.Constants del código legacy
 */
export const Constants = {
  // Roles
  ROLES,
  ROLES_TEXTOS,
  getRolTexto,

  // Estados
  ESTADOS_MATRICULA,
  ESTADOS_MATERIAL,
  getEstadoTexto,
  getEstadoColor,
  getEstadoVariant,

  // Badges
  BADGE_VARIANTS,
  BADGE_COLORS,

  // Sesiones
  TIPOS_SESION,
  TIPOS_SESION_TEXTOS,
  getTipoSesionTexto,

  // Eventos
  TIPOS_EVENTO,
  TIPOS_EVENTO_TEXTOS,
  getTipoEventoTexto,

  // Fechas
  DIAS_SEMANA,
  DIAS_SEMANA_CORTO,
  getDiaSemana,
  MESES,
  MESES_CORTO,
  getMes,

  // Rutas
  ROUTES,

  // Límites
  LIMITS,

  // Formatos
  DATE_FORMATS,
  TIME_FORMATS,
};

// Exportación por defecto para uso como módulo
export default Constants;
