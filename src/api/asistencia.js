const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { authorize } = require('/opt/nodejs/authMiddleware');
const { success, badRequest, serverError, parseBody } = require('/opt/nodejs/responseHelper');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const ASISTENCIA_TABLE = process.env.ASISTENCIA_TABLE;

exports.handler = async (event) => {
  const { httpMethod, queryStringParameters } = event;

  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // POST: Registrar asistencia de múltiples alumnos
    if (httpMethod === 'POST') {
      const data = parseBody(event);

      if (!data.curso || !data.fecha || !data.alumnos || !Array.isArray(data.alumnos)) {
        return badRequest('Campos requeridos: curso, fecha, alumnos[]');
      }

      const registros = data.alumnos.map(alumno => ({
        id: uuidv4(),
        curso: data.curso,
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

        return success(result.Items || []);
      }

      // Sin parámetros: devolver array vacío o todos los registros recientes
      // Para evitar scan completo, devolvemos vacío
      return success([]);
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
