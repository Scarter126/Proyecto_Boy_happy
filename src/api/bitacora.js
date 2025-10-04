const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { authorize } = require('/opt/nodejs/authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = require('/opt/nodejs/responseHelper');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const RECURSOS_TABLE = process.env.RECURSOS_TABLE;

const CATEGORIAS_VALIDAS = ['Conducta', 'Aprendizaje', 'Social', 'Emocional', 'Comunicación'];
const SEVERIDADES_VALIDAS = ['leve', 'moderada', 'alta'];

/**
 * Helper: Obtener item de RecursosAcademicos por ID (busca el tipo automáticamente)
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
 * Lambda handler para gestión de bitácora de clases
 *
 * CU-36: Registrar bitácora de clase
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, path, queryStringParameters } = event;

    // ========================================
    // POST /bitacora - Crear registro
    // ========================================
    if (httpMethod === 'POST' && path === '/bitacora') {
      const data = JSON.parse(event.body);

      // Validaciones
      if (!data.rutAlumno || !data.categoria || !data.descripcion || !data.autor) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Campos requeridos: rutAlumno, categoria, descripcion, autor'
          })
        };
      }

      if (!CATEGORIAS_VALIDAS.includes(data.categoria)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: `Categoría inválida. Debe ser una de: ${CATEGORIAS_VALIDAS.join(', ')}`
          })
        };
      }

      if (data.severidad && !SEVERIDADES_VALIDAS.includes(data.severidad)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: `Severidad inválida. Debe ser una de: ${SEVERIDADES_VALIDAS.join(', ')}`
          })
        };
      }

      const item = {
        id: `bitacora-${uuidv4()}`,
        tipo: 'bitacora',
        rutAlumno: data.rutAlumno,
        fecha: data.fecha || new Date().toISOString().split('T')[0],
        categoria: data.categoria,
        descripcion: data.descripcion,
        autor: data.autor, // Puede ser profesor o fonoaudiólogo
        severidad: data.severidad || 'leve',
        seguimiento: data.seguimiento || '',
        timestamp: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: RECURSOS_TABLE,
        Item: item
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // GET /bitacora - Listar registros (con filtros)
    // ========================================
    if (httpMethod === 'GET' && path === '/bitacora') {
      const params = {
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo',
        ExpressionAttributeNames: {
          '#tipo': 'tipo'
        },
        ExpressionAttributeValues: {
          ':tipo': 'bitacora'
        }
      };

      // Aplicar filtros opcionales
      if (queryStringParameters) {
        const filters = [];
        const attrNames = { '#tipo': 'tipo' };
        const attrValues = { ':tipo': 'bitacora' };

        if (queryStringParameters.rutAlumno) {
          filters.push('rutAlumno = :rutAlumno');
          attrValues[':rutAlumno'] = queryStringParameters.rutAlumno;
        }

        if (queryStringParameters.categoria) {
          filters.push('categoria = :categoria');
          attrValues[':categoria'] = queryStringParameters.categoria;
        }

        if (queryStringParameters.autor) {
          filters.push('autor = :autor');
          attrValues[':autor'] = queryStringParameters.autor;
        }

        if (queryStringParameters.severidad) {
          filters.push('severidad = :severidad');
          attrValues[':severidad'] = queryStringParameters.severidad;
        }

        if (queryStringParameters.fechaInicio && queryStringParameters.fechaFin) {
          filters.push('fecha BETWEEN :fechaInicio AND :fechaFin');
          attrValues[':fechaInicio'] = queryStringParameters.fechaInicio;
          attrValues[':fechaFin'] = queryStringParameters.fechaFin;
        }

        if (filters.length > 0) {
          params.FilterExpression = `#tipo = :tipo AND ${filters.join(' AND ')}`;
          params.ExpressionAttributeValues = attrValues;
        }
      }

      const result = await docClient.send(new ScanCommand(params));

      // Ordenar por fecha descendente
      result.Items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registros: result.Items,
          total: result.Items.length
        })
      };
    }

    // ========================================
    // PUT /bitacora?id=xxx - Modificar registro
    // ========================================
    if (httpMethod === 'PUT' && path === '/bitacora') {
      if (!queryStringParameters || !queryStringParameters.id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      // Verificar que el registro existe (usando helper)
      const existingItem = await getItemById(id);

      if (!existingItem) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Registro no encontrado' })
        };
      }

      const updateParts = [];
      const attrValues = {};

      if (data.descripcion !== undefined) {
        updateParts.push('descripcion = :descripcion');
        attrValues[':descripcion'] = data.descripcion;
      }

      if (data.seguimiento !== undefined) {
        updateParts.push('seguimiento = :seguimiento');
        attrValues[':seguimiento'] = data.seguimiento;
      }

      if (data.categoria) {
        if (!CATEGORIAS_VALIDAS.includes(data.categoria)) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: `Categoría inválida. Debe ser una de: ${CATEGORIAS_VALIDAS.join(', ')}`
            })
          };
        }
        updateParts.push('categoria = :categoria');
        attrValues[':categoria'] = data.categoria;
      }

      if (data.severidad) {
        if (!SEVERIDADES_VALIDAS.includes(data.severidad)) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: `Severidad inválida. Debe ser una de: ${SEVERIDADES_VALIDAS.join(', ')}`
            })
          };
        }
        updateParts.push('severidad = :severidad');
        attrValues[':severidad'] = data.severidad;
      }

      if (data.fecha) {
        updateParts.push('fecha = :fecha');
        attrValues[':fecha'] = data.fecha;
      }

      // Agregar timestamp de última modificación
      updateParts.push('ultimaModificacion = :timestamp');
      attrValues[':timestamp'] = new Date().toISOString();

      if (updateParts.length === 1) { // Solo timestamp
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
          message: 'Registro actualizado correctamente',
          id
        })
      };
    }

    // ========================================
    // DELETE /bitacora?id=xxx - Eliminar registro
    // ========================================
    if (httpMethod === 'DELETE' && path === '/bitacora') {
      if (!queryStringParameters || !queryStringParameters.id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;

      // Verificar que existe (usando helper)
      const existingItem = await getItemById(id);

      if (!existingItem) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Registro no encontrado' })
        };
      }

      await docClient.send(new DeleteCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: existingItem.tipo } // ✅ Usar tipo del item existente
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Registro eliminado correctamente',
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
