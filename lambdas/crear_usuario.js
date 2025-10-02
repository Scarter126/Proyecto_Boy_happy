const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { rut, email, group } = body;

    if (!rut || !email || !group) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'RUT, email and group are required.' }),
      };
    }

    // Crear usuario en Cognito
    const params = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: rut,
      TemporaryPassword: 'Temporal123!', // ✅ puedes cambiar la política
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
    };

    const response = await cognito.adminCreateUser(params).promise();

    // Asignar usuario al grupo
    await cognito.adminAddUserToGroup({
      UserPoolId: process.env.USER_POOL_ID,
      Username: rut,
      GroupName: group,
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'User created and added to group successfully',
        user: response.User,
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating user',
        error: error.message,
      }),
    };
  }
};
