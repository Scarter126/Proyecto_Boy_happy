const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, getCorsHeaders, serverError, parseBody } = requireLayer('responseHelper');
const { obtenerCursosProfesor } = requireLayer('relaciones');
const TABLE_NAMES = require('../shared/table-names.cjs');
const TABLE_KEYS = require('../shared/table-keys.cjs');

exports.metadata = {
  route: '/asistencia',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  auth: true,
  roles: ['admin', 'profesor', 'fono'],
  profile: 'medium',
  tables: [TABLE_KEYS.ASISTENCIA_TABLE],
  additionalPolicies: []
};

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const ASISTENCIA_TABLE = TABLE_NAMES.ASISTENCIA_TABLE;

exports.handler = async (event) => {
  const { httpMethod, queryStringParameters } = event;

  try {
    const corsHeaders = getCorsHeaders(event);
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // POST: Registrar asistencia de múltiples alumnos
    if (httpMethod === 'POST') {
      const data = parseBody(event);

      if (!data.fecha || !data.alumnos || !Array.isArray(data.alumnos)) {
        return badRequest('Campos requeridos: fecha, alumnos[]');
      }

      const registros = data.alumnos.map(alumno => ({
        id: uuidv4(),
        curso: data.curso || 'GENERAL', // DynamoDB GSI requires non-empty string
        fecha: data.fecha,
        rutAlumno: alumno.rut,
        nombreAlumno: alumno.nombre,
        estado: alumno.estado, // 'presente', 'ausente', 'atrasado'
        observacion: alumno.observacion || '',
        timestamp: new Date().toISOString()
      }));

      // Registrar todos los alumnos con manejo de errores individual
      const errores = [];
      for (const registro of registros) {
        try {
          await docClient.send(new PutCommand({
            TableName: ASISTENCIA_TABLE,
            Item: registro
          }));
        } catch (err) {
          console.error('Error registrando asistencia:', err);
          errores.push({ rut: registro.rutAlumno, error: err.message });
        }
      }

      if (errores.length > 0) {
        return success({
          message: 'Asistencia registrada con errores parciales',
          registrados: registros.length - errores.length,
          errores
        }, 207); // Multi-Status
      }

      return success({
        message: 'Asistencia registrada correctamente',
        registrados: registros.length
      });
    }

    // GET: Consultar asistencia por curso+fecha o por alumno
    if (httpMethod === 'GET') {
      // SECURITY: Role-based filtering for profesores
      let cursosAutorizados = null;
      if (authResult.user.rol === 'profesor') {
        const cursosProfesor = await obtenerCursosProfesor(authResult.user.rut);
        cursosAutorizados = cursosProfesor
          .filter(c => c.activo)
          .map(c => c.curso);

        // Si se especifica un curso, validar autorización
        if (queryStringParameters?.curso && !cursosAutorizados.includes(queryStringParameters.curso)) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'No autorizado para acceder a asistencia de este curso' })
          };
        }
      }

      // Buscar por curso y fecha
      if (queryStringParameters?.curso && queryStringParameters?.fecha) {
        const result = await docClient.send(new QueryCommand({
          TableName: ASISTENCIA_TABLE,
          IndexName: 'CursoFechaIndex',
          KeyConditionExpression: 'curso = :c AND fecha = :f',
          ExpressionAttributeValues: {
            ':c': queryStringParameters.curso,
            ':f': queryStringParameters.fecha
          }
        }));

        return success(result.Items || []);
      }

      // Buscar por alumno
      if (queryStringParameters?.rutAlumno) {
        const result = await docClient.send(new QueryCommand({
          TableName: ASISTENCIA_TABLE,
          IndexName: 'AlumnoIndex',
          KeyConditionExpression: 'rutAlumno = :r',
          ExpressionAttributeValues: {
            ':r': queryStringParameters.rutAlumno
          }
        }));

        // Filter by authorized courses for profesores
        let filteredItems = result.Items || [];
        if (cursosAutorizados) {
          filteredItems = filteredItems.filter(item => cursosAutorizados.includes(item.curso));
        }

        return success(filteredItems);
      }

      // Buscar por fecha solamente (sin curso) - usar Scan con filtro
      if (queryStringParameters?.fecha) {
        const result = await docClient.send(new ScanCommand({
          TableName: ASISTENCIA_TABLE,
          FilterExpression: 'fecha = :f',
          ExpressionAttributeValues: {
            ':f': queryStringParameters.fecha
          },
          Limit: 1000
        }));

        // Filter by authorized courses for profesores
        let filteredItems = result.Items || [];
        if (cursosAutorizados) {
          filteredItems = filteredItems.filter(item => cursosAutorizados.includes(item.curso));
        }

        return success(filteredItems);
      }

      // Buscar por curso solamente (sin fecha) - usar Scan con filtro
      if (queryStringParameters?.curso) {
        const result = await docClient.send(new ScanCommand({
          TableName: ASISTENCIA_TABLE,
          FilterExpression: 'curso = :c',
          ExpressionAttributeValues: {
            ':c': queryStringParameters.curso
          },
          Limit: 1000
        }));

        return success(result.Items || []);
      }

      // Sin parámetros: hacer Scan para obtener todos los registros
      const result = await docClient.send(new ScanCommand({
        TableName: ASISTENCIA_TABLE,
        Limit: 1000 // Limitar a 1000 registros
      }));

      // Filter by authorized courses for profesores
      let filteredItems = result.Items || [];
      if (cursosAutorizados) {
        filteredItems = filteredItems.filter(item => cursosAutorizados.includes(item.curso));
      }

      return success(filteredItems);
    }

    // PUT: Actualizar un registro de asistencia específico
    if (httpMethod === 'PUT') {
      const { id } = queryStringParameters || {};

      if (!id) {
        return badRequest('ID requerido');
      }

      const data = parseBody(event);

      await docClient.send(new UpdateCommand({
        TableName: ASISTENCIA_TABLE,
        Key: { id },
        UpdateExpression: 'SET estado = :e, observacion = :o',
        ExpressionAttributeValues: {
          ':e': data.estado,
          ':o': data.observacion || ''
        }
      }));

      return success({ message: 'Asistencia actualizada' });
    }

    // DELETE: Eliminar un registro de asistencia
    if (httpMethod === 'DELETE') {
      const { id } = queryStringParameters || {};

      if (!id) {
        return badRequest('ID requerido');
      }

      await docClient.send(new DeleteCommand({
        TableName: ASISTENCIA_TABLE,
        Key: { id }
      }));

      return success({ message: 'Asistencia eliminada' });
    }

    return badRequest('Método no permitido');

  } catch (error) {
    console.error('Error en asistencia:', error);
    return serverError(error.message);
  }
};
