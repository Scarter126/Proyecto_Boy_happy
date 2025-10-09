const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { success, badRequest, notFound, serverError, parseBody } = require('/opt/nodejs/responseHelper');

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
    const { httpMethod, queryStringParameters } = event;

    if (httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const item = {
        rutUsuario: data.rutUsuario,
        timestamp: new Date().toISOString(),
        id: `retro-${uuidv4()}`,
        nombreUsuario: data.nombreUsuario,
        tipo: data.tipo,
        contenido: data.contenido,
        visibilidad: data.visibilidad || 'privada',
        ambito: data.ambito,
        curso: data.curso,
        creadoPor: data.creadoPor,
        fecha: new Date().toISOString().split('T')[0],
        leida: false
      };
      await docClient.send(new PutCommand({ TableName: RETRO_TABLE, Item: item }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) };
    }

    if (httpMethod === 'GET') {
      // Si se proporciona rutUsuario, buscar por usuario
      if (queryStringParameters?.rutUsuario) {
        const result = await docClient.send(new QueryCommand({
          TableName: RETRO_TABLE,
          KeyConditionExpression: 'rutUsuario = :rut',
          ExpressionAttributeValues: { ':rut': queryStringParameters.rutUsuario }
        }));
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result.Items || []) };
      }

      // Si no hay rutUsuario, hacer scan (para admin)
      const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
      const result = await docClient.send(new ScanCommand({
        TableName: RETRO_TABLE
      }));

      // Filtrar por tipo si se especifica
      let items = result.Items || [];
      if (queryStringParameters?.tipo) {
        items = items.filter(item => item.tipo === queryStringParameters.tipo);
      }

      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) };
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

    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Método no soportado' }) };
  } catch (error) {
    console.error('Error en retroalimentacion:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
