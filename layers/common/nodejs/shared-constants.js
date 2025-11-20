/**
 * Constantes Compartidas - Single Source of Truth
 *
 * Este módulo define las constantes compartidas entre frontend y backend.
 * IMPORTANTE: Modificar aquí para que los cambios se reflejen en todo el sistema.
 *
 * @module shared-constants
 */

// ==========================================
// ROLES DEL SISTEMA
// ==========================================

/**
 * Roles de usuario en el sistema
 * @constant
 */
const ROLES = {
  ADMIN: 'admin',
  PROFESOR: 'profesor',
  FONO: 'fono',
  APODERADO: 'apoderado',
  ALUMNO: 'alumno',
};

/**
 * Textos descriptivos de los roles
 * @constant
 */
const ROLES_TEXTOS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.PROFESOR]: 'Profesor',
  [ROLES.FONO]: 'Fonoaudiólogo',
  [ROLES.APODERADO]: 'Apoderado',
  [ROLES.ALUMNO]: 'Alumno',
};

// ==========================================
// ESTADOS DE FLUJO (Matrículas, Materiales, etc.)
// ==========================================

/**
 * Estados posibles para flujos de aprobación
 * Usado en: matrículas, materiales, solicitudes
 * @constant
 */
const ESTADOS_FLUJO = {
  PENDIENTE: 'pendiente',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
  REQUIERE_CORRECCION: 'requiere_correccion',
};

/**
 * Configuración de estados para UI (colores, textos, variantes)
 * @constant
 */
const ESTADOS_CONFIG = {
  [ESTADOS_FLUJO.PENDIENTE]: {
    texto: 'Pendiente',
    color: 'warning',
    variant: 'warning',
  },
  [ESTADOS_FLUJO.APROBADO]: {
    texto: 'Aprobado',
    textoFem: 'Aprobada', // Para matrículas
    color: 'success',
    variant: 'success',
  },
  [ESTADOS_FLUJO.RECHAZADO]: {
    texto: 'Rechazado',
    textoFem: 'Rechazada', // Para matrículas
    color: 'danger',
    variant: 'danger',
  },
  [ESTADOS_FLUJO.REQUIERE_CORRECCION]: {
    texto: 'Requiere Corrección',
    color: 'info',
    variant: 'info',
  },
};

// ==========================================
// AWS CONFIGURACIÓN
// ==========================================

/**
 * Región de AWS por defecto
 * @constant
 */
const AWS_REGION = 'us-east-1';

/**
 * Nombre de la tabla DynamoDB principal
 * @constant
 */
const DYNAMODB_TABLE = 'BoyHappyTable';

// ==========================================
// LIMITS Y RESTRICCIONES
// ==========================================

/**
 * Límites del sistema
 * @constant
 */
const LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES_PER_UPLOAD: 5,
  MAX_UPLOAD_SIZE: 50 * 1024 * 1024, // 50MB total
  ITEMS_PER_PAGE: 10,
  MAX_SEARCH_RESULTS: 100,
};

// ==========================================
// TIPOS DE SESIÓN
// ==========================================

/**
 * Tipos de sesión terapéutica
 * @constant
 */
const TIPOS_SESION = {
  INDIVIDUAL: 'individual',
  GRUPAL: 'grupal',
  EVALUACION: 'evaluacion',
};

// ==========================================
// TIPOS DE EVENTO
// ==========================================

/**
 * Tipos de evento del calendario
 * @constant
 */
const TIPOS_EVENTO = {
  REUNION: 'reunion',
  EVALUACION: 'evaluacion',
  TALLER: 'taller',
  CEREMONIA: 'ceremonia',
  OTRO: 'otro',
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Roles
  ROLES,
  ROLES_TEXTOS,

  // Estados
  ESTADOS_FLUJO,
  ESTADOS_CONFIG,

  // AWS
  AWS_REGION,
  DYNAMODB_TABLE,

  // Límites
  LIMITS,

  // Tipos
  TIPOS_SESION,
  TIPOS_EVENTO,
};
