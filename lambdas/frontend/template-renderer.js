const fs = require('fs');
const path = require('path');

/**
 * Factory para crear handlers de Lambda que renderizan templates HTML
 * @param {string} templateName - Nombre del template (sin extensión)
 * @param {object} options - Opciones adicionales
 * @returns {function} Handler de Lambda
 */
function createTemplateRenderer(templateName, options = {}) {
  // Retornar el handler que carga archivos en runtime
  return async (event, context) => {
    let htmlTemplate, cssContent, scriptContent = '';

    try {
      // Ahora el asset es 'lambdas/', entonces:
      // __dirname = /var/task/frontend (ya NO incluye 'lambdas')
      // Los templates están en /var/task/templates
      const templatesPath = path.join(__dirname, '../templates');

      // Cargar archivos en runtime (no en tiempo de carga del módulo)
      htmlTemplate = fs.readFileSync(
        path.join(templatesPath, `pages/${templateName}.html`),
        'utf-8'
      );

      cssContent = fs.readFileSync(
        path.join(templatesPath, 'shared/boyhappy-styles.css'),
        'utf-8'
      );

      // Algunos templates no tienen JS (como galeria)
      const scriptPath = path.join(templatesPath, `scripts/${templateName}.js`);
      if (fs.existsSync(scriptPath)) {
        scriptContent = fs.readFileSync(scriptPath, 'utf-8');
      }
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      console.error('__dirname:', __dirname);
      console.error('Process cwd:', process.cwd());

      // Listar archivos para debugging
      try {
        const rootFiles = fs.readdirSync('/var/task');
        console.error('Files in /var/task:', rootFiles);

        if (fs.existsSync('/var/task/frontend')) {
          const frontendFiles = fs.readdirSync('/var/task/frontend');
          console.error('Files in /var/task/frontend:', frontendFiles);
        }

        if (fs.existsSync('/var/task/templates')) {
          const templateFiles = fs.readdirSync('/var/task/templates');
          console.error('Files in /var/task/templates:', templateFiles);
        } else {
          console.error('ERROR: /var/task/templates does not exist!');
        }
      } catch (e) {
        console.error('Could not list files:', e);
      }

      return {
        statusCode: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: `<h1>Error al cargar la página</h1><p>Template: ${templateName}</p><p>${error.message}</p><pre>${error.stack}</pre>`
      };
    }
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
