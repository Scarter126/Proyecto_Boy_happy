/**
 * Frontend Server - Lambda unificada para servir páginas HTML y assets estáticos
 *
 * Responsabilidades:
 * - Routing interno entre page-renderer y static-server
 * - Servir páginas HTML dinámicas (/, /admin, /alumnos, etc.)
 * - Servir assets estáticos (/shared/*, /scripts/*)
 *
 * Arquitectura:
 * - handler.js (este archivo): Entry point, routing interno
 * - page-renderer.js: Genera HTML dinámico con auto-discovery
 * - static-server.js: Sirve archivos JS/CSS con caché agresivo
 */

const pageRenderer = require('./page-renderer');
const staticServer = require('./static-server');

/**
 * Determina si una ruta es un asset estático
 * @param {string} path - Ruta de la solicitud
 * @returns {boolean}
 */
function isStaticAsset(path) {
  return path.startsWith('/shared/') || path.startsWith('/scripts/');
}

/**
 * Handler principal de la lambda
 */
exports.handler = async (event) => {
  try {
    let path = event.path || event.rawPath || '/';

    // Cuando viene de {proxy+}, necesitamos reconstruir el path completo
    // API Gateway puede enviar solo el path después del prefijo
    const pathParameters = event.pathParameters || {};
    const proxy = pathParameters.proxy;

    console.log('DEBUG - Original path:', path);
    console.log('DEBUG - Path parameters:', JSON.stringify(pathParameters));
    console.log('DEBUG - Proxy:', proxy);

    // Si tenemos proxy parameter y el path no incluye /shared/ o /scripts/, reconstruirlo
    if (proxy && !path.includes('/shared/') && !path.includes('/scripts/')) {
      // Determinar el prefijo basado en el path original
      if (path.startsWith('/shared') || proxy.startsWith('shared')) {
        path = '/shared/' + (proxy.startsWith('shared/') ? proxy.substring(7) : proxy);
      } else if (path.startsWith('/scripts') || proxy.startsWith('scripts')) {
        path = '/scripts/' + (proxy.startsWith('scripts/') ? proxy.substring(8) : proxy);
      }
      console.log('DEBUG - Reconstructed path:', path);
    }

    console.log('Frontend Server request:', path);

    // Routing interno
    if (isStaticAsset(path)) {
      // Servir assets estáticos (.js, .css)
      console.log('-> static-server');

      // Actualizar el event.path con el path reconstruido
      event.path = path;
      event.rawPath = path;

      return await staticServer.serve(event);
    } else {
      // Servir páginas HTML
      console.log('-> page-renderer');
      return await pageRenderer.render(event);
    }

  } catch (error) {
    console.error('❌ Frontend Server error:', error);
    console.error('Stack:', error.stack);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      },
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>500 - Server Error</title>
            <style>
              body { font-family: system-ui; max-width: 600px; margin: 100px auto; padding: 20px; }
              h1 { color: #e53e3e; }
              pre { background: #f7fafc; padding: 15px; border-radius: 5px; overflow-x: auto; }
            </style>
          </head>
          <body>
            <h1>500 - Internal Server Error</h1>
            <p>Ocurrió un error al procesar la solicitud.</p>
            <pre>${error.message}</pre>
          </body>
        </html>
      `
    };
  }
};
