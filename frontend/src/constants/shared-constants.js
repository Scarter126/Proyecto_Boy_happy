/**
 * Constantes Compartidas - Single Source of Truth (Frontend Version)
 *
 * IMPORTANTE: Este archivo debe mantenerse sincronizado con:
 * layers/common/nodejs/shared-constants.js (backend version)
 *
 * Para evitar duplicación, estas constantes son la fuente de verdad
 * compartida entre frontend y backend.
 *
 * @module shared-constants
 */

// ==========================================
// ROLES DEL SISTEMA
// ==========================================

export const ROLES = {
  ADMIN: 'admin',
  PROFESOR: 'profesor',
  FONO: 'fono',
  APODERADO: 'apoderado',
  ALUMNO: 'alumno',
};

export const ROLES_TEXTOS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.PROFESOR]: 'Profesor',
  [ROLES.FONO]: 'Fonoaudiólogo',
  [ROLES.APODERADO]: 'Apoderado',
  [ROLES.ALUMNO]: 'Alumno',
};

// ==========================================
// ESTADOS DE FLUJO (Matrículas, Materiales, etc.)
// ==========================================

export const ESTADOS_FLUJO = {
  PENDIENTE: 'pendiente',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
  REQUIERE_CORRECCION: 'requiere_correccion',
};

export const ESTADOS_CONFIG = {
  [ESTADOS_FLUJO.PENDIENTE]: {
    texto: 'Pendiente',
    color: 'warning',
    variant: 'warning',
  },
  [ESTADOS_FLUJO.APROBADO]: {
    texto: 'Aprobado',
    textoFem: 'Aprobada',
    color: 'success',
    variant: 'success',
  },
  [ESTADOS_FLUJO.RECHAZADO]: {
    texto: 'Rechazado',
    textoFem: 'Rechazada',
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
// LIMITS Y RESTRICCIONES
// ==========================================

export const LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES_PER_UPLOAD: 5,
  MAX_UPLOAD_SIZE: 50 * 1024 * 1024, // 50MB total
  ITEMS_PER_PAGE: 10,
  MAX_SEARCH_RESULTS: 100,
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
