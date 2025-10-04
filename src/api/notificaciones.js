const AWS = require('aws-sdk');
const ses = new AWS.SES();
const docClient = new AWS.DynamoDB.DocumentClient();

const USUARIOS_TABLE = process.env.USUARIOS_TABLE;
const SOURCE_EMAIL = process.env.SOURCE_EMAIL;

exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);
    const { destinatarios, asunto, mensaje } = data;

    // Validar campos requeridos
    if (!destinatarios || !asunto || !mensaje) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Faltan campos requeridos: destinatarios, asunto, mensaje' })
      };
    }

    // Obtener emails según destinatarios
    let emailsDestino = [];

    if (destinatarios === 'todos') {
      // Obtener todos los usuarios activos
      const usuarios = await docClient.scan({
        TableName: USUARIOS_TABLE,
        FilterExpression: 'activo = :activo',
        ExpressionAttributeValues: { ':activo': true }
      }).promise();
      emailsDestino = usuarios.Items.map(u => u.correo);
    } else {
      // Filtrar por rol específico
      const usuarios = await docClient.scan({
        TableName: USUARIOS_TABLE,
        FilterExpression: 'rol = :rol AND activo = :activo',
        ExpressionAttributeValues: {
          ':rol': destinatarios,
          ':activo': true
        }
      }).promise();
      emailsDestino = usuarios.Items.map(u => u.correo);
    }

    if (emailsDestino.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No se encontraron destinatarios' })
      };
    }

    // Enviar emails (en lotes para evitar límites de SES)
    const resultados = [];
    const errores = [];

    for (const email of emailsDestino) {
      try {
        await ses.sendEmail({
          Source: SOURCE_EMAIL,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: asunto, Charset: 'UTF-8' },
            Body: {
              Text: { Data: mensaje, Charset: 'UTF-8' },
              Html: {
                Data: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="UTF-8">
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: #004080; color: white; padding: 15px; text-align: center; }
                      .content { padding: 20px; background: #f9f9f9; }
                      .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h2>Boy Happy - Centro Educativo</h2>
                      </div>
                      <div class="content">
                        <p>${mensaje.replace(/\n/g, '<br>')}</p>
                      </div>
                      <div class="footer">
                        <p>Este es un mensaje automático, por favor no responder.</p>
                      </div>
                    </div>
                  </body>
                  </html>
                `,
                Charset: 'UTF-8'
              }
            }
          }
        }).promise();
        resultados.push(email);
      } catch (error) {
        console.error(`Error enviando email a ${email}:`, error);
        errores.push({ email, error: error.message });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enviados: resultados.length,
        errores: errores.length,
        detalles: {
          exitosos: resultados,
          fallidos: errores
        }
      })
    };

  } catch (error) {
    console.error('Error en notificaciones.handler:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message })
    };
  }
};
