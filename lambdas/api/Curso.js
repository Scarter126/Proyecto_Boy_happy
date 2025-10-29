const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    const { id, nombre } = JSON.parse(event.body || '{}');

    switch (method) {
      case 'POST': // Crear curso
        if (!id || !nombre) {
          return { statusCode: 400, body: JSON.stringify({ message: 'Faltan datos para crear curso' }) };
        }
        await dynamodb.put({
          TableName: TABLE_NAME,
          Item: { id, nombre }
        }).promise();
        return { statusCode: 200, body: JSON.stringify({ message: 'Curso creado correctamente' }) };

      case 'PUT': // Modificar curso
        if (!id || !nombre) {
          return { statusCode: 400, body: JSON.stringify({ message: 'Faltan datos para modificar curso' }) };
        }
        const updateParams = {
          TableName: TABLE_NAME,
          Key: { id },
          UpdateExpression: 'SET nombre = :n',
          ExpressionAttributeValues: {
            ':n': nombre
          },
          ReturnValues: 'ALL_NEW'
        };
        const updated = await dynamodb.update(updateParams).promise();
        return { statusCode: 200, body: JSON.stringify({ message: 'Curso modificado', curso: updated.Attributes }) };

      case 'DELETE': // Eliminar curso
        if (!id) {
          return { statusCode: 400, body: JSON.stringify({ message: 'Falta el ID del curso' }) };
        }
        await dynamodb.delete({ TableName: TABLE_NAME, Key: { id } }).promise();
        return { statusCode: 200, body: JSON.stringify({ message: 'Curso eliminado correctamente' }) };

      case 'GET': // Listar cursos
        const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
        return { statusCode: 200, body: JSON.stringify({ cursos: result.Items }) };

      default:
        return { statusCode: 405, body: JSON.stringify({ message: 'Método no permitido' }) };
    }

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Error interno', error: err.message }) };
  }
};
