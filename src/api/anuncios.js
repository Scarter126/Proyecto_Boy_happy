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

      const item = {
        id: uuidv4(),
        titulo: data.titulo,
        contenido: data.contenido,
        fecha: new Date().toISOString(),
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

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
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

      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id }
      }));

      return success({ message: 'Anuncio eliminado' });
    }

    return badRequest('Método no soportado');

  } catch (err) {
    console.error('Error en anuncios:', err);
    return serverError(err.message);
  }
};
