const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand, BatchWriteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError } = requireLayer('responseHelper');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const MATERIAL_CATEGORIAS_TABLE = process.env.MATERIAL_CATEGORIAS_TABLE;
const RECURSOS_TABLE = process.env.RECURSOS_TABLE;

/**
 * Lambda handler para gestionar relaciones Material-Categoría (Many-to-Many)
 *
 * Endpoints:
 * - POST /materiales/{materialId}/categorias - Agregar categoría a material
 * - DELETE /materiales/{materialId}/categorias/{categoriaId} - Quitar categoría
 * - GET /materiales/{materialId}/categorias - Listar categorías de un material
 * - GET /categorias/{categoriaId}/materiales - Listar materiales de una categoría
 * - PUT /materiales/{materialId}/categorias - Reemplazar todas las categorías
 */
exports.handler = async (event) => {
  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, path, queryStringParameters } = event;
    const user = authResult.user;

    // Extraer IDs del path
    const pathSegments = path.split('/').filter(Boolean);

    // ========================================
    // POST /materiales/{materialId}/categorias
    // Agregar categoría a un material
    // ========================================
    if (httpMethod === 'POST' && pathSegments[0] === 'materiales' && pathSegments[2] === 'categorias') {
      const materialId = pathSegments[1];
      const data = JSON.parse(event.body || '{}');
      const { categoriaId } = data;

      if (!categoriaId) {
        return badRequest('categoriaId es requerido');
      }

      // Verificar que el material existe
      const material = await docClient.send(new GetCommand({
        TableName: RECURSOS_TABLE,
        Key: { id: materialId, tipo: 'material' }
      }));

      if (!material.Item) {
        return notFound(`Material ${materialId} no encontrado`);
      }

      // Verificar que la categoría existe
      const categoria = await docClient.send(new GetCommand({
        TableName: RECURSOS_TABLE,
        Key: { id: categoriaId, tipo: 'categoria' }
      }));

      if (!categoria.Item) {
        return notFound(`Categoría ${categoriaId} no encontrada`);
      }

      // Crear relación
      await docClient.send(new PutCommand({
        TableName: MATERIAL_CATEGORIAS_TABLE,
        Item: {
          materialId,
          categoriaId,
          asignadoPor: user.email,
          fechaAsignacion: new Date().toISOString()
        }
      }));

      return success({
        message: 'Categoría agregada exitosamente',
        materialId,
        categoriaId,
        categoriaNombre: categoria.Item.nombre
      });
    }

    // ========================================
    // DELETE /materiales/{materialId}/categorias/{categoriaId}
    // Quitar categoría de un material
    // ========================================
    if (httpMethod === 'DELETE' && pathSegments[0] === 'materiales' && pathSegments[2] === 'categorias') {
      const materialId = pathSegments[1];
      const categoriaId = pathSegments[3];

      if (!categoriaId) {
        return badRequest('categoriaId es requerido');
      }

      await docClient.send(new DeleteCommand({
        TableName: MATERIAL_CATEGORIAS_TABLE,
        Key: { materialId, categoriaId }
      }));

      return success({
        message: 'Categoría eliminada exitosamente',
        materialId,
        categoriaId
      });
    }

    // ========================================
    // GET /materiales/{materialId}/categorias
    // Listar categorías de un material
    // ========================================
    if (httpMethod === 'GET' && pathSegments[0] === 'materiales' && pathSegments[2] === 'categorias') {
      const materialId = pathSegments[1];

      // Query en MaterialCategorias
      const result = await docClient.send(new QueryCommand({
        TableName: MATERIAL_CATEGORIAS_TABLE,
        KeyConditionExpression: 'materialId = :mid',
        ExpressionAttributeValues: { ':mid': materialId }
      }));

      const relaciones = result.Items || [];

      // Enriquecer con datos de categorías
      const categoriasEnriquecidas = await Promise.all(
        relaciones.map(async (rel) => {
          const cat = await docClient.send(new GetCommand({
            TableName: RECURSOS_TABLE,
            Key: { id: rel.categoriaId, tipo: 'categoria' }
          }));

          return {
            ...rel,
            categoria: cat.Item || null
          };
        })
      );

      return success({
        materialId,
        categorias: categoriasEnriquecidas.map(c => c.categoria).filter(Boolean),
        count: categoriasEnriquecidas.length
      });
    }

    // ========================================
    // GET /categorias/{categoriaId}/materiales
    // Listar materiales de una categoría
    // ========================================
    if (httpMethod === 'GET' && pathSegments[0] === 'categorias' && pathSegments[2] === 'materiales') {
      const categoriaId = pathSegments[1];

      // Query en CategoriaIndex (GSI)
      const result = await docClient.send(new QueryCommand({
        TableName: MATERIAL_CATEGORIAS_TABLE,
        IndexName: 'CategoriaIndex',
        KeyConditionExpression: 'categoriaId = :cid',
        ExpressionAttributeValues: { ':cid': categoriaId }
      }));

      const relaciones = result.Items || [];

      // Enriquecer con datos de materiales
      const materialesEnriquecidos = await Promise.all(
        relaciones.map(async (rel) => {
          const mat = await docClient.send(new GetCommand({
            TableName: RECURSOS_TABLE,
            Key: { id: rel.materialId, tipo: 'material' }
          }));

          return {
            ...rel,
            material: mat.Item || null
          };
        })
      );

      return success({
        categoriaId,
        materiales: materialesEnriquecidos.map(m => m.material).filter(Boolean),
        count: materialesEnriquecidos.length
      });
    }

    // ========================================
    // PUT /materiales/{materialId}/categorias
    // Reemplazar todas las categorías de un material
    // ========================================
    if (httpMethod === 'PUT' && pathSegments[0] === 'materiales' && pathSegments[2] === 'categorias') {
      const materialId = pathSegments[1];
      const data = JSON.parse(event.body || '{}');
      const { categoriaIds = [] } = data;

      if (!Array.isArray(categoriaIds)) {
        return badRequest('categoriaIds debe ser un array');
      }

      // 1. Obtener categorías actuales
      const current = await docClient.send(new QueryCommand({
        TableName: MATERIAL_CATEGORIAS_TABLE,
        KeyConditionExpression: 'materialId = :mid',
        ExpressionAttributeValues: { ':mid': materialId }
      }));

      const currentRelaciones = current.Items || [];

      // 2. Eliminar categorías actuales
      if (currentRelaciones.length > 0) {
        const deleteRequests = currentRelaciones.map(rel => ({
          DeleteRequest: {
            Key: {
              materialId: rel.materialId,
              categoriaId: rel.categoriaId
            }
          }
        }));

        // BatchWrite en lotes de 25 (límite de DynamoDB)
        for (let i = 0; i < deleteRequests.length; i += 25) {
          const batch = deleteRequests.slice(i, i + 25);
          await docClient.send(new BatchWriteCommand({
            RequestItems: {
              [MATERIAL_CATEGORIAS_TABLE]: batch
            }
          }));
        }
      }

      // 3. Agregar nuevas categorías
      if (categoriaIds.length > 0) {
        const putRequests = categoriaIds.map(catId => ({
          PutRequest: {
            Item: {
              materialId,
              categoriaId: catId,
              asignadoPor: user.email,
              fechaAsignacion: new Date().toISOString()
            }
          }
        }));

        // BatchWrite en lotes de 25
        for (let i = 0; i < putRequests.length; i += 25) {
          const batch = putRequests.slice(i, i + 25);
          await docClient.send(new BatchWriteCommand({
            RequestItems: {
              [MATERIAL_CATEGORIAS_TABLE]: batch
            }
          }));
        }
      }

      return success({
        message: 'Categorías actualizadas exitosamente',
        materialId,
        categoriasEliminadas: currentRelaciones.length,
        categoriasAgregadas: categoriaIds.length
      });
    }

    // Ruta no encontrada
    return badRequest('Ruta o método no soportado');

  } catch (error) {
    console.error('Error en material-categorias:', error);
    return serverError('Error al gestionar categorías de material', error.message);
  }
};

/**
 * Metadata para auto-grant de permisos
 */
exports.metadata = {
  tables: ['MaterialCategorias', 'RecursosAcademicos:read'],
  additionalPolicies: []
};
