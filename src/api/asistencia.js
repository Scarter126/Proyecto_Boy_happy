const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { authorize } = require('/opt/nodejs/authMiddleware');
const docClient = new AWS.DynamoDB.DocumentClient();

const ASISTENCIA_TABLE = process.env.ASISTENCIA_TABLE;

exports.handler = async (event) => {
  const { httpMethod, body, queryStringParameters } = event;

  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }
    // POST: Registrar asistencia de múltiples alumnos
    if (httpMethod === 'POST') {
      const data = JSON.parse(body);

      if (!data.curso || !data.fecha || !data.alumnos || !Array.isArray(data.alumnos)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Faltan campos requeridos: curso, fecha, alumnos[]' })
        };
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

      // Registrar todos los alumnos
      for (const registro of registros) {
        await docClient.put({
          TableName: ASISTENCIA_TABLE,
          Item: registro
        }).promise();
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Asistencia registrada correctamente',
          registrados: registros.length
        })
      };
    }

    // GET: Consultar asistencia por curso+fecha o por alumno
    if (httpMethod === 'GET') {
      // Buscar por curso y fecha
      if (queryStringParameters?.curso && queryStringParameters?.fecha) {
        const result = await docClient.query({
          TableName: ASISTENCIA_TABLE,
          IndexName: 'CursoFechaIndex',
          KeyConditionExpression: 'curso = :c AND fecha = :f',
          ExpressionAttributeValues: {
            ':c': queryStringParameters.curso,
            ':f': queryStringParameters.fecha
          }
        }).promise();

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.Items)
        };
      }

      // Buscar por alumno
      if (queryStringParameters?.rutAlumno) {
        const result = await docClient.query({
          TableName: ASISTENCIA_TABLE,
          IndexName: 'AlumnoIndex',
          KeyConditionExpression: 'rutAlumno = :r',
          ExpressionAttributeValues: {
            ':r': queryStringParameters.rutAlumno
          }
        }).promise();

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.Items)
        };
      }

      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Parámetros requeridos: (curso + fecha) o rutAlumno'
        })
      };
    }

    // PUT: Actualizar un registro de asistencia específico
    if (httpMethod === 'PUT') {
      const { id } = queryStringParameters || {};

      if (!id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'ID requerido' })
        };
      }

      const data = JSON.parse(body);

      await docClient.update({
        TableName: ASISTENCIA_TABLE,
        Key: { id },
        UpdateExpression: 'SET estado = :e, observacion = :o',
        ExpressionAttributeValues: {
          ':e': data.estado,
          ':o': data.observacion || ''
        }
      }).promise();

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Asistencia actualizada' })
      };
    }

    // DELETE: Eliminar un registro de asistencia
    if (httpMethod === 'DELETE') {
      const { id } = queryStringParameters || {};

      if (!id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'ID requerido' })
        };
      }

      await docClient.delete({
        TableName: ASISTENCIA_TABLE,
        Key: { id }
      }).promise();

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Asistencia eliminada' })
      };
    }

    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Método no permitido' })
    };

  } catch (error) {
    console.error('Error en asistencia:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Error interno del servidor',
        details: error.message
      })
    };
  }
};
