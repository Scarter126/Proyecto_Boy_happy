const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    const body = JSON.parse(event.body || '{}');
    const { rut, email, group, cursoId } = body;

    if (!rut || !email || !group) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'RUT, email y grupo son requeridos.' }),
      };
    }

    // Validar que alumnos tengan cursoId
    if (group.toLowerCase() === 'alumnos' && !cursoId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Alumnos deben tener cursoId.' }),
      };
    }

    switch (method) {
      case 'POST': // Crear usuario
        const userAttributes = [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ];
        if (cursoId) userAttributes.push({ Name: 'custom:cursoId', Value: cursoId });

        const createParams = {
          UserPoolId: process.env.USER_POOL_ID,
          Username: rut,
          TemporaryPassword: 'Temporal123!',
          UserAttributes: userAttributes,
        };

        const response = await cognito.adminCreateUser(createParams).promise();

        // Asignar usuario al grupo
        await cognito.adminAddUserToGroup({
          UserPoolId: process.env.USER_POOL_ID,
          Username: rut,
          GroupName: group,
        }).promise();

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Usuario creado y agregado al grupo correctamente',
            user: response.User,
          }),
        };

      case 'PUT': // Editar usuario
        const updateAttributes = [
          { Name: 'email', Value: email },
        ];
        if (cursoId) updateAttributes.push({ Name: 'custom:cursoId', Value: cursoId });

        await cognito.adminUpdateUserAttributes({
          UserPoolId: process.env.USER_POOL_ID,
          Username: rut,
          UserAttributes: updateAttributes,
        }).promise();

        // Cambiar grupo si viene diferente
        if (body.newGroup && body.newGroup !== group) {
          await cognito.adminRemoveUserFromGroup({ UserPoolId: process.env.USER_POOL_ID, Username: rut, GroupName: group }).promise();
          await cognito.adminAddUserToGroup({ UserPoolId: process.env.USER_POOL_ID, Username: rut, GroupName: body.newGroup }).promise();
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Usuario actualizado correctamente' }),
        };

      case 'DELETE': // Eliminar usuario
        await cognito.adminDeleteUser({
          UserPoolId: process.env.USER_POOL_ID,
          Username: rut,
        }).promise();

        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Usuario eliminado correctamente' }),
        };

      default:
        return { statusCode: 405, body: JSON.stringify({ message: 'Método no permitido' }) };
    }

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error en la operación', error: error.message }),
    };
  }
};
