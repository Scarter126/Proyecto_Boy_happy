const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = requireLayer('responseHelper');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const RECURSOS_TABLE = process.env.RECURSOS_TABLE;

/**
 * Helper: Construir árbol jerárquico de categorías
 */
function buildTree(categorias, parentId = 'ROOT') {
  const children = categorias
    .filter(cat => (cat.parentId || 'ROOT') === parentId)
    .map(cat => ({
      ...cat,
      children: buildTree(categorias, cat.id)
    }));

  return children;
}

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

    const { httpMethod, path, queryStringParameters } = event;

    // POST: Crear categoría (CU-08)
    if (httpMethod === 'POST' && path === '/categorias') {
      const body = parseBody(event);

      if (!body || !body.nombre) {
        return badRequest('El campo "nombre" es requerido');
      }

      const item = {
        id: `categoria-${uuidv4()}`,
        tipo: 'categoria',
        nombre: body.nombre,
        descripcion: body.descripcion || '',
        color: body.color || '#667eea',
        icono: body.icono || 'fa-folder',
        tipoRecurso: body.tipoRecurso || 'general',
        parentId: body.parentId || 'ROOT', // ROOT para categorías raíz (DynamoDB GSI no permite null)
        activa: body.activa !== false,
        timestamp: new Date().toISOString()
      };

      console.log('Creando categoría:', JSON.stringify(item, null, 2));
      console.log('Tabla RECURSOS_TABLE:', RECURSOS_TABLE);

      try {
        await docClient.send(new PutCommand({ TableName: RECURSOS_TABLE, Item: item }));
        console.log('Categoría creada exitosamente:', item.id);
        return success(item);
      } catch (dbError) {
        console.error('Error de DynamoDB:', dbError);
        return serverError(`Error al guardar en DynamoDB: ${dbError.message}`);
      }
    }

    // GET: Listar categorías
    if (httpMethod === 'GET' && path === '/categorias') {
      const result = await docClient.send(new ScanCommand({
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo',
        ExpressionAttributeNames: { '#tipo': 'tipo' },
        ExpressionAttributeValues: { ':tipo': 'categoria' }
      }));

      return success({
        categorias: result.Items,
        total: result.Items.length
      });
    }

    // PUT: Actualizar categoría (CU-09)
    if (httpMethod === 'PUT' && queryStringParameters?.id) {
      const body = parseBody(event);

      if (!body) {
        return badRequest('Body inválido o vacío');
      }

      const updateParts = [];
      const attrValues = {};

      if (body.nombre) {
        updateParts.push('nombre = :nombre');
        attrValues[':nombre'] = body.nombre;
      }

      if (body.descripcion !== undefined) {
        updateParts.push('descripcion = :desc');
        attrValues[':desc'] = body.descripcion;
      }

      if (body.color) {
        updateParts.push('color = :color');
        attrValues[':color'] = body.color;
      }

      if (body.icono) {
        updateParts.push('icono = :icono');
        attrValues[':icono'] = body.icono;
      }

      if (body.activa !== undefined) {
        updateParts.push('activa = :activa');
        attrValues[':activa'] = body.activa;
      }

      if (body.parentId !== undefined) {
        updateParts.push('parentId = :parentId');
        attrValues[':parentId'] = body.parentId || 'ROOT'; // ROOT para categorías raíz
      }

      if (updateParts.length === 0) {
        return badRequest('No hay campos para actualizar');
      }

      updateParts.push('ultimaModificacion = :ts');
      attrValues[':ts'] = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: RECURSOS_TABLE,
        Key: { id: queryStringParameters.id, tipo: 'categoria' },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: attrValues
      }));

      return success({ message: 'Categoría actualizada correctamente' });
    }

    // DELETE: Eliminar categoría (CU-10)
    if (httpMethod === 'DELETE' && queryStringParameters?.id) {
      const categoriaId = queryStringParameters.id;

      // Verificar si hay archivos asignados a esta categoría
      const materialesResult = await docClient.send(new ScanCommand({
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo AND categoria = :catId',
        ExpressionAttributeNames: { '#tipo': 'tipo' },
        ExpressionAttributeValues: { ':tipo': 'material', ':catId': categoriaId }
      }));

      if (materialesResult.Items && materialesResult.Items.length > 0) {
        return badRequest(
          'No se puede eliminar la categoría porque tiene archivos asignados. Reasigna los archivos primero.',
          {
            archivosAsignados: materialesResult.Items.length,
            archivos: materialesResult.Items.map(m => ({ id: m.id, titulo: m.titulo }))
          }
        );
      }

      // Si no hay archivos asignados, proceder con la eliminación
      await docClient.send(new DeleteCommand({
        TableName: RECURSOS_TABLE,
        Key: { id: categoriaId, tipo: 'categoria' }
      }));

      return success({ message: 'Categoría eliminada correctamente' });
    }

    // GET: Obtener árbol jerárquico completo
    if (httpMethod === 'GET' && path === '/categorias/arbol') {
      const result = await docClient.send(new ScanCommand({
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo',
        ExpressionAttributeNames: { '#tipo': 'tipo' },
        ExpressionAttributeValues: { ':tipo': 'categoria' }
      }));

      const categorias = result.Items || [];
      const arbol = buildTree(categorias);

      return success({
        arbol,
        total: categorias.length
      });
    }

    // GET: Obtener subcategorías de un parent específico
    if (httpMethod === 'GET' && path === '/categorias/subcategorias' && queryStringParameters?.parentId) {
      const parentId = queryStringParameters.parentId;

      // Usar GSI ParentCategoriaIndex
      const result = await docClient.send(new QueryCommand({
        TableName: RECURSOS_TABLE,
        IndexName: 'ParentCategoriaIndex',
        KeyConditionExpression: 'parentId = :pid',
        ExpressionAttributeValues: { ':pid': parentId }
      }));

      return success({
        subcategorias: result.Items || [],
        parentId,
        count: result.Items?.length || 0
      });
    }

    return badRequest(`Ruta ${httpMethod} ${path} no soportada`);

  } catch (error) {
    console.error('Error en categorias.js:', error);
    return serverError(error.message);
  }
};
