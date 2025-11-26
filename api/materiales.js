const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, getCorsHeaders, notFound, serverError, parseBody } = requireLayer('responseHelper');
const { obtenerCursosProfesor } = requireLayer('relaciones');
const { getItemById } = requireLayer('sharedHelpers');
const TABLE_NAMES = require('../shared/table-names.cjs');
const TABLE_KEYS = require('../shared/table-keys.cjs');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const RECURSOS_TABLE = TABLE_NAMES.RECURSOS_TABLE;
const MATERIALES_BUCKET = process.env.MATERIALES_BUCKET;
const MATERIAL_CATEGORIAS_TABLE = TABLE_NAMES.MATERIAL_CATEGORIAS_TABLE;

/**
 * Helper: Obtener categorías de un material desde MaterialCategorias
 */
async function getCategoriasDelMaterial(materialId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: MATERIAL_CATEGORIAS_TABLE,
      KeyConditionExpression: 'materialId = :mid',
      ExpressionAttributeValues: { ':mid': materialId }
    }));

    const relaciones = result.Items || [];

    // Enriquecer con datos de categoría
    const categoriasEnriquecidas = await Promise.all(
      relaciones.map(async (rel) => {
        const cat = await docClient.send(new GetCommand({
          TableName: RECURSOS_TABLE,
          Key: { id: rel.categoriaId, tipo: 'categoria' }
        }));
        return cat.Item || null;
      })
    );

    return categoriasEnriquecidas.filter(Boolean);
  } catch (error) {
    console.error('Error obteniendo categorías del material:', error);
    return [];
  }
}

/**
 * Helper: Agregar categorías a un material
 */
async function agregarCategorias(materialId, categoriaIds, userEmail) {
  if (!Array.isArray(categoriaIds) || categoriaIds.length === 0) {
    return;
  }

  const putRequests = categoriaIds.map(catId => ({
    PutRequest: {
      Item: {
        materialId,
        categoriaId: catId,
        asignadoPor: userEmail,
        fechaAsignacion: new Date().toISOString()
      }
    }
  }));

  // BatchWrite en lotes de 25 (límite de DynamoDB)
  for (let i = 0; i < putRequests.length; i += 25) {
    const batch = putRequests.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [MATERIAL_CATEGORIAS_TABLE]: batch
      }
    }));
  }
}

/**
 * Lambda handler para gestión de materiales pedagógicos
 *
 * CU-13: Revisar material pedagógico
 * CU-14: Aprobar material
 * CU-15: Rechazar material
 * CU-16: Solicitar correcciones
 * CU-35: Subir recursos didácticos
 * CU-37: Organizar material por unidades
 */
exports.handler = async (event) => {

  try {
    // Obtener headers CORS dinámicos
    const corsHeaders = getCorsHeaders(event);

    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, path, queryStringParameters } = event;

    // ========================================
    // POST /materiales - Subir material
    // ========================================
    if (httpMethod === 'POST' && path === '/materiales') {
      const data = JSON.parse(event.body);

      // Validaciones
      if (!data.curso || !data.titulo) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Campos requeridos: curso, titulo'
          })
        };
      }

      // Asignar valores por defecto para campos opcionales en modo desarrollo
      data.asignatura = data.asignatura || 'General';
      data.profesor = data.profesor || authResult.user.email;

      // Validar que el profesor pertenece al curso (solo para profesores, no para admin)
      const isAdmin = authResult.user.rol === 'admin' || authResult.user.roles?.includes('admin');

      if (!isAdmin) {
        try {
          const cursosProfesor = await obtenerCursosProfesor(data.profesor);
          const tieneAcceso = cursosProfesor.some(c => c.curso === data.curso && c.activo);

          if (!tieneAcceso) {
            return {
              statusCode: 403,
              headers: corsHeaders,
              body: JSON.stringify({
                error: `El profesor no está asignado al curso ${data.curso}`
              })
            };
          }
        } catch (error) {
          console.error('Error validando profesor-curso:', error);
          // Si falla la validación, permitir continuar (por compatibilidad)
        }
      }

      const materialId = `material-${uuidv4()}`;

      // Si viene un archivo base64, subirlo a S3
      let urlArchivo = null;
      if (data.archivoBase64 && data.nombreArchivo) {
        const buffer = Buffer.from(data.archivoBase64, 'base64');
        const extension = data.nombreArchivo.split('.').pop();
        const s3Key = `materiales/${materialId}.${extension}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: MATERIALES_BUCKET,
          Key: s3Key,
          Body: buffer,
          ContentType: data.tipoArchivo || 'application/pdf'
        }));

        urlArchivo = `s3://${MATERIALES_BUCKET}/${s3Key}`;
      }

      const item = {
        id: materialId,
        tipo: 'material',
        curso: data.curso,
        asignatura: data.asignatura,
        titulo: data.titulo,
        descripcion: data.descripcion || '',
        urlArchivo: urlArchivo || data.urlArchivo || '',
        categoria: data.categoria || 'general', // guia, presentacion, video, lectura, evaluacion
        unidad: data.unidad || '',
        estado: 'pendiente', // pendiente, aprobado, rechazado, en_correccion
        profesor: data.profesor,
        fecha: new Date().toISOString().split('T')[0],
        observacionesRevision: null,
        revisadoPor: null,
        timestamp: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: RECURSOS_TABLE,
        Item: item
      }));

      // NUEVO: Agregar categorías en MaterialCategorias (soporte many-to-many)
      let categoriaIds = [];
      if (data.categorias && Array.isArray(data.categorias)) {
        // Formato nuevo: array de IDs
        categoriaIds = data.categorias;
      } else if (data.categorias && typeof data.categorias === 'string') {
        // Formato string separado por comas
        categoriaIds = data.categorias.split(',').map(id => id.trim()).filter(Boolean);
      } else if (data.categoria) {
        // Formato antiguo: string simple (backward compatibility)
        categoriaIds = [data.categoria];
      }

      if (categoriaIds.length > 0) {
        await agregarCategorias(materialId, categoriaIds, authResult.user.email);
      }

      // Generar URL firmada para descarga si existe archivo en S3
      if (urlArchivo && urlArchivo.startsWith('s3://')) {
        const s3Key = urlArchivo.replace(`s3://${MATERIALES_BUCKET}/`, '');
        const command = new GetObjectCommand({
          Bucket: MATERIALES_BUCKET,
          Key: s3Key
        });
        item.urlDescarga = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      }

      // Enriquecer respuesta con categorías completas
      item.categorias = await getCategoriasDelMaterial(materialId);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // GET /materiales - Listar materiales o obtener uno por id
    // ========================================
    if (httpMethod === 'GET' && path === '/materiales') {
      // GET por ID específico
      if (queryStringParameters?.id) {
        const material = await getItemById(RECURSOS_TABLE, queryStringParameters.id);

        if (!material) {
          return notFound('Material no encontrado');
        }

        // Enriquecer con categorías
        material.categorias = await getCategoriasDelMaterial(material.id);

        // Generar URL firmada si existe archivo en S3
        if (material.urlArchivo && material.urlArchivo.startsWith('s3://')) {
          const s3Key = material.urlArchivo.replace(`s3://${MATERIALES_BUCKET}/`, '');
          const command = new GetObjectCommand({
            Bucket: MATERIALES_BUCKET,
            Key: s3Key
          });
          material.urlDescarga = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        }

        return success(material);
      }

      // SECURITY: Role-based filtering for profesores
      let cursosAutorizados = null;
      if (authResult.user.rol === 'profesor') {
        const cursosProfesor = await obtenerCursosProfesor(authResult.user.rut);
        cursosAutorizados = cursosProfesor
          .filter(c => c.activo)
          .map(c => c.curso);

        // Si se especifica un curso, validar autorización
        if (queryStringParameters?.curso && !cursosAutorizados.includes(queryStringParameters.curso)) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'No autorizado para acceder a materiales de este curso' })
          };
        }
      }

      const params = {
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo',
        ExpressionAttributeNames: {
          '#tipo': 'tipo'
        },
        ExpressionAttributeValues: {
          ':tipo': 'material'
        }
      };

      // Aplicar filtros
      if (queryStringParameters) {
        const filters = [];
        const attrNames = { '#tipo': 'tipo' };
        const attrValues = { ':tipo': 'material' };

        if (queryStringParameters.curso) {
          filters.push('curso = :curso');
          attrValues[':curso'] = queryStringParameters.curso;
        }

        if (queryStringParameters.asignatura) {
          filters.push('asignatura = :asignatura');
          attrValues[':asignatura'] = queryStringParameters.asignatura;
        }

        if (queryStringParameters.estado) {
          filters.push('estado = :estado');
          attrValues[':estado'] = queryStringParameters.estado;
        }

        if (queryStringParameters.profesor) {
          filters.push('profesor = :profesor');
          attrValues[':profesor'] = queryStringParameters.profesor;
        }

        if (queryStringParameters.unidad) {
          filters.push('unidad = :unidad');
          attrValues[':unidad'] = queryStringParameters.unidad;
        }

        if (filters.length > 0) {
          params.FilterExpression = `#tipo = :tipo AND ${filters.join(' AND ')}`;
          params.ExpressionAttributeValues = attrValues;
        }
      }

      const result = await docClient.send(new ScanCommand(params));

      // SECURITY: Post-filter results for profesores (additional security layer)
      let materiales = result.Items || [];
      if (cursosAutorizados && !queryStringParameters?.curso) {
        materiales = materiales.filter(item => item.curso && cursosAutorizados.includes(item.curso));
      }

      // NUEVO: Enriquecer cada material con sus categorías

      for (const material of materiales) {
        material.categorias = await getCategoriasDelMaterial(material.id);

        // BACKWARD COMPATIBILITY: mantener campo categoria como ID de primera categoría
        if (material.categorias.length > 0) {
          material.categoria = material.categorias[0].id;
        } else {
          material.categoria = null;
        }
      }

      // NUEVO: Aplicar filtro de categoría post-scan si se especificó
      if (queryStringParameters?.categoria) {
        const categoriaFiltro = queryStringParameters.categoria;
        materiales = materiales.filter(mat =>
          mat.categorias.some(cat => cat.id === categoriaFiltro)
        );
      }

      // Generar URLs firmadas para cada material
      for (const material of materiales) {
        if (material.urlArchivo && material.urlArchivo.startsWith('s3://')) {
          const s3Key = material.urlArchivo.replace(`s3://${MATERIALES_BUCKET}/`, '');
          const command = new GetObjectCommand({
            Bucket: MATERIALES_BUCKET,
            Key: s3Key
          });
          material.urlDescarga = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          materiales: materiales,
          total: materiales.length
        })
      };
    }

    // ========================================
    // PUT /materiales?id=xxx - Modificar material
    // ========================================
    if (httpMethod === 'PUT' && path === '/materiales' && queryStringParameters?.id) {
      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      // Verificar que existe (usando helper)
      const existingItem = await getItemById(RECURSOS_TABLE, id);

      if (!existingItem) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Material no encontrado' })
        };
      }

      // Solo permitir edición si está en estado pendiente o en_correccion
      if (existingItem.estado !== 'pendiente' && existingItem.estado !== 'en_correccion') {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Solo se pueden editar materiales en estado pendiente o en corrección'
          })
        };
      }

      const updateParts = [];
      const attrValues = {};

      if (data.titulo) {
        updateParts.push('titulo = :titulo');
        attrValues[':titulo'] = data.titulo;
      }

      if (data.descripcion !== undefined) {
        updateParts.push('descripcion = :descripcion');
        attrValues[':descripcion'] = data.descripcion;
      }

      if (data.unidad !== undefined) {
        updateParts.push('unidad = :unidad');
        attrValues[':unidad'] = data.unidad;
      }

      // Si se sube un nuevo archivo
      if (data.archivoBase64 && data.nombreArchivo) {
        const buffer = Buffer.from(data.archivoBase64, 'base64');
        const extension = data.nombreArchivo.split('.').pop();
        const s3Key = `materiales/${id}.${extension}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: MATERIALES_BUCKET,
          Key: s3Key,
          Body: buffer,
          ContentType: data.tipoArchivo || 'application/pdf'
        }));

        updateParts.push('urlArchivo = :urlArchivo');
        attrValues[':urlArchivo'] = `s3://${MATERIALES_BUCKET}/${s3Key}`;
      }

      // Resetear estado a pendiente al editar
      updateParts.push('estado = :estado');
      attrValues[':estado'] = 'pendiente';

      updateParts.push('ultimaModificacion = :timestamp');
      attrValues[':timestamp'] = new Date().toISOString();

      if (updateParts.length === 2) { // Solo estado y timestamp
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No se especificaron campos para actualizar' })
        };
      }

      await docClient.send(new UpdateCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: existingItem.tipo }, // ✅ Usar tipo del item existente
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: attrValues
      }));

      // NUEVO: Actualizar categorías si se proporcionaron
      let categoriaIds = [];
      if (data.categorias && Array.isArray(data.categorias)) {
        // Formato nuevo: array de IDs
        categoriaIds = data.categorias;
      } else if (data.categorias && typeof data.categorias === 'string') {
        // Formato string separado por comas
        categoriaIds = data.categorias.split(',').map(id => id.trim()).filter(Boolean);
      } else if (data.categoria) {
        // Formato antiguo: string simple (backward compatibility)
        categoriaIds = [data.categoria];
      }

      if (categoriaIds.length > 0) {
        // Eliminar categorías actuales
        const currentCats = await docClient.send(new QueryCommand({
          TableName: MATERIAL_CATEGORIAS_TABLE,
          KeyConditionExpression: 'materialId = :mid',
          ExpressionAttributeValues: { ':mid': id }
        }));

        if (currentCats.Items && currentCats.Items.length > 0) {
          const deleteRequests = currentCats.Items.map(rel => ({
            DeleteRequest: {
              Key: { materialId: rel.materialId, categoriaId: rel.categoriaId }
            }
          }));

          for (let i = 0; i < deleteRequests.length; i += 25) {
            const batch = deleteRequests.slice(i, i + 25);
            await docClient.send(new BatchWriteCommand({
              RequestItems: { [MATERIAL_CATEGORIAS_TABLE]: batch }
            }));
          }
        }

        // Agregar nuevas categorías
        await agregarCategorias(id, categoriaIds, authResult.user.email);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Material actualizado correctamente',
          id,
          categoriasActualizadas: categoriaIds.length
        })
      };
    }

    // ========================================
    // PUT /materiales/aprobar?id=xxx - Aprobar (Dirección)
    // ========================================
    if (httpMethod === 'PUT' && path === '/materiales/aprobar') {
      if (!queryStringParameters?.id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      if (!data.revisadoPor) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Campo requerido: revisadoPor' })
        };
      }

      // Obtener item para el tipo
      const item = await getItemById(RECURSOS_TABLE, id);
      if (!item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Material no encontrado' })
        };
      }

      await docClient.send(new UpdateCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: item.tipo }, // ✅ Usar tipo del item existente
        UpdateExpression: 'SET estado = :estado, revisadoPor = :revisor, fechaRevision = :fecha, observacionesRevision = :obs',
        ExpressionAttributeValues: {
          ':estado': 'aprobado',
          ':revisor': data.revisadoPor,
          ':fecha': new Date().toISOString(),
          ':obs': data.observaciones || 'Material aprobado'
        }
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Material aprobado correctamente',
          id,
          estado: 'aprobado'
        })
      };
    }

    // ========================================
    // PUT /materiales/rechazar?id=xxx - Rechazar
    // ========================================
    if (httpMethod === 'PUT' && path === '/materiales/rechazar') {
      if (!queryStringParameters?.id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      if (!data.revisadoPor || !data.motivo) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Campos requeridos: revisadoPor, motivo' })
        };
      }

      // Obtener item para el tipo
      const item = await getItemById(RECURSOS_TABLE, id);
      if (!item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Material no encontrado' })
        };
      }

      await docClient.send(new UpdateCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: item.tipo }, // ✅ Usar tipo del item existente
        UpdateExpression: 'SET estado = :estado, revisadoPor = :revisor, fechaRevision = :fecha, observacionesRevision = :obs',
        ExpressionAttributeValues: {
          ':estado': 'rechazado',
          ':revisor': data.revisadoPor,
          ':fecha': new Date().toISOString(),
          ':obs': data.motivo
        }
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Material rechazado',
          id,
          estado: 'rechazado'
        })
      };
    }

    // ========================================
    // PUT /materiales/corregir?id=xxx - Solicitar corrección
    // ========================================
    if (httpMethod === 'PUT' && path === '/materiales/corregir') {
      if (!queryStringParameters?.id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      if (!data.revisadoPor || !data.observaciones) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Campos requeridos: revisadoPor, observaciones' })
        };
      }

      // Obtener item para el tipo
      const item = await getItemById(RECURSOS_TABLE, id);
      if (!item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Material no encontrado' })
        };
      }

      await docClient.send(new UpdateCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: item.tipo }, // ✅ Usar tipo del item existente
        UpdateExpression: 'SET estado = :estado, revisadoPor = :revisor, fechaRevision = :fecha, observacionesRevision = :obs',
        ExpressionAttributeValues: {
          ':estado': 'en_correccion',
          ':revisor': data.revisadoPor,
          ':fecha': new Date().toISOString(),
          ':obs': data.observaciones
        }
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Corrección solicitada',
          id,
          estado: 'en_correccion'
        })
      };
    }

    // ========================================
    // DELETE /materiales?id=xxx - Eliminar
    // ========================================
    if (httpMethod === 'DELETE' && path === '/materiales') {
      console.log('🗑️ DELETE request recibido:', { queryStringParameters });

      if (!queryStringParameters?.id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      console.log('🔍 Buscando material con ID:', id);

      // Obtener el material para eliminar archivo de S3 (usando helper)
      const existingItem = await getItemById(RECURSOS_TABLE, id);
      console.log('📦 Material encontrado:', existingItem ? existingItem.id : 'NO ENCONTRADO');

      if (!existingItem) {
        console.error('❌ Material no encontrado. ID buscado:', id);
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Material no encontrado' })
        };
      }

      // Eliminar archivo de S3 si existe
      if (existingItem.urlArchivo && existingItem.urlArchivo.startsWith('s3://')) {
        const s3Key = existingItem.urlArchivo.replace(`s3://${MATERIALES_BUCKET}/`, '');
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: MATERIALES_BUCKET,
            Key: s3Key
          }));
        } catch (error) {
          console.error('Error eliminando archivo de S3:', error);
          // Continuar con la eliminación del registro en DynamoDB
        }
      }

      // NUEVO: Eliminar todas las relaciones de categorías
      const categoriaRels = await docClient.send(new QueryCommand({
        TableName: MATERIAL_CATEGORIAS_TABLE,
        KeyConditionExpression: 'materialId = :mid',
        ExpressionAttributeValues: { ':mid': id }
      }));

      if (categoriaRels.Items && categoriaRels.Items.length > 0) {
        const deleteRequests = categoriaRels.Items.map(rel => ({
          DeleteRequest: {
            Key: { materialId: rel.materialId, categoriaId: rel.categoriaId }
          }
        }));

        for (let i = 0; i < deleteRequests.length; i += 25) {
          const batch = deleteRequests.slice(i, i + 25);
          await docClient.send(new BatchWriteCommand({
            RequestItems: { [MATERIAL_CATEGORIAS_TABLE]: batch }
          }));
        }
      }

      // Eliminar registro de DynamoDB
      await docClient.send(new DeleteCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: existingItem.tipo } // ✅ Usar tipo del item existente
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Material eliminado correctamente',
          id
        })
      };
    }

    // Ruta no encontrada
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Ruta o método no soportado' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Error interno del servidor',
        error: error.message
      })
    };
  }
};

/**
 * Metadata para auto-grant de permisos y routing
 */
exports.metadata = {
  route: '/materiales',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  auth: true,
  roles: ['admin', 'profesor'],
  profile: 'medium',
  tables: [TABLE_KEYS.RECURSOS_TABLE, TABLE_KEYS.MATERIAL_CATEGORIAS_TABLE],
  buckets: ['materiales'],
  additionalPolicies: []
};
