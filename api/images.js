const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const requireLayer = require('./requireLayer');
const { getCorsHeaders } = requireLayer('responseHelper');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({});

const IMAGES_BUCKET = process.env.IMAGES_BUCKET;

exports.handler = async (event) => {
  // Obtener headers CORS dinámicos basados en el origen del request
  const corsHeaders = getCorsHeaders(event);

  console.log('Images handler - Method:', event.httpMethod, 'QueryParams:', event.queryStringParameters);

  try {
    const method = event.httpMethod;
    const queryParams = event.queryStringParameters || {};

    // GET: Listar imágenes o álbumes
    if (method === 'GET') {
      // Si piden lista de álbumes
      if (queryParams.action === 'albums') {
        const albums = await listarAlbumes();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ albums })
        };
      }

      // Listar imágenes (opcionalmente filtradas por álbum)
      const album = queryParams.album;
      const imagenes = await listarImagenes(album);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(imagenes)
      };
    }

    // POST: Subir imagen
    if (method === 'POST') {
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
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Faltan parámetros requeridos: imageName, imageData, grupo' }),
        };
      }

      if (grupo !== 'public' && grupo !== 'private') {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'El grupo debe ser "public" o "private"' }),
        };
      }

      // Validación de álbum para imágenes privadas
      if (grupo === 'private' && !album) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
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

      const command = new PutObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: key,
        Body: base64Data,
        ContentEncoding: 'base64',
        ContentType: resolvedContentType,
      });

      await s3Client.send(command);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: `Imagen subida exitosamente al grupo "${grupo}"`,
          key,
        }),
      };
    }

    // DELETE: Eliminar imagen
    if (method === 'DELETE') {
      const isBase64Encoded = event.isBase64Encoded || false;
      const contentType = event.headers?.['Content-Type'] || event.headers?.['content-type'] || 'application/json';

      let body = event.body;
      if (isBase64Encoded && contentType.includes('application/json')) {
        body = Buffer.from(event.body, 'base64').toString('utf-8');
      }

      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      const { key } = parsed;

      if (!key) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Falta el parámetro requerido: key' }),
        };
      }

      const command = new DeleteObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: key
      });

      await s3Client.send(command);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Imagen eliminada exitosamente',
          key,
        }),
      };
    }

    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Método no permitido' })
    };

  } catch (error) {
    console.error('Error en images handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Error al procesar la solicitud', error: error.message }),
    };
  }
};

// Listar álbumes disponibles (carpetas public/*)
async function listarAlbumes() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: IMAGES_BUCKET,
      Prefix: 'public/',
      Delimiter: '/'
    });

    const response = await s3Client.send(command);
    const albums = (response.CommonPrefixes || [])
      .map(prefix => prefix.Prefix.replace('public/', '').replace('/', ''))
      .filter(album => album); // Filtrar vacíos

    return albums;
  } catch (error) {
    console.error('Error listando álbumes:', error);
    return [];
  }
}

// Listar imágenes (opcionalmente por álbum) con URL firmada
async function listarImagenes(album = null) {
  try {
    const prefix = album ? `public/${album}/` : 'public/';

    const command = new ListObjectsV2Command({
      Bucket: IMAGES_BUCKET,
      Prefix: prefix
    });

    const response = await s3Client.send(command);
    const imagenes = await Promise.all(
      (response.Contents || [])
        .filter(obj => obj.Key.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        .map(async (obj) => {
          const albumName = obj.Key.split('/')[1] || 'Sin álbum';
          const getCommand = new GetObjectCommand({
            Bucket: IMAGES_BUCKET,
            Key: obj.Key
          });
          const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 }); // 1 hora
          return {
            key: obj.Key,
            url: signedUrl,
            album: albumName,
            size: obj.Size,
            lastModified: obj.LastModified
          };
        })
    );

    return imagenes;
  } catch (error) {
    console.error('Error listando imágenes:', error);
    return [];
  }
}

// Metadata para auto-discovery de CDK
exports.metadata = {
  route: '/images',
  methods: ['GET', 'POST', 'DELETE'],
  auth: false, // Permitir GET público, validación manual para POST/DELETE
  profile: 'medium',
  buckets: ['Images:readwrite']
};
