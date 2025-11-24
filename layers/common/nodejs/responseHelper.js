/**
 * Helper para crear respuestas HTTP estandarizadas con headers CORS
 *
 * Uso:
 * const { success, error, badRequest, getCorsHeaders } = require('/opt/nodejs/responseHelper');
 *
 * return success(data);
 * return error(500, 'Error message');
 */

// Orígenes permitidos para CORS
const ALLOWED_ORIGINS = [
  'http://localhost:3005',
  'http://127.0.0.1:3005',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

/**
 * Obtiene headers CORS dinámicos basados en el origen del request
 * Si el origen está en la whitelist, se permite; sino, se usa localhost por defecto
 */
function getCorsHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || 'http://localhost:3005';

  // Verificar si el origen está en la whitelist o es un bucket S3
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
                    origin.includes('.s3-website') ||
                    origin.includes('.s3.amazonaws.com');

  const allowedOrigin = isAllowed ? origin : 'http://localhost:3005';

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Requested-With'
  };
}

// Headers CORS por defecto (para backwards compatibility)
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'http://localhost:3005',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Requested-With'
};

/**
 * Respuesta exitosa (200)
 */
function success(data, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data)
  };
}

/**
 * Respuesta de error genérica
 */
function error(statusCode, message, details = null) {
  const body = { error: message };
  if (details) {
    body.details = details;
  }

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body)
  };
}

/**
 * Bad Request (400)
 */
function badRequest(message, details = null) {
  return error(400, message, details);
}

/**
 * Unauthorized (401)
 */
function unauthorized(message = 'No autenticado') {
  return error(401, message);
}

/**
 * Forbidden (403)
 */
function forbidden(message = 'Acceso denegado') {
  return error(403, message);
}

/**
 * Not Found (404)
 */
function notFound(message = 'Recurso no encontrado') {
  return error(404, message);
}

/**
 * Internal Server Error (500)
 */
function serverError(message = 'Error interno del servidor', details = null) {
  console.error('Server error:', message, details);
  return error(500, message, details);
}

/**
 * Parsea body de request con manejo de errores
 */
function parseBody(event) {
  try {
    if (!event.body) {
      throw new Error('Body is required');
    }
    return JSON.parse(event.body);
  } catch (e) {
    throw new Error('Invalid JSON format');
  }
}

/**
 * Valida campos requeridos
 */
function validateRequired(data, requiredFields) {
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
  }
}

module.exports = {
  success,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  parseBody,
  validateRequired,
  getCorsHeaders,
  CORS_HEADERS
};
