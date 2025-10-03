const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async () => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: 'public/', // Solo imágenes públicas/visibles en galería
    };

    const data = await s3.listObjectsV2(params).promise();
    const images = data.Contents?.filter(obj => obj.Size > 0) || [];

    // Generar URLs firmadas
    const imageTags = images.map(img => {
      const imageUrl = s3.getSignedUrl('getObject', {
        Bucket: BUCKET_NAME,
        Key: img.Key,
        Expires: 60 * 60 // Link válido por 1 hora
      });
      return `<img src="${imageUrl}" alt="Imagen">`;
    }).join('\n');

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Galería - Colegio Boy Happy</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin:0; background:#f4f8fb; }
        header { background:#004080; color:white; padding:1em; }
        .gallery {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px;
        }
        .gallery img { width: 100%; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); object-fit: cover; }
        a.btn { display:inline-block; margin:20px; text-decoration:none; color:white; background:#004080; padding:10px 20px; border-radius:8px; }
        a.btn:hover { background:#0066cc; }
      </style>
    </head>
    <body>
      <header><h1>Galería Colegio Boy Happy</h1></header>
      <div class="gallery">
        ${imageTags || '<p>No hay imágenes públicas disponibles.</p>'}
      </div>
      <a class="btn" href="./">Volver al inicio</a>
    </body>
    </html>
    `;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
      },
      body: html,
    };

  } catch (error) {
    console.error('Error generando la galería:', error);
    return {
      statusCode: 500,
      body: 'Error al generar la galería',
    };
  }
};
