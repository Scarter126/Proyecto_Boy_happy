/**
 * Helper para crear respuestas HTTP estandarizadas con headers CORS
 *
 * Uso:
 * const { success, error, badRequest } = require('/opt/nodejs/responseHelper');
 *
 * return success(data);
 * return error(500, 'Error message');
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Amz-Date, X-Api-Key, X-Amz-Security-Token'
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
  CORS_HEADERS
};
