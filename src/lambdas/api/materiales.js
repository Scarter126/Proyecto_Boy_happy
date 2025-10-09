const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const { authorize } = require('/opt/nodejs/authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = require('/opt/nodejs/responseHelper');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const RECURSOS_TABLE = process.env.RECURSOS_TABLE;
const MATERIALES_BUCKET = process.env.MATERIALES_BUCKET;

/**
 * Helper: Obtener item de RecursosAcademicos por ID (busca el tipo automáticamente)
 * Necesario porque la tabla tiene composite key {id, tipo} pero frontend solo envía id
 */
async function getItemById(id) {
  const result = await docClient.send(new ScanCommand({
    TableName: RECURSOS_TABLE,
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: { ':id': id },
    Limit: 1
  }));

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
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
      if (!data.curso || !data.asignatura || !data.titulo || !data.profesor) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Campos requeridos: curso, asignatura, titulo, profesor'
          })
        };
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

      // Generar URL firmada para descarga si existe archivo en S3
      if (urlArchivo && urlArchivo.startsWith('s3://')) {
        const s3Key = urlArchivo.replace(`s3://${MATERIALES_BUCKET}/`, '');
        const command = new GetObjectCommand({
          Bucket: MATERIALES_BUCKET,
          Key: s3Key
        });
        item.urlDescarga = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // GET /materiales - Listar materiales
    // ========================================
    if (httpMethod === 'GET' && path === '/materiales') {
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

        if (queryStringParameters.categoria) {
          filters.push('categoria = :categoria');
          attrValues[':categoria'] = queryStringParameters.categoria;
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

      // Generar URLs firmadas para cada material
      for (const material of result.Items) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materiales: result.Items,
          total: result.Items.length
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
      const existingItem = await getItemById(id);

      if (!existingItem) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Material no encontrado' })
        };
      }

      // Solo permitir edición si está en estado pendiente o en_correccion
      if (existingItem.estado !== 'pendiente' && existingItem.estado !== 'en_correccion') {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
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

      if (data.categoria) {
        updateParts.push('categoria = :categoria');
        attrValues[':categoria'] = data.categoria;
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No se especificaron campos para actualizar' })
        };
      }

      await docClient.send(new UpdateCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: existingItem.tipo }, // ✅ Usar tipo del item existente
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: attrValues
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Material actualizado correctamente',
          id
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      if (!data.revisadoPor) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campo requerido: revisadoPor' })
        };
      }

      // Obtener item para el tipo
      const item = await getItemById(id);
      if (!item) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      if (!data.revisadoPor || !data.motivo) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: revisadoPor, motivo' })
        };
      }

      // Obtener item para el tipo
      const item = await getItemById(id);
      if (!item) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      if (!data.revisadoPor || !data.observaciones) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: revisadoPor, observaciones' })
        };
      }

      // Obtener item para el tipo
      const item = await getItemById(id);
      if (!item) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      console.log('🔍 Buscando material con ID:', id);

      // Obtener el material para eliminar archivo de S3 (usando helper)
      const existingItem = await getItemById(id);
      console.log('📦 Material encontrado:', existingItem ? existingItem.id : 'NO ENCONTRADO');

      if (!existingItem) {
        console.error('❌ Material no encontrado. ID buscado:', id);
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
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

      // Eliminar registro de DynamoDB
      await docClient.send(new DeleteCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: existingItem.tipo } // ✅ Usar tipo del item existente
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Material eliminado correctamente',
          id
        })
      };
    }

    // Ruta no encontrada
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ruta o método no soportado' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Error interno del servidor',
        error: error.message
      })
    };
  }
};
