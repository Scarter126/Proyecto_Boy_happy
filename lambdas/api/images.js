const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async (event) => {
  try {
    const isBase64Encoded = event.isBase64Encoded || false;
    const contentType = event.headers?.['Content-Type'] || event.headers?.['content-type'] || 'application/json';

    let body = event.body;
    if (isBase64Encoded && contentType.includes('application/json')) {
      body = Buffer.from(event.body, 'base64').toString('utf-8');
    }

    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    const { imageName, imageData, grupo, album } = parsed;

    if (!imageName || !imageData || !grupo) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Faltan parámetros requeridos: imageName, imageData, grupo' }),
      };
    }

    if (grupo !== 'public' && grupo !== 'private') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'El grupo debe ser "public" o "private"' }),
      };
    }

    // Validación de álbum para imágenes privadas
    if (grupo === 'private' && !album) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Debes especificar un álbum para imágenes privadas' }),
      };
    }

    // Decodifica base64
    const base64Data = Buffer.from(
      imageData.replace(/^data:image\/\w+;base64,/, ''), 
      'base64'
    );

    // Detecta el tipo de contenido
    const contentTypeMatch = imageData.match(/data:(image\/\w+);base64,/);
    const resolvedContentType = contentTypeMatch ? contentTypeMatch[1] : 'image/jpeg';

    // Carpeta según grupo y álbum
    const folder = album ? `${grupo}/${album}` : grupo;
    const key = `${folder}/${Date.now()}_${imageName}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: base64Data,
      ContentEncoding: 'base64',
      ContentType: resolvedContentType,
    };

    await s3.putObject(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Imagen subida exitosamente al grupo "${grupo}"`,
        key,
      }),
    };
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al subir la imagen', error: error.message }),
    };
  }
};
