/**
 * Shared Configuration for API Lambdas
 *
 * Centraliza valores de configuración compartidos y defaults.
 * Elimina la necesidad de fallbacks `||` duplicados en cada lambda.
 */

/**
 * Configuración de Email
 */
const SOURCE_EMAIL = process.env.SOURCE_EMAIL;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL;

/**
 * Validación: Asegurar que variables críticas estén definidas
 */
if (!SOURCE_EMAIL) {
  throw new Error('SOURCE_EMAIL environment variable is required');
}

if (!CONTACT_EMAIL) {
  throw new Error('CONTACT_EMAIL environment variable is required');
}

module.exports = {
  SOURCE_EMAIL,
  CONTACT_EMAIL
};
