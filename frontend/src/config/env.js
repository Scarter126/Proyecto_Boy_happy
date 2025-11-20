/**
 * Configuración de variables de entorno
 *
 * Bun.build() reemplazará process.env.* con los valores reales del .env durante el build
 * Las referencias a process.env se reemplazan en tiempo de build con valores literales
 */

export const env = {
  // Modo
  NODE_ENV: process.env.NODE_ENV || 'development',

  // API
  API_URL: process.env.API_URL || '',

  // AWS Cognito
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || '',
  COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || '',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
};

// Helper para detectar si estamos en desarrollo
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
