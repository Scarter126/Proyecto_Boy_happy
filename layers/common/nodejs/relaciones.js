/**
 * Utilidades para trabajar con las tablas de relaciones
 * Apoderados, ApoderadoAlumno y ProfesorCurso
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const TABLE_NAMES = require('./table-names.cjs');

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Constantes de tablas (única fuente de verdad)
const APODERADO_ALUMNO_TABLE = TABLE_NAMES.APODERADO_ALUMNO_TABLE;
const PROFESOR_CURSO_TABLE = TABLE_NAMES.PROFESOR_CURSO_TABLE;

/**
 * Obtiene el curso de un alumno desde la tabla ApoderadoAlumno
 * @param {string} alumnoRut - RUT del alumno
 * @returns {Promise<string|null>} - Curso del alumno o null si no se encuentra
 */
async function obtenerCursoAlumno(alumnoRut) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: APODERADO_ALUMNO_TABLE,
      IndexName: 'AlumnoIndex',
      KeyConditionExpression: 'alumnoRut = :rut',
      ExpressionAttributeValues: {
        ':rut': alumnoRut
      },
      Limit: 1 // Solo necesitamos uno
    }));

    if (result.Items && result.Items.length > 0) {
      return result.Items[0].curso || null;
    }

    return null;

  } catch (error) {
    console.error('Error obteniendo curso del alumno:', error);
    throw error;
  }
}

/**
 * Obtiene todos los apoderados de un alumno
 * @param {string} alumnoRut - RUT del alumno
 * @returns {Promise<Array>} - Array de relaciones apoderado-alumno
 */
async function obtenerApoderadosAlumno(alumnoRut) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: APODERADO_ALUMNO_TABLE,
      IndexName: 'AlumnoIndex',
      KeyConditionExpression: 'alumnoRut = :rut',
      ExpressionAttributeValues: {
        ':rut': alumnoRut
      }
    }));

    return result.Items || [];

  } catch (error) {
    console.error('Error obteniendo apoderados del alumno:', error);
    throw error;
  }
}

/**
 * Obtiene todos los alumnos de un apoderado
 * @param {string} apoderadoRut - RUT del apoderado
 * @returns {Promise<Array>} - Array de relaciones apoderado-alumno
 */
async function obtenerAlumnosApoderado(apoderadoRut) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: APODERADO_ALUMNO_TABLE,
      KeyConditionExpression: 'apoderadoRut = :rut',
      ExpressionAttributeValues: {
        ':rut': apoderadoRut
      }
    }));

    return result.Items || [];

  } catch (error) {
    console.error('Error obteniendo alumnos del apoderado:', error);
    throw error;
  }
}

/**
 * Obtiene todos los cursos asignados a un profesor
 * @param {string} profesorRut - RUT del profesor
 * @returns {Promise<Array>} - Array de asignaciones profesor-curso
 */
async function obtenerCursosProfesor(profesorRut) {
  try {
    console.log("TIPO RUT:", typeof profesorRut, profesorRut);

    // ⛔ SI viene null, devolvemos [] inmediatamente
    if (!profesorRut || typeof profesorRut !== "string") {
      console.warn("⚠️ profesorRut inválido:", profesorRut);
      return [];
    }

    const result = await docClient.send(new QueryCommand({
      TableName: PROFESOR_CURSO_TABLE,
      KeyConditionExpression: 'profesorRut = :rut',
      ExpressionAttributeValues: {
        ':rut': profesorRut.trim()
      }
    }));

    const cursos = (result.Items || []).map(item => {
      const partes = item.cursoTipo.split('#');
      return {
        profesorRut: item.profesorRut,
        curso: partes[0],
        tipo: partes[1],
        asignatura: partes[2] || null,
        activo: item.activo,
        fechaAsignacion: item.fechaAsignacion
      };
    });

    return cursos;

  } catch (error) {
    console.error('Error obteniendo cursos del profesor:', error);
    throw error;
  }
}

/**
 * Obtiene todos los profesores de un curso
 * @param {string} curso - ID del curso (ej: "1A")
 * @returns {Promise<Object>} - Objeto con profesor jefe y profesores de asignatura
 */
async function obtenerProfesoresCurso(curso) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: PROFESOR_CURSO_TABLE,
      IndexName: 'CursoIndex',
      KeyConditionExpression: 'curso = :curso',
      ExpressionAttributeValues: {
        ':curso': curso
      }
    }));

    // Agrupar por tipo
    const profesores = {
      jefe: null,
      asignaturas: []
    };

    for (const item of result.Items || []) {
      if (!item.activo) continue; // Ignorar inactivos

      if (item.tipo === 'jefe') {
        profesores.jefe = {
          profesorRut: item.profesorRut,
          curso: item.curso,
          fechaAsignacion: item.fechaAsignacion
        };
      } else if (item.tipo === 'asignatura') {
        const partes = item.cursoTipo.split('#');
        profesores.asignaturas.push({
          profesorRut: item.profesorRut,
          curso: item.curso,
          asignatura: partes[2] || null,
          fechaAsignacion: item.fechaAsignacion
        });
      }
    }

    return profesores;

  } catch (error) {
    console.error('Error obteniendo profesores del curso:', error);
    throw error;
  }
}

/**
 * Verifica si un profesor es jefe de un curso específico
 * @param {string} profesorRut - RUT del profesor
 * @param {string} curso - ID del curso
 * @returns {Promise<boolean>} - true si es jefe del curso, false si no
 */
async function esProfesorJefe(profesorRut, curso) {
  try {
    const cursoTipo = `${curso}#jefe`;

    const result = await docClient.send(new GetCommand({
      TableName: PROFESOR_CURSO_TABLE,
      Key: {
        profesorRut,
        cursoTipo
      }
    }));

    return result.Item && result.Item.activo;

  } catch (error) {
    console.error('Error verificando profesor jefe:', error);
    throw error;
  }
}

module.exports = {
  obtenerCursoAlumno,
  obtenerApoderadosAlumno,
  obtenerAlumnosApoderado,
  obtenerCursosProfesor,
  obtenerProfesoresCurso,
  esProfesorJefe
};
