/**
 * Script para resetear contraseña del usuario admin
 *
 * Útil cuando se olvida la contraseña del administrador
 */

require('dotenv').config({ path: './.env' });
const { CognitoIdentityProviderClient, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

// Configurar AWS SDK v3
const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const ADMIN_EMAIL = 'admin@boyhappy.cl';

/**
 * Generar contraseña temporal segura
 */
function generatePassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let password = '';

  // Asegurar que tenga al menos: 1 mayúscula, 1 minúscula, 1 número, 1 especial
  password += 'A';
  password += 'a';
  password += '1';
  password += '!';

  // Completar el resto aleatoriamente
  for (let i = password.length; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  // Mezclar caracteres
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Main: Resetear contraseña del admin
 */
async function main() {
  console.log('🔐 Reseteando contraseña del administrador...\n');

  if (!process.env.USER_POOL_ID) {
    console.error('❌ ERROR: USER_POOL_ID no está configurado en .env');
    process.exit(1);
  }

  try {
    // Generar nueva contraseña temporal
    const newPassword = generatePassword();

    // Resetear contraseña en Cognito
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: ADMIN_EMAIL,
      Password: newPassword,
      Permanent: false // Será temporal, usuario debe cambiarla
    }));

    console.log('✅ Contraseña reseteada exitosamente\n');
    console.log('='.repeat(60));
    console.log('🔑 NUEVA CONTRASEÑA TEMPORAL');
    console.log('='.repeat(60));
    console.log(`   Usuario: ${ADMIN_EMAIL}`);
    console.log(`   Contraseña Temporal: ${newPassword}`);
    console.log('='.repeat(60));
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   1. Esta contraseña es TEMPORAL');
    console.log('   2. Deberás cambiarla en el primer login');
    console.log('   3. Guarda esta contraseña en un lugar seguro');
    console.log('   4. No se mostrará nuevamente');
    console.log('\n🔗 URL de Login:');
    console.log(`   ${process.env.API_URL || 'https://...'}/login\n`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code === 'UserNotFoundException') {
      console.error('   El usuario admin no existe. Ejecuta primero: node scripts/init-admin.js');
    }
    process.exit(1);
  }
}

main();
