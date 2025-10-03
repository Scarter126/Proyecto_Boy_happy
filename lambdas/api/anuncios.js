const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.ANUNCIOS_TABLE;

exports.handler = async (event) => {
  try {
    const { httpMethod, body } = event;

    // POST - Crear anuncio
    if (httpMethod === 'POST') {
      const data = JSON.parse(body);
      const item = {
        id: uuidv4(),
        titulo: data.titulo,
        contenido: data.contenido,
        fecha: new Date().toISOString(),
        autor: data.autor,
        destinatarios: data.destinatarios // 'todos', 'profesores', 'alumnos'
      };

      await docClient.put({ TableName: TABLE_NAME, Item: item }).promise();
      return {
        statusCode: 200,
        body: JSON.stringify(item)
      };
    }

    // GET - Listar anuncios
    if (httpMethod === 'GET') {
      const result = await docClient.scan({ TableName: TABLE_NAME }).promise();
      return {
        statusCode: 200,
        body: JSON.stringify(result.Items)
      };
    }

    // DELETE - Eliminar anuncio
    if (httpMethod === 'DELETE') {
      const { id } = event.queryStringParameters;
      await docClient.delete({
        TableName: TABLE_NAME,
        Key: { id }
      }).promise();

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Anuncio eliminado' })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Método no soportado' })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message })
    };
  }
};
