/**
 * Shared Configuration for API Lambdas
 *
 * Centraliza valores de configuración compartidos y defaults.
 * Elimina la necesidad de fallbacks `||` duplicados en cada lambda.
 */

/**
 * Configuración de Email
 *
 * IMPORTANTE: Durante CDK synthesis (build time), estas variables pueden no estar disponibles.
 * Solo validamos en runtime (cuando AWS_REGION está definido = Lambda execution context).
 */
const SOURCE_EMAIL = process.env.SOURCE_EMAIL;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL;

/**
 * Validación: Solo en runtime (Lambda execution), no durante CDK build
 */
const isLambdaRuntime = !!process.env.AWS_REGION && !!process.env.AWS_EXECUTION_ENV;

if (isLambdaRuntime) {
  if (!SOURCE_EMAIL) {
    throw new Error('SOURCE_EMAIL environment variable is required');
  }

  if (!CONTACT_EMAIL) {
    throw new Error('CONTACT_EMAIL environment variable is required');
  }
}

module.exports = {
  SOURCE_EMAIL,
  CONTACT_EMAIL
};
