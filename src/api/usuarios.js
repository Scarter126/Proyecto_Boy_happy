const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { authorize, ROLES } = require('/opt/nodejs/authMiddleware');

const cognito = new CognitoIdentityProviderClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.USUARIOS_TABLE;
const USER_POOL_ID = process.env.USER_POOL_ID;

exports.handler = async (event) => {
  try {
    // Validar autorización
    const authResult = authorize(event, [ROLES.ADMIN]);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, body, queryStringParameters } = event;

    // POST - Crear usuario
    if (httpMethod === 'POST') {
      const data = JSON.parse(body);

      // Validaciones (Commit 1.2.5)

      // Validar campos requeridos
      if (!data.rut || !data.nombre || !data.correo || !data.rol) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Faltan campos requeridos: rut, nombre, correo, rol' })
        };
      }

      // Validar RUT chileno
      if (!validarRUT(data.rut)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'RUT inválido. Formato: 12345678-9' })
        };
      }

      // Validar formato de email
      if (!data.correo.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Email inválido' })
        };
      }

      // Validar rol permitido
      const rolesPermitidos = ['admin', 'profesor', 'fono', 'alumno'];
      if (!rolesPermitidos.includes(data.rol)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Rol inválido. Debe ser: admin, profesor, fono o alumno' })
        };
      }

      // Validar que el RUT no exista ya en DynamoDB
      const existente = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { rut: data.rut }
      }));

      if (existente.Item && existente.Item.activo) {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Ya existe un usuario con este RUT' })
        };
      }

      try {
        // Crear usuario en Cognito
        await cognito.send(new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: data.correo,
          TemporaryPassword: data.passwordTemporal,
          UserAttributes: [
            { Name: 'email', Value: data.correo },
            { Name: 'email_verified', Value: 'true' }
          ]
        }));

        // Asignar grupo según rol
        await cognito.send(new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: data.correo,
          GroupName: data.rol
        }));

        // Guardar en DynamoDB
        const item = {
          rut: data.rut,
          nombre: data.nombre,
          correo: data.correo,
          rol: data.rol,
          telefono: data.telefono || '',
          activo: true,
          fechaCreacion: new Date().toISOString()
        };

        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: item
        }));

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        };

      } catch (error) {
        if (error.code === 'UsernameExistsException') {
          return {
            statusCode: 409,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Usuario ya existe en Cognito' })
          };
        }
        throw error;
      }
    }

    // GET - Listar usuarios activos
    if (httpMethod === 'GET') {
      const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME
      }));

      // Filtrar solo usuarios activos
      const usuariosActivos = result.Items.filter(u => u.activo);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usuariosActivos)
      };
    }

    // PUT - Actualizar usuario
    if (httpMethod === 'PUT') {
      const data = JSON.parse(body);
      const { rut } = queryStringParameters;

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { rut },
        UpdateExpression: 'SET nombre = :n, telefono = :t, rol = :r',
        ExpressionAttributeValues: {
          ':n': data.nombre,
          ':t': data.telefono,
          ':r': data.rol
        }
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Usuario actualizado correctamente' })
      };
    }

    // DELETE - Soft delete (marcar como inactivo)
    if (httpMethod === 'DELETE') {
      const { rut } = queryStringParameters;

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { rut },
        UpdateExpression: 'SET activo = :f',
        ExpressionAttributeValues: { ':f': false }
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Usuario desactivado correctamente' })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Método HTTP no soportado' })
    };

  } catch (error) {
    console.error('Error en usuarios.handler:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message })
    };
  }
};

// Función para validar RUT chileno
function validarRUT(rut) {
  if (!rut) return false;

  const rutLimpio = rut.replace(/[^0-9kK]/g, '');
  if (rutLimpio.length < 8) return false;

  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1).toUpperCase();

  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const dvCalculado = 11 - (suma % 11);
  const dvFinal = dvCalculado === 11 ? '0' : dvCalculado === 10 ? 'K' : dvCalculado.toString();

  return dv === dvFinal;
}
