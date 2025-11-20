const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const requireLayer = require('./requireLayer');
const { authorize, ROLES } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError } = requireLayer('responseHelper');
const { obtenerCursosProfesor } = requireLayer('relaciones');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const APODERADO_ALUMNO_TABLE = process.env.APODERADO_ALUMNO_TABLE;
const USUARIOS_TABLE = process.env.USUARIOS_TABLE;

/**
 * API para gestionar información de alumnos
 * - GET /alumnos/por-curso/:curso - Obtener alumnos de un curso
 * - GET /alumnos/:rut/curso - Obtener curso de un alumno
 */
exports.handler = async (event) => {
  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, path } = event;

    console.log('[DEBUG alumnos.js] httpMethod:', httpMethod, 'path:', path);

    // ========================================
    // GET /alumnos/por-curso/:curso
    // ========================================
    // Match both with and without /api prefix since dev server might include it
    const porCursoMatch = path.match(/^\/alumnos\/por-curso\/[^/]+$/) || path.match(/^\/api\/alumnos\/por-curso\/[^/]+$/);
    console.log('[DEBUG alumnos.js] porCursoMatch:', porCursoMatch, 'httpMethod === GET:', httpMethod === 'GET');

    if (httpMethod === 'GET' && porCursoMatch) {
      const curso = path.split('/').pop();
      console.log('[DEBUG alumnos.js] Querying for curso:', curso);

      // Validar acceso al curso según rol
      if (authResult.user.rol === 'profesor') {
        try {
          const cursosProfesor = await obtenerCursosProfesor(authResult.user.rut);
          const tieneAcceso = cursosProfesor.some(c => c.curso === curso && c.activo);

          if (!tieneAcceso) {
            return {
              statusCode: 403,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ error: `No tiene acceso al curso ${curso}` })
            };
          }
        } catch (error) {
          console.error('Error validando acceso al curso:', error);
        }
      }
      // Admin y fono tienen acceso a todos los cursos

      // Obtener alumnos del curso desde la tabla de relaciones
      const result = await docClient.send(new QueryCommand({
        TableName: APODERADO_ALUMNO_TABLE,
        IndexName: 'CursoIndex',
        KeyConditionExpression: 'curso = :curso',
        ExpressionAttributeValues: { ':curso': curso }
      }));

      console.log('[DEBUG alumnos.js] DynamoDB query result:', result.Items?.length || 0, 'items');

      if (!result.Items || result.Items.length === 0) {
        console.log('[DEBUG alumnos.js] No students found for curso:', curso);
        return success([]);
      }

      // Obtener información completa de los usuarios alumnos
      const alumnosRuts = result.Items.map(item => item.alumnoRut);
      const usuariosResult = await docClient.send(new ScanCommand({
        TableName: USUARIOS_TABLE
      }));

      // Filtrar solo los alumnos del curso y agregar el campo curso
      const alumnos = usuariosResult.Items
        .filter(u => u.rol === 'alumno' && alumnosRuts.includes(u.rut))
        .map(alumno => {
          const relacion = result.Items.find(r => r.alumnoRut === alumno.rut);
          return {
            ...alumno,
            cursoActual: curso,
            apoderadoRut: relacion?.apoderadoRut,
            relacionParentesco: relacion?.relacionParentesco,
            esTitular: relacion?.esTitular || false
          };
        });

      console.log('[DEBUG alumnos.js] Returning', alumnos.length, 'students for curso:', curso);
      return success(alumnos);
    }

    // ========================================
    // GET /alumnos/:rut/curso
    // ========================================
    if (httpMethod === 'GET' && (path.match(/^\/alumnos\/[^/]+\/curso$/) || path.match(/^\/api\/alumnos\/[^/]+\/curso$/))) {
      const rut = path.split('/')[2];

      // Validar que el usuario tenga permiso para consultar este alumno
      if (authResult.user.rol === 'alumno' && authResult.user.rut !== rut) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No tiene permiso para consultar este alumno' })
        };
      }

      // Buscar el curso del alumno en la tabla de relaciones
      const result = await docClient.send(new QueryCommand({
        TableName: APODERADO_ALUMNO_TABLE,
        IndexName: 'AlumnoIndex',
        KeyConditionExpression: 'alumnoRut = :rut',
        ExpressionAttributeValues: { ':rut': rut },
        Limit: 1
      }));

      if (!result.Items || result.Items.length === 0) {
        return notFound(`No se encontró curso para el alumno con RUT ${rut}`);
      }

      const relacion = result.Items[0];

      // Validar acceso del profesor al curso del alumno
      if (authResult.user.rol === 'profesor') {
        const cursosProfesor = await obtenerCursosProfesor(authResult.user.rut);
        const tieneAcceso = cursosProfesor.some(c => c.curso === relacion.curso && c.activo);

        if (!tieneAcceso) {
          return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: `No tiene acceso al curso del alumno` })
          };
        }
      }

      return success({
        alumnoRut: rut,
        curso: relacion.curso,
        apoderadoRut: relacion.apoderadoRut,
        relacionParentesco: relacion.relacionParentesco,
        esTitular: relacion.esTitular || false
      });
    }

    return badRequest('Ruta no soportada');

  } catch (error) {
    console.error('Error en alumnos.js:', error);
    return serverError(error.message);
  }
};
