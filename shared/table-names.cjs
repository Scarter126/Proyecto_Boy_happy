/**
 * Nombres de Tablas DynamoDB - Única Fuente de Verdad
 *
 * Este archivo centraliza todos los nombres de tablas usados en el sistema.
 * Lee desde process.env con fallbacks a valores por defecto.
 *
 * Uso:
 * - CDK Stack: definiciones de tablas y tablesMap
 * - Lambdas: acceso a tablas
 * - Metadatas: especificación de permisos
 */

module.exports = {
  // DynamoDB Tables
  USUARIOS_TABLE: process.env.USUARIOS_TABLE || 'Usuarios',
  AGENDA_TABLE: process.env.AGENDA_TABLE || 'AgendaFonoaudiologia',
  APODERADOS_TABLE: process.env.APODERADOS_TABLE || 'Apoderados',
  APODERADO_ALUMNO_TABLE: process.env.APODERADO_ALUMNO_TABLE || 'ApoderadoAlumno',
  ASISTENCIA_TABLE: process.env.ASISTENCIA_TABLE || 'Asistencia',
  COMUNICACIONES_TABLE: process.env.COMUNICACIONES_TABLE || 'Comunicaciones',
  CONFIGURACION_TABLE: process.env.CONFIGURACION_TABLE || 'Configuracion',
  INFORMES_TABLE: process.env.INFORMES_TABLE || 'Informes',
  MATERIAL_CATEGORIAS_TABLE: process.env.MATERIAL_CATEGORIAS_TABLE || 'MaterialCategorias',
  PROFESOR_CURSO_TABLE: process.env.PROFESOR_CURSO_TABLE || 'ProfesorCurso',
  RECURSOS_TABLE: process.env.RECURSOS_TABLE || 'RecursosAcademicos',
  REPORTES_TABLE: process.env.REPORTES_TABLE || 'Reportes',
  RETROALIMENTACION_TABLE: process.env.RETROALIMENTACION_TABLE || 'Retroalimentacion',
};
