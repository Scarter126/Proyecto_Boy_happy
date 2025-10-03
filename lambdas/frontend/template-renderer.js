const fs = require('fs');
const path = require('path');

/**
 * Factory para crear handlers de Lambda que renderizan templates HTML
 * @param {string} templateName - Nombre del template (sin extensión)
 * @param {object} options - Opciones adicionales
 * @returns {function} Handler de Lambda
 */
function createTemplateRenderer(templateName, options = {}) {
  // Cargar archivos en tiempo de compilación (solo una vez)
  const htmlTemplate = fs.readFileSync(
    path.join(__dirname, `../../templates/pages/${templateName}.html`),
    'utf-8'
  );

  const cssContent = fs.readFileSync(
    path.join(__dirname, '../../templates/shared/boyhappy-styles.css'),
    'utf-8'
  );

  // Algunos templates no tienen JS (como galeria)
  let scriptContent = '';
  const scriptPath = path.join(__dirname, `../../templates/scripts/${templateName}.js`);
  if (fs.existsSync(scriptPath)) {
    scriptContent = fs.readFileSync(scriptPath, 'utf-8');
  }

  // Retornar el handler
  return async (event, context) => {
    try {
      // Insertar CSS y JS inline en el HTML
      let html = htmlTemplate
        .replace('<!-- STYLES -->', `<style>${cssContent}</style>`);

      // Inyectar variables de configuración global desde variables de entorno
      const callbackPrefix = process.env.CALLBACK_PREFIX || '';
      const clientId = process.env.CLIENT_ID || '';
      const cognitoDomain = process.env.COGNITO_DOMAIN || '';
      const apiUrl = process.env.API_URL || '';
      const configScript = `
        <script>
          // Configuración global del sistema
          window.APP_CONFIG = {
            CALLBACK_PREFIX: '${callbackPrefix}',
            API_URL: '${apiUrl}',
            CLIENT_ID: '${clientId}',
            COGNITO_DOMAIN: '${cognitoDomain}'
          };
        </script>
      `;
      html = html.replace('</head>', configScript + '</head>');

      // Solo insertar script si existe
      if (scriptContent) {
        html = html.replace('<!-- SCRIPT -->', `<script>${scriptContent}</script>`);
      }

      // Opciones adicionales (ej: para galeria que necesita imágenes dinámicas)
      if (options.processHtml) {
        html = await options.processHtml(html, event, context);
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...options.headers
        },
        body: html
      };
    } catch (error) {
      console.error(`Error rendering template ${templateName}:`, error);
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: '<h1>Error al cargar la página</h1><p>Por favor intente nuevamente.</p>'
      };
    }
  };
}

module.exports = { createTemplateRenderer };
