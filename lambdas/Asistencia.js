const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    const { cursoId, fecha, alumnos } = JSON.parse(event.body || '{}');
    const id = `${cursoId}#${fecha}`;

    switch (method) {
      case 'POST': // Registrar asistencia del día
        if (!cursoId || !fecha || !alumnos || !Array.isArray(alumnos)) {
          return { statusCode: 400, body: JSON.stringify({ message: 'Faltan datos para registrar asistencia' }) };
        }

        // Verificar si ya hay un registro para ese curso y fecha
        const existing = await dynamodb.get({ TableName: TABLE_NAME, Key: { id } }).promise();
        if (existing.Item) {
          return { statusCode: 400, body: JSON.stringify({ message: 'Ya existe registro de asistencia para este curso y fecha' }) };
        }

        // Guardar asistencia
        await dynamodb.put({
          TableName: TABLE_NAME,
          Item: { id, cursoId, fecha, alumnos }
        }).promise();
        return { statusCode: 200, body: JSON.stringify({ message: 'Asistencia registrada correctamente' }) };

      case 'PUT': // Modificar asistencia de alumnos existentes
        if (!cursoId || !fecha || !alumnos || !Array.isArray(alumnos)) {
          return { statusCode: 400, body: JSON.stringify({ message: 'Faltan datos para modificar asistencia' }) };
        }

        // Actualizar solo los alumnos que vienen en la lista, respetando los demás
        const current = await dynamodb.get({ TableName: TABLE_NAME, Key: { id } }).promise();
        if (!current.Item) {
          return { statusCode: 404, body: JSON.stringify({ message: 'Registro no encontrado' }) };
        }

        const updatedAlumnos = current.Item.alumnos.map(a => {
          const nuevo = alumnos.find(x => x.alumnoId === a.alumnoId);
          return nuevo ? { ...a, estado: nuevo.estado } : a;
        });

        await dynamodb.update({
          TableName: TABLE_NAME,
          Key: { id },
          UpdateExpression: 'SET alumnos = :a',
          ExpressionAttributeValues: { ':a': updatedAlumnos },
          ReturnValues: 'ALL_NEW'
        }).promise();

        return { statusCode: 200, body: JSON.stringify({ message: 'Asistencia modificada', alumnos: updatedAlumnos }) };

      case 'GET': // Listar asistencias por curso y/o fecha
        const params = {};
        if (cursoId && fecha) {
          params.Key = { id: `${cursoId}#${fecha}` };
          const result = await dynamodb.get({ TableName: TABLE_NAME, Key: params.Key }).promise();
          return { statusCode: 200, body: JSON.stringify({ asistencia: result.Item || null }) };
        } else if (cursoId) {
          // Listar todas las fechas de un curso
          const result = await dynamodb.scan({ TableName: TABLE_NAME, FilterExpression: 'cursoId = :c', ExpressionAttributeValues: { ':c': cursoId } }).promise();
          return { statusCode: 200, body: JSON.stringify({ asistencias: result.Items }) };
        } else {
          const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
          return { statusCode: 200, body: JSON.stringify({ asistencias: result.Items }) };
        }

      case 'DELETE': // Eliminar registro completo de un curso y fecha
        if (!cursoId || !fecha) {
          return { statusCode: 400, body: JSON.stringify({ message: 'Faltan datos para eliminar asistencia' }) };
        }
        await dynamodb.delete({ TableName: TABLE_NAME, Key: { id } }).promise();
        return { statusCode: 200, body: JSON.stringify({ message: 'Registro de asistencia eliminado correctamente' }) };

      default:
        return { statusCode: 405, body: JSON.stringify({ message: 'Método no permitido' }) };
    }

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Error interno', error: err.message }) };
  }
};
