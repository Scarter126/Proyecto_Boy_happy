const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { success, badRequest, serverError, parseBody } = require('/opt/nodejs/responseHelper');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
// Soportar tanto ANUNCIOS_TABLE (legacy) como COMUNICACIONES_TABLE (nuevo)
const TABLE_NAME = process.env.ANUNCIOS_TABLE || process.env.COMUNICACIONES_TABLE;

exports.handler = async (event) => {
  try {
    const { httpMethod } = event;

    // POST - Crear anuncio
    if (httpMethod === 'POST') {
      const data = parseBody(event);

      if (!data.titulo || !data.contenido || !data.autor) {
        return badRequest('Campos requeridos: titulo, contenido, autor');
      }

      const timestamp = new Date().toISOString();
      const item = {
        id: `anuncio-${uuidv4()}`,
        tipo: 'anuncio',
        timestamp: timestamp,
        titulo: data.titulo,
        contenido: data.contenido,
        fecha: timestamp.split('T')[0],
        autor: data.autor,
        destinatarios: data.destinatarios || 'todos' // 'todos', 'profesores', 'alumnos'
      };

      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      return success(item);
    }

    // GET - Listar anuncios
    if (httpMethod === 'GET') {
      const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
      return success(result.Items || []);
    }

    // PUT - Editar anuncio (FASE 11 - Mejora)
    if (httpMethod === 'PUT') {
      const { id } = event.queryStringParameters || {};
      if (!id) {
        return badRequest('Se requiere el parámetro id');
      }

      const data = parseBody(event);

      // Buscar el anuncio primero para obtener el timestamp
      const getResult = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        return badRequest('Anuncio no encontrado');
      }

      const anuncio = getResult.Items[0];

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          id: anuncio.id,
          timestamp: anuncio.timestamp
        },
        UpdateExpression: 'SET titulo = :titulo, contenido = :contenido, ultimaModificacion = :ts',
        ExpressionAttributeValues: {
          ':titulo': data.titulo,
          ':contenido': data.contenido,
          ':ts': new Date().toISOString()
        }
      }));

      return success({ message: 'Anuncio actualizado correctamente', id });
    }

    // DELETE - Eliminar anuncio
    if (httpMethod === 'DELETE') {
      const { id } = event.queryStringParameters || {};
      if (!id) {
        return badRequest('Se requiere el parámetro id');
      }

      console.log('🗑️ DELETE anuncio - ID recibido:', id);

      // Buscar el anuncio primero para obtener el timestamp (la tabla tiene composite key: id + timestamp)
      const getResult = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        console.error('❌ Anuncio no encontrado:', id);
        return badRequest('Anuncio no encontrado');
      }

      const anuncio = getResult.Items[0];
      console.log('📦 Anuncio encontrado:', { id: anuncio.id, timestamp: anuncio.timestamp });

      // Eliminar usando composite key
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          id: anuncio.id,
          timestamp: anuncio.timestamp
        }
      }));

      console.log('✅ Anuncio eliminado exitosamente');
      return success({ message: 'Anuncio eliminado', id });
    }

    return badRequest('Método no soportado');

  } catch (err) {
    console.error('Error en anuncios:', err);
    return serverError(err.message);
  }
};
