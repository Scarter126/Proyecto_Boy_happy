const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { authorize } = require('/opt/nodejs/authMiddleware');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const RECURSOS_TABLE = process.env.RECURSOS_TABLE;

/**
 * CU-08: Crear categorías
 * CU-09: Modificar categorías
 * CU-10: Eliminar categorías
 */
exports.handler = async (event) => {
  try {
    // Validar autorización (usa matriz de permisos del middleware)
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, resource, queryStringParameters } = event;

    if (httpMethod === 'POST' && resource === '/categorias') {
      const data = JSON.parse(event.body);
      const item = {
        id: `categoria-${uuidv4()}`,
        tipo: 'categoria',
        nombre: data.nombre,
        descripcion: data.descripcion || '',
        color: data.color || '#000000',
        icono: data.icono || 'fa-folder',
        tipoRecurso: data.tipoRecurso || 'general',
        activa: data.activa !== false,
        timestamp: new Date().toISOString()
      };
      await docClient.send(new PutCommand({ TableName: RECURSOS_TABLE, Item: item }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) };
    }

    if (httpMethod === 'GET' && resource === '/categorias') {
      const result = await docClient.send(new ScanCommand({
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo',
        ExpressionAttributeNames: { '#tipo': 'tipo' },
        ExpressionAttributeValues: { ':tipo': 'categoria' }
      }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categorias: result.Items, total: result.Items.length }) };
    }

    if (httpMethod === 'PUT' && queryStringParameters?.id) {
      const data = JSON.parse(event.body);
      const updateParts = [];
      const attrValues = {};
      if (data.nombre) { updateParts.push('nombre = :nombre'); attrValues[':nombre'] = data.nombre; }
      if (data.descripcion !== undefined) { updateParts.push('descripcion = :desc'); attrValues[':desc'] = data.descripcion; }
      if (data.color) { updateParts.push('color = :color'); attrValues[':color'] = data.color; }
      if (data.activa !== undefined) { updateParts.push('activa = :activa'); attrValues[':activa'] = data.activa; }
      updateParts.push('ultimaModificacion = :ts'); attrValues[':ts'] = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: RECURSOS_TABLE,
        Key: { id: queryStringParameters.id, tipo: 'categoria' },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: attrValues
      }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Categoría actualizada' }) };
    }

    if (httpMethod === 'DELETE' && queryStringParameters?.id) {
      const categoriaId = queryStringParameters.id;

      // CU-10: Verificar si hay archivos asignados a esta categoría
      const materialesResult = await docClient.send(new ScanCommand({
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo AND categoria = :catId',
        ExpressionAttributeNames: { '#tipo': 'tipo' },
        ExpressionAttributeValues: { ':tipo': 'material', ':catId': categoriaId }
      }));

      if (materialesResult.Items && materialesResult.Items.length > 0) {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'No se puede eliminar la categoría porque tiene archivos asignados',
            archivosAsignados: materialesResult.Items.length,
            accion: 'Reasigna los archivos a otra categoría antes de eliminar',
            archivos: materialesResult.Items.map(m => ({ id: m.id, titulo: m.titulo }))
          })
        };
      }

      // Si no hay archivos asignados, proceder con la eliminación
      await docClient.send(new DeleteCommand({
        TableName: RECURSOS_TABLE,
        Key: { id: categoriaId, tipo: 'categoria' }
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Categoría eliminada correctamente' })
      };
    }

    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Ruta no soportada' }) };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
