const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { authorize, ROLES } = require('/opt/nodejs/authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = require('/opt/nodejs/responseHelper');

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

    const { httpMethod, body, queryStringParameters, path } = event;

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

      // Validar rol permitido (admin no se puede asignar desde esta API)
      const rolesPermitidos = ['profesor', 'fono', 'alumno'];
      if (!rolesPermitidos.includes(data.rol)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Rol inválido. Debe ser: profesor, fono o alumno' })
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

    // GET - Listar todos los usuarios (activos e inactivos)
    if (httpMethod === 'GET') {
      const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.Items)
      };
    }

    // PUT /usuarios/cambiar-rol - Cambiar rol de usuario (RF-SES-03)
    // IMPORTANTE: Esta validación debe ir ANTES del PUT genérico
    if (httpMethod === 'PUT' && path && path.includes('/cambiar-rol')) {
      const { rut } = queryStringParameters;
      const data = JSON.parse(body);

      console.log('🔍 DEBUG cambiar-rol:', { rut, body, data });

      if (!data.nuevoRol) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campo requerido: nuevoRol' })
        };
      }

      // Validar rol permitido
      const rolesPermitidos = ['profesor', 'fono', 'alumno'];
      if (!rolesPermitidos.includes(data.nuevoRol)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Rol inválido. Debe ser: profesor, fono o alumno' })
        };
      }

      // Obtener usuario actual de DynamoDB
      const usuario = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { rut }
      }));

      if (!usuario.Item) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Usuario no encontrado' })
        };
      }

      const rolActual = usuario.Item.rol;
      const correo = usuario.Item.correo;

      // Si el rol es el mismo, no hacer nada
      if (rolActual === data.nuevoRol) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'El usuario ya tiene ese rol' })
        };
      }

      try {
        // 1. Remover del grupo anterior en Cognito
        await cognito.send(new AdminRemoveUserFromGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: correo,
          GroupName: rolActual
        }));

        // 2. Agregar al nuevo grupo en Cognito
        await cognito.send(new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: correo,
          GroupName: data.nuevoRol
        }));

        // 3. Actualizar DynamoDB
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { rut },
          UpdateExpression: 'SET rol = :r, fechaActualizacion = :f',
          ExpressionAttributeValues: {
            ':r': data.nuevoRol,
            ':f': new Date().toISOString()
          }
        }));

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Rol actualizado correctamente',
            rolAnterior: rolActual,
            rolNuevo: data.nuevoRol
          })
        };

      } catch (error) {
        console.error('Error cambiando rol en Cognito:', error);

        // Rollback en DynamoDB si falla Cognito
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Error al cambiar rol en Cognito: ' + error.message })
        };
      }
    }

    // PUT - Actualizar usuario
    if (httpMethod === 'PUT') {
      const data = JSON.parse(body);
      const { rut } = queryStringParameters;

      // Validar que no se intente asignar rol admin
      if (data.rol && data.rol === 'admin') {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No se puede asignar el rol admin desde esta API' })
        };
      }

      // Validar rol si se proporciona
      if (data.rol) {
        const rolesPermitidos = ['profesor', 'fono', 'alumno'];
        if (!rolesPermitidos.includes(data.rol)) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Rol inválido. Debe ser: profesor, fono o alumno' })
          };
        }
      }

      // Construir UpdateExpression dinámicamente según campos presentes
      const updateExpressions = [];
      const expressionAttributeValues = {};

      if (data.nombre !== undefined) {
        updateExpressions.push('nombre = :n');
        expressionAttributeValues[':n'] = data.nombre;
      }
      if (data.apellido !== undefined) {
        updateExpressions.push('apellido = :a');
        expressionAttributeValues[':a'] = data.apellido;
      }
      if (data.telefono !== undefined) {
        updateExpressions.push('telefono = :t');
        expressionAttributeValues[':t'] = data.telefono;
      }
      if (data.rol !== undefined) {
        updateExpressions.push('rol = :r');
        expressionAttributeValues[':r'] = data.rol;
      }
      if (data.curso !== undefined) {
        updateExpressions.push('curso = :c');
        expressionAttributeValues[':c'] = data.curso;
      }
      if (data.activo !== undefined) {
        updateExpressions.push('activo = :ac');
        expressionAttributeValues[':ac'] = data.activo;
      }

      // Siempre actualizar fechaActualizacion
      updateExpressions.push('fechaActualizacion = :f');
      expressionAttributeValues[':f'] = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { rut },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues
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
