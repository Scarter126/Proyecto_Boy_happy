/**
 * @deprecated ESTE ARCHIVO ESTÁ DEPRECADO - NO USAR
 *
 * Migrar a responseHelper.js que tiene funcionalidad completa y CORS headers correctos.
 *
 * Ver: layers/common/nodejs/utils/DEPRECATED.md para instrucciones de migración
 *
 * @see responseHelper.js
 */

/**
 * Utilidad compartida para respuestas HTTP
 */

/**
 * Respuesta HTTP estándar
 */
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Respuesta de error
 */
function errorResponse(statusCode, message, details = null) {
  return response(statusCode, {
    error: message,
    ...(details && { details }),
  });
}

/**
 * Respuesta de éxito
 */
function successResponse(data, message = null) {
  return response(200, {
    success: true,
    ...(message && { message }),
    data,
  });
}

module.exports = {
  response,
  errorResponse,
  successResponse,
};
