"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;

const handler = async (event) => {
  try {
    const { CLIENT_ID, COGNITO_DOMAIN, API_URL } = process.env;
    if (!CLIENT_ID || !COGNITO_DOMAIN || !API_URL) {
      console.error("Missing environment variables");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Missing environment variables" }),
      };
    }

    const redirectUri = `${API_URL}/callback`;

    const loginUrl = `https://${COGNITO_DOMAIN}/login?` +
      `response_type=code&` +
      `client_id=${encodeURIComponent(CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=openid+email+profile`;

    console.log("Redirecting to:", loginUrl);

    return {
      statusCode: 302,
      headers: {
        Location: loginUrl,
      },
    };
  } catch (error) {
    console.error("Error generating login URL:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};

exports.handler = handler;
