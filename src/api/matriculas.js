const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

const COMUNICACIONES_TABLE = process.env.COMUNICACIONES_TABLE;
const SOURCE_EMAIL = process.env.SOURCE_EMAIL || 'noreply@boyhappy.cl';

/**
 * Sistema de matrículas (separado de eventos.js)
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const { httpMethod, resource, queryStringParameters } = event;

    // ========================================
    // POST /matriculas - Crear solicitud
    // ========================================
    if (httpMethod === 'POST' && resource === '/matriculas') {
      const data = JSON.parse(event.body);

      if (!data.nombre || !data.rut || !data.correo) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: nombre, rut, correo' })
        };
      }

      const item = {
        id: `matricula-${uuidv4()}`,
        tipo: 'matricula',
        timestamp: new Date().toISOString(),
        nombre: data.nombre,
        rut: data.rut,
        fechaNacimiento: data.fechaNacimiento,
        ultimoCurso: data.ultimoCurso,
        correo: data.correo,
        telefono: data.telefono,
        estado: 'pendiente',
        fechaRegistro: new Date().toISOString().split('T')[0],
        fecha: new Date().toISOString().split('T')[0]
      };

      await docClient.send(new PutCommand({
        TableName: COMUNICACIONES_TABLE,
        Item: item
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // GET /matriculas - Listar solicitudes
    // ========================================
    if (httpMethod === 'GET' && resource === '/matriculas') {
      const result = await docClient.send(new ScanCommand({
        TableName: COMUNICACIONES_TABLE,
        FilterExpression: '#tipo = :tipo',
        ExpressionAttributeNames: { '#tipo': 'tipo' },
        ExpressionAttributeValues: { ':tipo': 'matricula' }
      }));

      let items = result.Items;

      if (queryStringParameters?.estado) {
        items = items.filter(i => i.estado === queryStringParameters.estado);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matriculas: items,
          total: items.length,
          pendientes: items.filter(i => i.estado === 'pendiente').length,
          aprobadas: items.filter(i => i.estado === 'aprobada').length,
          rechazadas: items.filter(i => i.estado === 'rechazada').length
        })
      };
    }

    // ========================================
    // PUT /matriculas?id=xxx - Actualizar estado + Email
    // ========================================
    if (httpMethod === 'PUT' && resource === '/matriculas' && queryStringParameters?.id) {
      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      // Obtener matrícula
      const getResult = await docClient.send(new ScanCommand({
        TableName: COMUNICACIONES_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Matrícula no encontrada' })
        };
      }

      const matricula = getResult.Items[0];

      // Actualizar estado
      await docClient.send(new UpdateCommand({
        TableName: COMUNICACIONES_TABLE,
        Key: { id: matricula.id, timestamp: matricula.timestamp },
        UpdateExpression: 'SET estado = :estado, revisadoPor = :revisor, motivo = :motivo, fechaRevision = :fecha',
        ExpressionAttributeValues: {
          ':estado': data.estado,
          ':revisor': data.revisadoPor,
          ':motivo': data.motivo || '',
          ':fecha': new Date().toISOString()
        }
      }));

      // Enviar email
      let asunto, mensaje;
      if (data.estado === 'aprobada') {
        asunto = '¡Felicidades! Tu matrícula ha sido aprobada';
        mensaje = `Estimado/a ${matricula.nombre},\n\nNos complace informarte que tu solicitud de matrícula ha sido APROBADA.\n\n¡Bienvenido/a a Boy Happy!`;
      } else if (data.estado === 'rechazada') {
        asunto = 'Estado de tu solicitud de matrícula';
        mensaje = `Estimado/a ${matricula.nombre},\n\nLamentamos informarte que tu solicitud de matrícula no ha podido ser aprobada.\n\nMotivo: ${data.motivo}`;
      }

      if (mensaje) {
        try {
          await sesClient.send(new SendEmailCommand({
            Source: SOURCE_EMAIL,
            Destination: { ToAddresses: [matricula.correo] },
            Message: {
              Subject: { Data: asunto, Charset: 'UTF-8' },
              Body: { Text: { Data: mensaje, Charset: 'UTF-8' } }
            }
          }));
        } catch (emailError) {
          console.error('Error enviando email:', emailError);
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Matrícula ${data.estado}. Email enviado.`,
          id,
          emailEnviado: true
        })
      };
    }

    // ========================================
    // DELETE /matriculas?id=xxx - Eliminar
    // ========================================
    if (httpMethod === 'DELETE' && resource === '/matriculas' && queryStringParameters?.id) {
      const id = queryStringParameters.id;

      const getResult = await docClient.send(new ScanCommand({
        TableName: COMUNICACIONES_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Matrícula no encontrada' })
        };
      }

      const matricula = getResult.Items[0];

      await docClient.send(new DeleteCommand({
        TableName: COMUNICACIONES_TABLE,
        Key: { id: matricula.id, timestamp: matricula.timestamp }
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Solicitud eliminada', id })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ruta no soportada' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
