const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = requireLayer('responseHelper');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const INFORMES_TABLE = process.env.INFORMES_TABLE;
const MATERIALES_BUCKET = process.env.MATERIALES_BUCKET;

/**
 * CU-46: Subir informes de evaluación
 * CU-47: Modificar informes
 * CU-48: Eliminar informes
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
    // POST /informes o /informes-fono - Crear informe
    // ========================================
    if (httpMethod === 'POST' && (path === '/informes' || path === '/informes-fono' || path === '/informes/' || path === '/informes-fono/')) {
      const data = JSON.parse(event.body);

      if (!data.rutAlumno || !data.tipoEvaluacion) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: rutAlumno, tipoEvaluacion' })
        };
      }

      const informeId = `informe-${uuidv4()}`;
      const timestamp = new Date().toISOString();

      const item = {
        id: informeId,
        timestamp,
        rutAlumno: data.rutAlumno,
        nombreAlumno: data.nombreAlumno || '',
        fechaEvaluacion: data.fechaEvaluacion || new Date().toISOString().split('T')[0],
        tipoEvaluacion: data.tipoEvaluacion,
        motivoConsulta: data.motivoConsulta || '',
        antecedentes: data.antecedentes || '',
        resultadosEvaluacion: data.resultadosEvaluacion || '',
        diagnostico: data.diagnostico || '',
        recomendaciones: data.recomendaciones || '',
        fonoaudiologo: authResult.userEmail || 'Sistema'
      };

      await docClient.send(new PutCommand({
        TableName: INFORMES_TABLE,
        Item: item
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // GET /informes o /informes-fono - Listar informes
    // ========================================
    if (httpMethod === 'GET' && (path === '/informes' || path === '/informes-fono' || path === '/informes/' || path === '/informes-fono/')) {
      // Si solicita un ID específico
      if (queryStringParameters?.id) {
        const result = await docClient.send(new ScanCommand({
          TableName: INFORMES_TABLE,
          FilterExpression: 'id = :id',
          ExpressionAttributeValues: { ':id': queryStringParameters.id }
        }));

        if (!result.Items || result.Items.length === 0) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Informe no encontrado' })
          };
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.Items[0])
        };
      }
      const params = { TableName: INFORMES_TABLE };

      let result;
      if (queryStringParameters?.rutAlumno) {
        // Usar GSI AlumnoIndex
        const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
        result = await docClient.send(new QueryCommand({
          TableName: INFORMES_TABLE,
          IndexName: 'AlumnoIndex',
          KeyConditionExpression: 'rutAlumno = :rut',
          ExpressionAttributeValues: { ':rut': queryStringParameters.rutAlumno }
        }));
      } else {
        result = await docClient.send(new ScanCommand(params));
      }

      // Filtros adicionales
      let items = result.Items;
      if (queryStringParameters?.tipo) {
        items = items.filter(i => i.tipoEvaluacion === queryStringParameters.tipo);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items)
      };
    }

    // ========================================
    // PUT /informes o /informes-fono?id=xxx - Modificar informe
    // ========================================
    if (httpMethod === 'PUT' && (path === '/informes' || path === '/informes-fono' || path === '/informes/' || path === '/informes-fono/') && queryStringParameters?.id) {
      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      const updateParts = [];
      const attrValues = {};

      if (data.motivoConsulta !== undefined) {
        updateParts.push('motivoConsulta = :motivo');
        attrValues[':motivo'] = data.motivoConsulta;
      }

      if (data.antecedentes !== undefined) {
        updateParts.push('antecedentes = :ant');
        attrValues[':ant'] = data.antecedentes;
      }

      if (data.resultadosEvaluacion !== undefined) {
        updateParts.push('resultadosEvaluacion = :res');
        attrValues[':res'] = data.resultadosEvaluacion;
      }

      if (data.diagnostico !== undefined) {
        updateParts.push('diagnostico = :diag');
        attrValues[':diag'] = data.diagnostico;
      }

      if (data.recomendaciones !== undefined) {
        updateParts.push('recomendaciones = :rec');
        attrValues[':rec'] = data.recomendaciones;
      }

      if (data.tipoEvaluacion !== undefined) {
        updateParts.push('tipoEvaluacion = :tipo');
        attrValues[':tipo'] = data.tipoEvaluacion;
      }

      updateParts.push('ultimaModificacion = :ts');
      attrValues[':ts'] = new Date().toISOString();

      if (updateParts.length === 1) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No hay campos para actualizar' })
        };
      }

      // Necesitamos el timestamp original para la key
      const getResult = await docClient.send(new ScanCommand({
        TableName: INFORMES_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Informe no encontrado' })
        };
      }

      const timestamp = getResult.Items[0].timestamp;

      await docClient.send(new UpdateCommand({
        TableName: INFORMES_TABLE,
        Key: { id, timestamp },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: attrValues
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Informe actualizado correctamente', id })
      };
    }

    // ========================================
    // DELETE /informes o /informes-fono?id=xxx - Eliminar informe
    // ========================================
    if (httpMethod === 'DELETE' && (path === '/informes' || path === '/informes-fono' || path === '/informes/' || path === '/informes-fono/') && queryStringParameters?.id) {
      const id = queryStringParameters.id;

      // Buscar el informe
      const getResult = await docClient.send(new ScanCommand({
        TableName: INFORMES_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Informe no encontrado' })
        };
      }

      const informe = getResult.Items[0];

      // Eliminar de DynamoDB
      await docClient.send(new DeleteCommand({
        TableName: INFORMES_TABLE,
        Key: { id: informe.id, timestamp: informe.timestamp }
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Informe eliminado correctamente', id })
      };
    }

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
      body: JSON.stringify({ message: 'Error interno del servidor', error: error.message })
    };
  }
};
