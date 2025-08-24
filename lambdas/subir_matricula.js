const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MATRICULAS_TABLE;

exports.handler = async (event) => {
  try {
    // GET → devolver todas las matrículas
    if (event.httpMethod === 'GET') {
      const params = { TableName: TABLE_NAME };
      const data = await docClient.scan(params).promise();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(data.Items)
      };
    }

    // POST → crear una matrícula
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);

      const item = {
        id: uuidv4(),
        nombre: data.nombre,
        rut: data.rut,
        fechaNacimiento: data.fechaNacimiento,
        ultimoCurso: data.ultimoCurso,
        correo: data.correo,
        telefono: data.telefono,
        estado: 'pendiente',
        fechaRegistro: new Date().toISOString()
      };

      await docClient.put({ TableName: TABLE_NAME, Item: item }).promise();

      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html" },
        body: `
          <html>
            <head><meta charset="UTF-8"><title>Confirmación</title></head>
            <body style="font-family: Arial; background:#f4f6f9; text-align:center; padding:50px;">
              <h1 style="color:green;">✅ Matrícula enviada correctamente</h1>
              <p>Gracias, <b>${item.nombre}</b>. Hemos recibido tu solicitud.</p>
              <a href="/prod" style="display:inline-block; margin-top:20px; background:#004080; color:white; padding:10px 20px; border-radius:8px; text-decoration:none;">Volver al inicio</a>
            </body>
          </html>
        `
      };
    }

    // Otros métodos → no permitidos
    return {
      statusCode: 405,
      headers: { "Content-Type": "text/plain" },
      body: 'Método no permitido'
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: err.message })
    };
  }
};
