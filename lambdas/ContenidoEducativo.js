const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const BUCKET_NAME = process.env.BUCKET_NAME;

// Tiempo de validez de la URL firmada en segundos (por ejemplo, 1 hora)
const URL_EXPIRATION = 3600;

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    const { tipo, nombre, contenidoBase64 } = JSON.parse(event.body || '{}');

    if (!tipo || !['avances','reglamentos','reportes','observaciones','material'].includes(tipo)) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Tipo inválido' }) };
    }

    const key = nombre ? `${tipo}/${nombre}` : null;

    switch (method) {
      case 'POST':
      case 'PUT':
        if (!key || !contenidoBase64) {
          return { statusCode: 400, body: JSON.stringify({ message: 'Faltan datos para subir/actualizar' }) };
        }
        await s3.putObject({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: Buffer.from(contenidoBase64, 'base64')
        }).promise();
        return { statusCode: 200, body: JSON.stringify({ message: 'Archivo guardado correctamente' }) };

      case 'DELETE':
        if (!key) {
          return { statusCode: 400, body: JSON.stringify({ message: 'Faltan datos para eliminar' }) };
        }
        await s3.deleteObject({ Bucket: BUCKET_NAME, Key: key }).promise();
        return { statusCode: 200, body: JSON.stringify({ message: 'Archivo eliminado correctamente' }) };

      case 'GET':
        // Si envían un nombre, generar URL firmada; si no, listar archivos
        if (nombre) {
          const signedUrl = s3.getSignedUrl('getObject', {
            Bucket: BUCKET_NAME,
            Key: key,
            Expires: URL_EXPIRATION
          });
          return { statusCode: 200, body: JSON.stringify({ url: signedUrl }) };
        } else {
          const list = await s3.listObjectsV2({ Bucket: BUCKET_NAME, Prefix: `${tipo}/` }).promise();
          const archivos = list.Contents.map(obj => obj.Key.replace(`${tipo}/`, ''));
          return { statusCode: 200, body: JSON.stringify({ archivos }) };
        }

      default:
        return { statusCode: 405, body: JSON.stringify({ message: 'Método no permitido' }) };
    }

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Error interno', error: err.message }) };
  }
};
