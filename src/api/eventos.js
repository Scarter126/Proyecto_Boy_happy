const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient();

// Variables de entorno - Soportar tanto nombres legacy como nuevos
const EVENTOS_TABLE = process.env.EVENTOS_TABLE || process.env.COMUNICACIONES_TABLE || process.env.TABLE_NAME;
const MATRICULAS_TABLE = process.env.MATRICULAS_TABLE || process.env.COMUNICACIONES_TABLE;

exports.handler = async (event) => {
  try {
    const { httpMethod, resource } = event;

    // --- 📌 EVENTOS ---
    if (resource === "/eventos") {
      if (httpMethod === "POST") {
        const data = JSON.parse(event.body);
        const item = {
          id: uuidv4(),
          titulo: data.titulo,
          descripcion: data.descripcion,
          fecha: data.fecha,
          hora: data.hora || "",
          tipo: data.tipo,
          curso: data.curso
        };
        await docClient.put({ TableName: EVENTOS_TABLE, Item: item }).promise();
        return { statusCode: 200, body: JSON.stringify(item) };
      }

      if (httpMethod === "GET") {
        const result = await docClient.scan({ TableName: EVENTOS_TABLE }).promise();
        return { statusCode: 200, body: JSON.stringify(result.Items) };
      }

      if (httpMethod === "DELETE") {
        const { id } = event.queryStringParameters;
        await docClient.delete({ TableName: EVENTOS_TABLE, Key: { id } }).promise();
        return { statusCode: 200, body: JSON.stringify({ message: "Evento eliminado" }) };
      }

      if (httpMethod === "PUT") {
        const { id } = event.queryStringParameters;
        const data = JSON.parse(event.body);

        // Validar que el evento existe (Commit 1.3.2)
        const existing = await docClient.get({
          TableName: EVENTOS_TABLE,
          Key: { id }
        }).promise();

        if (!existing.Item) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Evento no encontrado' })
          };
        }

        // Actualizar evento
        await docClient.update({
          TableName: EVENTOS_TABLE,
          Key: { id },
          UpdateExpression: "set titulo=:t, descripcion=:d, fecha=:f, hora=:h, tipo=:tp, curso=:c",
          ExpressionAttributeValues: {
            ":t": data.titulo,
            ":d": data.descripcion || existing.Item.descripcion,
            ":f": data.fecha,
            ":h": data.hora || "",
            ":tp": data.tipo,
            ":c": data.curso
          }
        }).promise();

        return {
          statusCode: 200,
          body: JSON.stringify({ message: "Evento actualizado correctamente" })
        };
      }
    }

    // --- 📌 MATRÍCULAS ---
    if (resource === "/matriculas") {
      if (httpMethod === "POST") {
        const data = JSON.parse(event.body);
        const item = {
          id: uuidv4(),
          nombre: data.nombre,
          rut: data.rut,
          fechaNacimiento: data.fechaNacimiento,
          ultimoCurso: data.ultimoCurso,
          correo: data.correo,
          telefono: data.telefono,
          estado: 'pendiente', // Commit 1.4.2: Estado inicial
          fechaRegistro: new Date().toISOString()
        };
        await docClient.put({ TableName: MATRICULAS_TABLE, Item: item }).promise();
        return { statusCode: 200, body: JSON.stringify(item) };
      }

      if (httpMethod === "GET") {
        const result = await docClient.scan({ TableName: MATRICULAS_TABLE }).promise();
        return { statusCode: 200, body: JSON.stringify(result.Items) };
      }

      // Commit 1.4.2: PUT para cambiar estado de matrícula
      if (httpMethod === "PUT") {
        const { id } = event.queryStringParameters;
        const data = JSON.parse(event.body);

        // Actualizar estado
        await docClient.update({
          TableName: MATRICULAS_TABLE,
          Key: { id },
          UpdateExpression: 'SET estado = :e, motivo = :m',
          ExpressionAttributeValues: {
            ':e': data.estado,
            ':m': data.motivo || ''
          }
        }).promise();

        // Commit 1.4.5: Obtener datos de la matrícula para enviar email
        const result = await docClient.get({
          TableName: MATRICULAS_TABLE,
          Key: { id }
        }).promise();

        const matricula = result.Item;

        // Enviar email automático
        const ses = new AWS.SES();
        const SOURCE_EMAIL = process.env.SOURCE_EMAIL || 'noreply@boyhappy.cl';

        let mensaje;
        let asunto;

        if (data.estado === 'aprobada') {
          asunto = '¡Felicidades! Tu matrícula ha sido aprobada';
          mensaje = `Estimado/a ${matricula.nombre},

Nos complace informarte que tu solicitud de matrícula ha sido APROBADA.

Pronto nos contactaremos contigo para coordinar los siguientes pasos del proceso de matrícula.

Datos de tu solicitud:
- Nombre: ${matricula.nombre}
- RUT: ${matricula.rut}
- Último curso: ${matricula.ultimoCurso}

¡Bienvenido/a a Boy Happy!

Atentamente,
Equipo Boy Happy`;
        } else if (data.estado === 'rechazada') {
          asunto = 'Estado de tu solicitud de matrícula';
          mensaje = `Estimado/a ${matricula.nombre},

Lamentamos informarte que tu solicitud de matrícula no ha podido ser aprobada en este momento.

Motivo: ${data.motivo || 'No especificado'}

Si tienes dudas o deseas más información, no dudes en contactarnos.

Atentamente,
Equipo Boy Happy`;
        }

        if (mensaje) {
          try {
            await ses.sendEmail({
              Source: SOURCE_EMAIL,
              Destination: { ToAddresses: [matricula.correo] },
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
                          .header { background: ${data.estado === 'aprobada' ? '#155724' : '#721c24'}; color: white; padding: 15px; text-align: center; }
                          .content { padding: 20px; background: #f9f9f9; white-space: pre-line; }
                          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
                        </style>
                      </head>
                      <body>
                        <div class="container">
                          <div class="header">
                            <h2>Boy Happy - Centro Educativo</h2>
                          </div>
                          <div class="content">
                            ${mensaje.replace(/\n/g, '<br>')}
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
          } catch (emailError) {
            console.error('Error enviando email de notificación:', emailError);
            // No fallar el request si falla el email
          }
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Estado de matrícula actualizado y email enviado' })
        };
      }
    }

    return { statusCode: 400, body: "Ruta o método no soportado" };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};
