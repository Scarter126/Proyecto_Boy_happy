/**
 * Logger estructurado para lambdas
 */

function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  console.log(JSON.stringify(logEntry));
}

function info(message, meta = {}) {
  log('INFO', message, meta);
}

function error(message, meta = {}) {
  log('ERROR', message, meta);
}

function warn(message, meta = {}) {
  log('WARN', message, meta);
}

function debug(message, meta = {}) {
  log('DEBUG', message, meta);
}

/**
 * Log de inicio de request
 */
function logRequest(event, context) {
  info('Request received', {
    requestId: context.requestId,
    functionName: context.functionName,
    httpMethod: event.httpMethod,
    path: event.path,
    sourceIp: event.requestContext?.identity?.sourceIp,
  });
}

/**
 * Log de performance
 */
function logPerformance(context, startTime) {
  const duration = Date.now() - startTime;
  const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;

  info('Request completed', {
    requestId: context.requestId,
    duration: `${duration}ms`,
    memoryUsed: `${memoryUsed.toFixed(2)}MB`,
    memoryLimit: `${context.memoryLimitInMB}MB`,
    remainingTime: `${context.getRemainingTimeInMillis()}ms`,
  });
}

module.exports = {
  log,
  info,
  error,
  warn,
  debug,
  logRequest,
  logPerformance,
};
