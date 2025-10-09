const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { v4: uuidv4 } = require('uuid');
const { success, badRequest, notFound, serverError, parseBody } = require('/opt/nodejs/responseHelper');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});
const cognito = new CognitoIdentityProviderClient({});

const COMUNICACIONES_TABLE = process.env.COMUNICACIONES_TABLE;
const USUARIOS_TABLE = process.env.USUARIOS_TABLE || 'Usuarios';
const USER_POOL_ID = process.env.USER_POOL_ID;
const SOURCE_EMAIL = process.env.SOURCE_EMAIL || 'noreply@boyhappy.cl';

/**
 * Sistema de matrículas (separado de eventos.js)
 */
exports.handler = async (event) => {

  try {
    const { httpMethod, path, queryStringParameters } = event;

    // ========================================
    // POST /matriculas - Crear solicitud
    // ========================================
    if (httpMethod === 'POST' && path === '/matriculas') {
      const data = JSON.parse(event.body);

      if (!data.nombreAlumno || !data.rutAlumno || !data.correoApoderado) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: nombreAlumno, rutAlumno, correoApoderado' })
        };
      }

      const item = {
        id: `matricula-${uuidv4()}`,
        tipo: 'matricula',
        timestamp: new Date().toISOString(),
        nombreAlumno: data.nombreAlumno,
        rutAlumno: data.rutAlumno,
        nombreApoderado: data.nombreApoderado,
        correoApoderado: data.correoApoderado,
        telefonoApoderado: data.telefonoApoderado,
        curso: data.curso,
        estado: 'pendiente',
        fecha: new Date().toISOString().split('T')[0]
      };

      await docClient.send(new PutCommand({
        TableName: COMUNICACIONES_TABLE,
        Item: item
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // GET /matriculas - Listar solicitudes
    // ========================================
    if (httpMethod === 'GET' && path === '/matriculas') {
      const result = await docClient.send(new ScanCommand({
        TableName: COMUNICACIONES_TABLE,
        FilterExpression: '#tipo = :tipo',
        ExpressionAttributeNames: { '#tipo': 'tipo' },
        ExpressionAttributeValues: { ':tipo': 'matricula' }
      }));

      let items = result.Items;

      if (queryStringParameters?.estado) {
        items = items.filter(i => i.estado === queryStringParameters.estado);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matriculas: items,
          total: items.length,
          pendientes: items.filter(i => i.estado === 'pendiente').length,
          aprobadas: items.filter(i => i.estado === 'aprobada').length,
          rechazadas: items.filter(i => i.estado === 'rechazada').length
        })
      };
    }

    // ========================================
    // PUT /matriculas?id=xxx - Actualizar estado + Email
    // ========================================
    if (httpMethod === 'PUT' && path === '/matriculas' && queryStringParameters?.id) {
      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      // Obtener matrícula
      const getResult = await docClient.send(new ScanCommand({
        TableName: COMUNICACIONES_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Matrícula no encontrada' })
        };
      }

      const matricula = getResult.Items[0];

      // Actualizar estado
      await docClient.send(new UpdateCommand({
        TableName: COMUNICACIONES_TABLE,
        Key: { id: matricula.id, timestamp: matricula.timestamp },
        UpdateExpression: 'SET estado = :estado, revisadoPor = :revisor, motivo = :motivo, fechaRevision = :fecha',
        ExpressionAttributeValues: {
          ':estado': data.estado,
          ':revisor': data.revisadoPor,
          ':motivo': data.motivo || '',
          ':fecha': new Date().toISOString()
        }
      }));

      // Enviar email
      let asunto, mensaje;
      if (data.estado === 'aprobada') {
        asunto = '¡Felicidades! Tu matrícula ha sido aprobada';
        mensaje = `Estimado/a ${matricula.nombreApoderado},\n\nNos complace informarte que la solicitud de matrícula de ${matricula.nombreAlumno} ha sido APROBADA.\n\n¡Bienvenido/a a Boy Happy!`;
      } else if (data.estado === 'rechazada') {
        asunto = 'Estado de tu solicitud de matrícula';
        mensaje = `Estimado/a ${matricula.nombreApoderado},\n\nLamentamos informarte que la solicitud de matrícula de ${matricula.nombreAlumno} no ha podido ser aprobada.\n\nMotivo: ${data.motivo}`;
      }

      if (mensaje) {
        try {
          await sesClient.send(new SendEmailCommand({
            Source: SOURCE_EMAIL,
            Destination: { ToAddresses: [matricula.correoApoderado] },
            Message: {
              Subject: { Data: asunto, Charset: 'UTF-8' },
              Body: { Text: { Data: mensaje, Charset: 'UTF-8' } }
            }
          }));
        } catch (emailError) {
          console.error('Error enviando email:', emailError);
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Matrícula ${data.estado}. Email enviado.`,
          id,
          emailEnviado: true
        })
      };
    }

    // ========================================
    // POST /matriculas/convertir-usuario?id=xxx
    // Convertir matrícula aprobada en usuario tipo alumno (RF-DIR-24 extendido)
    // ========================================
    if (httpMethod === 'POST' && path && path.includes('/convertir-usuario') && queryStringParameters?.id) {
      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      if (!data.curso) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campo requerido: curso' })
        };
      }

      // Obtener matrícula
      const getResult = await docClient.send(new ScanCommand({
        TableName: COMUNICACIONES_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Matrícula no encontrada' })
        };
      }

      const matricula = getResult.Items[0];

      // Validar que esté aprobada
      if (matricula.estado !== 'aprobada') {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Solo se pueden convertir matrículas aprobadas' })
        };
      }

      // Verificar que no exista ya el usuario
      const usuarioExistente = await docClient.send(new GetCommand({
        TableName: USUARIOS_TABLE,
        Key: { rut: matricula.rutAlumno }
      }));

      if (usuarioExistente.Item && usuarioExistente.Item.activo) {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Ya existe un usuario activo con este RUT' })
        };
      }

      // Generar contraseña temporal
      const passwordTemporal = `Boy${Math.floor(Math.random() * 10000)}!`;

      try {
        // 1. Crear usuario en Cognito
        await cognito.send(new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: matricula.correoApoderado,
          TemporaryPassword: passwordTemporal,
          UserAttributes: [
            { Name: 'email', Value: matricula.correoApoderado },
            { Name: 'email_verified', Value: 'true' }
          ]
        }));

        // 2. Asignar al grupo 'alumno'
        await cognito.send(new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: matricula.correoApoderado,
          GroupName: 'alumno'
        }));

        // 3. Crear registro en DynamoDB
        const nuevoUsuario = {
          rut: matricula.rutAlumno,
          nombre: matricula.nombreAlumno,
          correo: matricula.correoApoderado,
          rol: 'alumno',
          telefono: matricula.telefonoApoderado || '',
          curso: data.curso,
          activo: true,
          fechaCreacion: new Date().toISOString(),
          creadoDesdeMatricula: id
        };

        await docClient.send(new PutCommand({
          TableName: USUARIOS_TABLE,
          Item: nuevoUsuario
        }));

        // 4. Actualizar matrícula para marcar que ya fue convertida
        await docClient.send(new UpdateCommand({
          TableName: COMUNICACIONES_TABLE,
          Key: { id: matricula.id, timestamp: matricula.timestamp },
          UpdateExpression: 'SET usuarioCreado = :t, fechaConversion = :f',
          ExpressionAttributeValues: {
            ':t': true,
            ':f': new Date().toISOString()
          }
        }));

        // 5. Enviar email con credenciales
        try {
          await sesClient.send(new SendEmailCommand({
            Source: SOURCE_EMAIL,
            Destination: { ToAddresses: [matricula.correoApoderado] },
            Message: {
              Subject: { Data: 'Bienvenido a Boy Happy - Credenciales de acceso', Charset: 'UTF-8' },
              Body: {
                Text: {
                  Data: `Estimado/a ${matricula.nombreApoderado},

¡Bienvenido/a a Boy Happy!

La cuenta de ${matricula.nombreAlumno} ha sido creada exitosamente. A continuación, las credenciales de acceso:

Usuario: ${matricula.correoApoderado}
Contraseña temporal: ${passwordTemporal}
Curso asignado: ${data.curso}

Por favor, cambia la contraseña en el primer inicio de sesión.

Saludos,
Equipo Boy Happy`,
                  Charset: 'UTF-8'
                }
              }
            }
          }));
        } catch (emailError) {
          console.error('Error enviando email:', emailError);
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Usuario creado exitosamente',
            usuario: nuevoUsuario,
            passwordTemporal // Solo para admin, no mostrar al usuario final
          })
        };

      } catch (error) {
        console.error('Error creando usuario:', error);

        if (error.code === 'UsernameExistsException') {
          return {
            statusCode: 409,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'El correo ya está registrado en Cognito' })
          };
        }

        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Error al crear usuario: ' + error.message })
        };
      }
    }

    // ========================================
    // DELETE /matriculas?id=xxx - Eliminar
    // ========================================
    if (httpMethod === 'DELETE' && path === '/matriculas' && queryStringParameters?.id) {
      const id = queryStringParameters.id;

      const getResult = await docClient.send(new ScanCommand({
        TableName: COMUNICACIONES_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Matrícula no encontrada' })
        };
      }

      const matricula = getResult.Items[0];

      await docClient.send(new DeleteCommand({
        TableName: COMUNICACIONES_TABLE,
        Key: { id: matricula.id, timestamp: matricula.timestamp }
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Solicitud eliminada', id })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ruta no soportada' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
