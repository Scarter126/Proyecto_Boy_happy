const AWS = require('aws-sdk');
const { createTemplateRenderer } = require('./template-renderer');

// Handlers simples - sin lógica adicional
exports.adminHandler = createTemplateRenderer('admin');
exports.profesoresHandler = createTemplateRenderer('profesores');
exports.alumnosHandler = createTemplateRenderer('alumnos');
exports.fonoHandler = createTemplateRenderer('fono');
exports.tomaHoraHandler = createTemplateRenderer('toma_hora');
exports.homeHandler = createTemplateRenderer('home');

// Handler con lógica especial - Galería con S3
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.galeriaHandler = createTemplateRenderer('galeria', {
  processHtml: async (html) => {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Prefix: 'public/',
      };

      const data = await s3.listObjectsV2(params).promise();
      const images = data.Contents?.filter(obj => obj.Size > 0) || [];

      // Generar URLs firmadas
      const imageTags = images.map(img => {
        const imageUrl = s3.getSignedUrl('getObject', {
          Bucket: BUCKET_NAME,
          Key: img.Key,
          Expires: 60 * 60 // 1 hora
        });
        return `<img src="${imageUrl}" alt="Imagen Boy Happy" onclick="window.open('${imageUrl}', '_blank')">`;
      }).join('\n');

      const finalImages = imageTags || `
        <div class="no-images">
          <i class="fas fa-images"></i>
          <p>No hay imágenes públicas disponibles en este momento.</p>
        </div>
      `;

      // Insertar imágenes en el HTML
      return html.replace('<!-- IMAGES -->', finalImages);
    } catch (error) {
      console.error('Error generando la galería:', error);
      return html.replace('<!-- IMAGES -->', `
        <div class="no-images">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Error al cargar las imágenes.</p>
        </div>
      `);
    }
  }
});
