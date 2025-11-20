/**
 * Shared Helper Functions
 * Funciones utilitarias compartidas entre múltiples lambdas
 */

const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Busca un item por ID en una tabla DynamoDB
 * @param {string} tableName - Nombre de la tabla
 * @param {string} id - ID del item a buscar
 * @returns {Promise<Object|null>} - El item encontrado o null
 *
 * NOTA: Usa Scan en lugar de Get porque 'id' no es la partition key.
 * No se usa Limit: 1 porque detiene el scan después de examinar 1 item,
 * no después de encontrar 1 match.
 */
async function getItemById(tableName, id) {
  const result = await docClient.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: { ':id': id }
  }));

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

module.exports = {
  getItemById
};
