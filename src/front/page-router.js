const fs = require('fs');
const path = require('path');

/**
 * Lambda handler para servir páginas HTML estáticas
 * Rutea basado en el path de la request
 */
exports.handler = async (event) => {
  try {
    const requestPath = event.path || event.rawPath || '/';

    // Mapeo de rutas a archivos HTML y sus recursos
    const routeMap = {
      '/': { html: 'home.html', script: 'home.js' },
      '/admin': { html: 'admin.html', script: 'admin.js' },
      '/profesores': { html: 'profesores.html', script: 'profesores.js' },
      '/alumnos': { html: 'alumnos.html', script: 'alumnos.js' },
      '/fono': { html: 'fono.html', script: 'fono.js' },
      '/galeria': { html: 'galeria.html', script: 'home.js' },
      '/toma-hora': { html: 'toma_hora.html', script: 'toma_hora.js' },
      '/reset-password': { html: 'reset-password.html', script: 'home.js' },
    };

    // Determinar qué archivos servir
    const route = routeMap[requestPath] || { html: 'home.html', script: 'home.js' };
    const htmlPath = path.join(__dirname, 'pages', route.html);
    const scriptPath = path.join(__dirname, 'scripts', route.script);
    const cssPath = path.join(__dirname, 'shared', 'boyhappy-styles.css');
    const authJsPath = path.join(__dirname, 'shared', 'auth.js');

    // Leer el archivo HTML
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Leer archivos CSS y JS
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');
    const authJs = fs.readFileSync(authJsPath, 'utf8');

    // Reemplazar variables de entorno en el HTML
    htmlContent = htmlContent
      .replace(/{{API_URL}}/g, process.env.API_URL || '')
      .replace(/{{CLIENT_ID}}/g, process.env.CLIENT_ID || '')
      .replace(/{{COGNITO_DOMAIN}}/g, process.env.COGNITO_DOMAIN || '');

    // Inyectar CSS en el HTML
    const cssTag = `<style>${cssContent}</style>`;
    htmlContent = htmlContent.replace('<!-- STYLES -->', cssTag);

    // Inyectar configuración global de la aplicación
    const configScript = `
    <script>
      // Global configuration injected by Lambda
      window.APP_CONFIG = {
        API_URL: '${process.env.API_URL || ''}',
        CLIENT_ID: '${process.env.CLIENT_ID || ''}',
        COGNITO_DOMAIN: '${process.env.COGNITO_DOMAIN || ''}'
      };
      // Legacy support - keep these for backward compatibility
      const API_URL = window.APP_CONFIG.API_URL;
      const CLIENT_ID = window.APP_CONFIG.CLIENT_ID;
      const COGNITO_DOMAIN = window.APP_CONFIG.COGNITO_DOMAIN;
      const REDIRECT_URI = API_URL + '/callback';
    </script>`;

    // Inyectar JavaScript en el HTML (incluir config + auth.js + script específico de la página)
    const scriptTag = `${configScript}\n    <script>${authJs}</script>\n    <script>${scriptContent}</script>`;
    htmlContent = htmlContent.replace('<!-- SCRIPT -->', scriptTag);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
      body: htmlContent,
    };

  } catch (error) {
    console.error('Error serving page:', error);

    return {
      statusCode: error.code === 'ENOENT' ? 404 : 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
      body: `
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body>
          <h1>${error.code === 'ENOENT' ? 'Página no encontrada' : 'Error del servidor'}</h1>
          <p>${error.message}</p>
        </body>
        </html>
      `,
    };
  }
};
