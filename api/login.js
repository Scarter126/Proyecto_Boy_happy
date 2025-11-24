const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} = require("@aws-sdk/client-cognito-identity-provider");
const crypto = require('crypto');

const requireLayer = require('./requireLayer');
const responseHelper = requireLayer('responseHelper');
const TABLE_KEYS = require('../shared/table-keys.cjs');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Función para calcular SECRET_HASH
function calculateSecretHash(username, clientId, clientSecret) {
  return crypto
    .createHmac('SHA256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}

exports.metadata = {
  route: '/login',
  methods: ['GET', 'POST'],
  auth: false,
  roles: [],
  profile: 'low',
  tables: [],
  additionalPolicies: []
};

exports.handler = async (event) => {
  try {
    // Si es GET, redirigir a Cognito Hosted UI (comportamiento legacy)
    if (event.httpMethod === 'GET') {
      const { CLIENT_ID, COGNITO_DOMAIN, API_URL } = process.env;
      if (!CLIENT_ID || !COGNITO_DOMAIN || !API_URL) {
        return responseHelper.serverError('Missing environment variables');
      }

      const redirectUri = `${API_URL}/callback`;
      const loginUrl = `https://${COGNITO_DOMAIN}/login?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=openid+email+profile`;

      return {
        statusCode: 302,
        headers: { Location: loginUrl },
      };
    }

    // Si es POST, autenticar con usuario y contraseña
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { username, password } = body;

      if (!username || !password) {
        return responseHelper.badRequest('Usuario y contraseña requeridos');
      }

      const { CLIENT_ID, USER_POOL_ID, CLIENT_SECRET } = process.env;
      if (!CLIENT_ID || !USER_POOL_ID) {
        return responseHelper.serverError('Missing Cognito configuration');
      }

      // Calcular SECRET_HASH si el cliente tiene secret
      const authParameters = {
        USERNAME: username,
        PASSWORD: password,
      };

      if (CLIENT_SECRET) {
        authParameters.SECRET_HASH = calculateSecretHash(username, CLIENT_ID, CLIENT_SECRET);
      }

      // Autenticar con Cognito usando USER_PASSWORD_AUTH
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: authParameters,
      });

      const response = await cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        return responseHelper.unauthorized('Error de autenticación');
      }

      const { IdToken, AccessToken, RefreshToken, ExpiresIn } = response.AuthenticationResult;

      // Decodificar el ID Token para obtener información del usuario
      const payload = JSON.parse(Buffer.from(IdToken.split('.')[1], 'base64').toString());
      const groups = payload['cognito:groups'] || [];

      // Determinar el rol principal
      let role = 'alumno';
      if (groups.includes('admin')) role = 'admin';
      else if (groups.includes('fono')) role = 'fono';
      else if (groups.includes('profesor')) role = 'profesor';
      else if (groups.includes('apoderado')) role = 'apoderado';

      return responseHelper.success({
        token: IdToken,
        accessToken: AccessToken,
        refreshToken: RefreshToken,
        expiresIn: ExpiresIn,
        user: {
          username: payload['cognito:username'],
          email: payload.email,
          name: payload.name || payload.email,
          role: role,
          groups: groups
        }
      });
    }

    return responseHelper.error(405, 'Método no permitido');

  } catch (error) {
    console.error("Error en login:", error);

    // Manejar errores específicos de Cognito
    if (error.name === 'NotAuthorizedException') {
      return responseHelper.unauthorized('Usuario o contraseña incorrectos');
    }
    if (error.name === 'UserNotFoundException') {
      return responseHelper.unauthorized('Usuario no encontrado');
    }
    if (error.name === 'UserNotConfirmedException') {
      return responseHelper.unauthorized('Usuario no confirmado');
    }

    return responseHelper.serverError('Error interno del servidor', error.message);
  }
};
