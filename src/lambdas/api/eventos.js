const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { v4: uuidv4 } = require('uuid');
const { success, badRequest, notFound, serverError, parseBody } = require('/opt/nodejs/responseHelper');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

// Variables de entorno - Soportar tanto nombres legacy como nuevos
const EVENTOS_TABLE = process.env.EVENTOS_TABLE || process.env.COMUNICACIONES_TABLE || process.env.TABLE_NAME;
const MATRICULAS_TABLE = process.env.MATRICULAS_TABLE || process.env.COMUNICACIONES_TABLE;

exports.handler = async (event) => {
  try {
    const { httpMethod, path } = event;
    const basePath = path.split('?')[0]; // Remover query string si existe

    // --- 📌 EVENTOS ---
    if (basePath === "/eventos" || path.startsWith("/eventos")) {
      if (httpMethod === "POST") {
        const data = parseBody(event);

        if (!data.titulo || !data.fecha || !data.tipo) {
          return badRequest('Campos requeridos: titulo, fecha, tipo');
        }

        const item = {
          id: uuidv4(),
          titulo: data.titulo,
          descripcion: data.descripcion || '',
          fecha: data.fecha,
          hora: data.hora || "",
          tipo: data.tipo,
          curso: data.curso || ''
        };
        await docClient.send(new PutCommand({ TableName: EVENTOS_TABLE, Item: item }));
        return success(item);
      }

      if (httpMethod === "GET") {
        const result = await docClient.send(new ScanCommand({ TableName: EVENTOS_TABLE }));
        return success(result.Items || []);
      }

      if (httpMethod === "DELETE") {
        const { id } = event.queryStringParameters || {};
        if (!id) {
          return badRequest('Se requiere el parámetro id');
        }

        await docClient.send(new DeleteCommand({ TableName: EVENTOS_TABLE, Key: { id } }));
        return success({ message: "Evento eliminado" });
      }

      if (httpMethod === "PUT") {
        const { id } = event.queryStringParameters || {};
        if (!id) {
          return badRequest('Se requiere el parámetro id');
        }

        const data = parseBody(event);

        // Validar que el evento existe
        const existing = await docClient.send(new GetCommand({
          TableName: EVENTOS_TABLE,
          Key: { id }
        }));

        if (!existing.Item) {
          return notFound('Evento no encontrado');
        }

        // Actualizar evento
        await docClient.send(new UpdateCommand({
          TableName: EVENTOS_TABLE,
          Key: { id },
          UpdateExpression: "set titulo=:t, descripcion=:d, fecha=:f, hora=:h, tipo=:tp, curso=:c",
          ExpressionAttributeValues: {
            ":t": data.titulo,
            ":d": data.descripcion || existing.Item.descripcion,
            ":f": data.fecha,
            ":h": data.hora || "",
            ":tp": data.tipo,
            ":c": data.curso || existing.Item.curso
          }
        }));

        return success({ message: "Evento actualizado correctamente" });
      }
    }

    // --- 📌 MATRÍCULAS ---
    if (basePath === "/matriculas" || path.startsWith("/matriculas")) {
      if (httpMethod === "POST") {
        const data = parseBody(event);
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
        await docClient.send(new PutCommand({ TableName: MATRICULAS_TABLE, Item: item }));
        return { statusCode: 200, body: JSON.stringify(item) };
      }

      if (httpMethod === "GET") {
        const result = await docClient.send(new ScanCommand({ TableName: MATRICULAS_TABLE }));
        return { statusCode: 200, body: JSON.stringify(result.Items) };
      }

      // Commit 1.4.2: PUT para cambiar estado de matrícula
      if (httpMethod === "PUT") {
        const { id } = event.queryStringParameters;
        const data = JSON.parse(event.body);

        // Actualizar estado
        await docClient.send(new UpdateCommand({
          TableName: MATRICULAS_TABLE,
          Key: { id },
          UpdateExpression: 'SET estado = :e, motivo = :m',
          ExpressionAttributeValues: {
            ':e': data.estado,
            ':m': data.motivo || ''
          }
        }));

        // Commit 1.4.5: Obtener datos de la matrícula para enviar email
        const result = await docClient.send(new GetCommand({
          TableName: MATRICULAS_TABLE,
          Key: { id }
        }));

        const matricula = result.Item;

        // Enviar email automático
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
            await sesClient.send(new SendEmailCommand({
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
            }));
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
