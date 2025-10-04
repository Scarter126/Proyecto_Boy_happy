const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const RETRO_TABLE = process.env.RETROALIMENTACION_TABLE;

/**
 * CU-20: Enviar retroalimentación
 * CU-21: Registrar observaciones
 * CU-22: Visualizar retroalimentaciones
 */
exports.handler = async (event) => {
  try {
    const { httpMethod, resource, queryStringParameters } = event;

    if (httpMethod === 'POST' && resource === '/retroalimentacion') {
      const data = JSON.parse(event.body);
      const item = {
        rutUsuario: data.rutUsuario,
        timestamp: new Date().toISOString(),
        id: `retro-${uuidv4()}`,
        origen: data.origen,
        tipo: data.tipo,
        remitente: data.remitente,
        contenido: data.contenido,
        fecha: new Date().toISOString().split('T')[0],
        leida: false,
        visibilidad: data.visibilidad || 'privada'
      };
      await docClient.send(new PutCommand({ TableName: RETRO_TABLE, Item: item }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) };
    }

    if (httpMethod === 'GET' && resource === '/retroalimentacion') {
      const result = await docClient.send(new QueryCommand({
        TableName: RETRO_TABLE,
        KeyConditionExpression: 'rutUsuario = :rut',
        ExpressionAttributeValues: { ':rut': queryStringParameters.rutUsuario }
      }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retroalimentaciones: result.Items, total: result.Items.length }) };
    }

    if (httpMethod === 'PUT' && queryStringParameters?.id) {
      const data = JSON.parse(event.body);
      await docClient.send(new UpdateCommand({
        TableName: RETRO_TABLE,
        Key: { rutUsuario: queryStringParameters.rutUsuario, timestamp: queryStringParameters.timestamp },
        UpdateExpression: 'SET leida = :leida, respuesta = :resp',
        ExpressionAttributeValues: { ':leida': data.leida, ':resp': data.respuesta }
      }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Actualizado' }) };
    }

    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Ruta no soportada' }) };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
