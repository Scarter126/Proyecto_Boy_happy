const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { authorize } = require('/opt/nodejs/authMiddleware');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONFIG_TABLE = process.env.CONFIGURACION_TABLE;

/**
 * CU-11: Configurar parámetros globales
 */
exports.handler = async (event) => {
  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, queryStringParameters } = event;

    if (httpMethod === 'GET') {
      if (queryStringParameters?.key) {
        const result = await docClient.send(new GetCommand({
          TableName: CONFIG_TABLE,
          Key: { id: queryStringParameters.key }
        }));
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result.Item || {}) };
      }
      const result = await docClient.send(new ScanCommand({ TableName: CONFIG_TABLE }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parametros: result.Items, total: result.Items.length }) };
    }

    if (httpMethod === 'PUT') {
      const data = JSON.parse(event.body);
      for (const param of data.parametros) {
        await docClient.send(new PutCommand({
          TableName: CONFIG_TABLE,
          Item: { id: param.id, valor: param.valor, timestamp: new Date().toISOString() }
        }));
      }
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Parámetros actualizados' }) };
    }

    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Método no soportado' }) };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
