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

    const tokenUrl = `${domain}/oauth2/token`;
    const body = querystring.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      code
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
    const prefix = process.env.CALLBACK_PREFIX || '';
    let redirectTo = `${prefix}/`;

    if (groups.includes('admin')) redirectTo = `${prefix}/login/admin`;
    else if (groups.includes('fono')) redirectTo = `${prefix}/login/fono`;
    else if (groups.includes('profesor')) redirectTo = `${prefix}/login/profesores`;
    else redirectTo = `${prefix}/login/alumnos`;

    return {
      statusCode: 302,
      headers: { Location: redirectTo },
    };

  } catch (err) {
    console.error("Callback error:", err);
    return { statusCode: 500, body: 'Error procesando callback' };
  }
};
