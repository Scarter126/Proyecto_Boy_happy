/**
 * Helper para cargar módulos desde Lambda Layer (AWS) o ruta local (desarrollo)
 *
 * Detecta automáticamente el entorno:
 * - AWS Lambda: usa /opt/nodejs/ (Lambda Layers)
 * - Desarrollo local: usa rutas relativas ../layers/common/nodejs/
 *
 * @param {string} moduleName - Nombre del módulo a cargar (ej: 'authMiddleware', 'responseHelper')
 * @returns {object} El módulo cargado
 */
const requireLayer = (moduleName) => {
  // Detectar si estamos en AWS Lambda
  const isLambda = !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

  if (isLambda) {
    // En AWS Lambda, cargar desde Layer
    return require(`/opt/nodejs/${moduleName}`);
  } else {
    // En desarrollo local, cargar desde ruta relativa
    return require(`../layers/common/nodejs/${moduleName}`);
  }
};

module.exports = requireLayer;
