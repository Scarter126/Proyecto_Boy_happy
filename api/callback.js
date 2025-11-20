// lambdas/callback.js
const querystring = require('querystring');

exports.handler = async (event) => {
  try {
    const code = event.queryStringParameters?.code;
    if (!code) {
      return { statusCode: 400, body: 'No se recibió el código de autorización' };
    }

    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const domain = process.env.COGNITO_DOMAIN;
    const apiUrl = process.env.API_URL || `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
    const redirectUri = `${apiUrl}/callback`;

    const tokenUrl = `https://${domain}/oauth2/token`;
    const body = querystring.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri
    });

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`,
      },
      body
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Token exchange error:", errorText);
      return { statusCode: 500, body: "Error al intercambiar el código por tokens" };
    }

    const tokens = await tokenRes.json();
    const idToken = tokens.id_token;

    if (!idToken) {
      return { statusCode: 401, body: 'No se pudo obtener ID token' };
    }

    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());

    const groups = payload['cognito:groups'] || [];
    let redirectPath = '/';

    if (groups.includes('admin')) redirectPath = '/admin';
    else if (groups.includes('fono')) redirectPath = '/fono';
    else if (groups.includes('profesor')) redirectPath = '/profesores';
    else redirectPath = '/alumnos';

    // Build full redirect URL with API base URL
    const redirectTo = `${apiUrl}${redirectPath}`;

    // Store tokens in cookies for the client to access
    const accessToken = tokens.access_token;
    const expiresIn = tokens.expires_in || 3600;

    return {
      statusCode: 302,
      headers: {
        Location: redirectTo,
      },
      multiValueHeaders: {
        'Set-Cookie': [
          `idToken=${idToken}; Path=/; Secure; SameSite=Lax; Max-Age=${expiresIn}`,
          `accessToken=${accessToken}; Path=/; Secure; SameSite=Lax; Max-Age=${expiresIn}`
        ]
      }
    };

  } catch (err) {
    console.error("Callback error:", err);
    return { statusCode: 500, body: 'Error procesando callback' };
  }
};
