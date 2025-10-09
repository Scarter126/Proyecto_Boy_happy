/**
 * Static Server - Servidor de assets estáticos (JS, CSS)
 *
 * Responsabilidad:
 * - Servir archivos .js y .css desde /shared/ y /scripts/
 * - Caché agresivo (1 año) para assets estáticos
 * - Validación de extensiones permitidas
 * - CORS habilitado
 *
 * Rutas soportadas:
 * - /shared/utils/constants.js
 * - /shared/components/ui.js
 * - /shared/assets/main.css
 * - /scripts/admin/dashboard.js
 * - /scripts/home.js
 */

const fs = require('fs');
const path = require('path');

// MIME types permitidos (solo JS y CSS)
const MIME_TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

/**
 * Directorio base del frontend
 */
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

/**
 * Sirve un archivo estático
 * @param {Object} event - Evento de API Gateway
 * @returns {Object} Respuesta HTTP
 */
exports.serve = async (event) => {
  try {
    const requestPath = event.path || event.rawPath || '';

    console.log('📄 Static file request:', requestPath);

    // Validar extensión
    const ext = path.extname(requestPath);
    if (!MIME_TYPES[ext]) {
      console.warn(`❌ Invalid extension: ${ext} for path: ${requestPath}`);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Not Found - Invalid file type (only .js and .css allowed)'
      };
    }

    // Construir path absoluto
    // /shared/utils/constants.js → frontend/shared/utils/constants.js
    // /scripts/admin/index.js → frontend/scripts/admin/index.js
    let filePath;

    if (requestPath.startsWith('/shared/')) {
      // /shared/utils/constants.js → frontend/shared/utils/constants.js
      filePath = path.join(FRONTEND_DIR, requestPath.substring(1));
    } else if (requestPath.startsWith('/scripts/')) {
      // /scripts/admin/index.js → frontend/scripts/admin/index.js
      filePath = path.join(FRONTEND_DIR, requestPath.substring(1));
    } else {
      console.warn(`❌ Invalid path prefix: ${requestPath}`);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Not Found - Invalid path'
      };
    }

    console.log('📂 Resolved file path:', filePath);

    // Validación de seguridad: evitar path traversal (.., etc.)
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(FRONTEND_DIR)) {
      console.error(`🚨 Path traversal attempt detected: ${requestPath}`);
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Forbidden - Path traversal not allowed'
      };
    }

    // Leer archivo
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`❌ File not found: ${filePath}`);
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'text/plain' },
          body: 'Not Found'
        };
      }
      throw error; // Re-throw para otros errores
    }

    console.log(`✅ File served: ${requestPath} (${content.length} chars)`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': MIME_TYPES[ext],
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 año de caché
        'Access-Control-Allow-Origin': '*', // CORS
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: content
    };

  } catch (error) {
    console.error('❌ Error serving static file:', error.message);
    console.error('Stack:', error.stack);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Internal Server Error'
    };
  }
};
