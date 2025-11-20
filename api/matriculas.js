/**
 * Lambda Metadata para Auto-discovery
 */
exports.metadata = {
  route: '/matriculas',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  auth: true,                           // Requiere autenticación para admin
  authExceptions: {                     // Excepciones: POST público para crear solicitud
    'POST': false                       // POST no requiere auth (formulario público)
  },
  roles: ['admin', 'profesor'],         // Solo admin y profesor pueden gestionar
  profile: 'medium',
  tables: [
    'Comunicaciones',                   // Tabla principal de matrículas
    'Usuarios',                         // Para crear usuarios
    'Apoderados',                       // Gestión de apoderados
    'ApoderadoAlumno'                   // Relación N:N
  ],
  additionalPolicies: [
    {
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*']
    },
    {
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup'
      ],
      resources: ['userpool']
    }
  ]
};

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { success, badRequest, notFound, serverError, parseBody } = requireLayer('responseHelper');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});
const cognito = new CognitoIdentityProviderClient({});

const COMUNICACIONES_TABLE = process.env.COMUNICACIONES_TABLE;
const USUARIOS_TABLE = process.env.USUARIOS_TABLE;
const APODERADOS_TABLE = process.env.APODERADOS_TABLE;
const APODERADO_ALUMNO_TABLE = process.env.APODERADO_ALUMNO_TABLE;
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
    if (httpMethod === 'POST' && path === '/api/matriculas') {
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
    // GET /matriculas - Listar SOLO solicitudes (NO matrículas activas)
    // ========================================
    if (httpMethod === 'GET' && path === '/api/matriculas') {
      // Obtener solicitudes de matrícula (pendientes/aprobadas/rechazadas)
      // NO incluir matrículas que ya fueron convertidas a usuarios
      const solicitudesResult = await docClient.send(new ScanCommand({
        TableName: COMUNICACIONES_TABLE,
        FilterExpression: '#tipo = :tipo',
        ExpressionAttributeNames: { '#tipo': 'tipo' },
        ExpressionAttributeValues: { ':tipo': 'matricula' }
      }));

      let items = solicitudesResult.Items || [];

      // Aplicar filtros si existen
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
    // PUT /matriculas?alumnoRut=xxx - Actualizar curso de alumno
    // ========================================
    if (httpMethod === 'PUT' && path === '/api/matriculas' && queryStringParameters?.alumnoRut) {
      console.log('🔥 PUT /matriculas?alumnoRut LLAMADO!', {
        alumnoRut: queryStringParameters.alumnoRut,
        body: event.body
      });

      const alumnoRut = queryStringParameters.alumnoRut;
      const data = JSON.parse(event.body);
      const nuevoCurso = data.curso || data.nuevoCurso; // Aceptar ambos nombres

      // Buscar la matrícula existente en ApoderadoAlumno
      const scanResult = await docClient.send(new ScanCommand({
        TableName: APODERADO_ALUMNO_TABLE,
        FilterExpression: 'alumnoRut = :alumnoRut',
        ExpressionAttributeValues: { ':alumnoRut': alumnoRut }
      }));

      // Si nuevoCurso está vacío, eliminar la matrícula
      if (!nuevoCurso) {
        if (scanResult.Items && scanResult.Items.length > 0) {
          const matricula = scanResult.Items[0];
          await docClient.send(new DeleteCommand({
            TableName: APODERADO_ALUMNO_TABLE,
            Key: {
              apoderadoRut: matricula.apoderadoRut,
              alumnoRut: matricula.alumnoRut
            }
          }));
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Curso eliminado correctamente' })
        };
      }

      // Si existe la matrícula, actualizar el curso
      if (scanResult.Items && scanResult.Items.length > 0) {
        const matricula = scanResult.Items[0];

        await docClient.send(new UpdateCommand({
          TableName: APODERADO_ALUMNO_TABLE,
          Key: {
            apoderadoRut: matricula.apoderadoRut,
            alumnoRut: matricula.alumnoRut
          },
          UpdateExpression: 'SET curso = :curso, fechaActualizacion = :fecha',
          ExpressionAttributeValues: {
            ':curso': nuevoCurso,
            ':fecha': new Date().toISOString()
          }
        }));

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Curso actualizado correctamente en matrícula' })
        };
      }

      // Si no existe la matrícula, retornar error
      // El campo curso ahora vive en la tabla Usuarios, no necesitamos crear matrícula
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No se encontró una relación apoderado-alumno para este alumno. El curso se maneja en la tabla Usuarios.' })
      };
    }

    // ========================================
    // PUT /matriculas?id=xxx - Actualizar estado + Email
    // ========================================
    if (httpMethod === 'PUT' && path === '/api/matriculas' && queryStringParameters?.id) {
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

      // Detectar tipo de actualización: estado (approve/reject) vs edición completa
      const isStatusChange = data.revisadoPor !== undefined;

      if (isStatusChange) {
        // Actualizar estado (approve/reject)
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
      } else {
        // Edición completa de matrícula
        const updateExpressions = [];
        const expressionAttributeValues = {};
        const expressionAttributeNames = {};

        // Campos editables
        if (data.nombreAlumno !== undefined) {
          updateExpressions.push('nombreAlumno = :nombreAlumno');
          expressionAttributeValues[':nombreAlumno'] = data.nombreAlumno;
        }
        if (data.rutAlumno !== undefined) {
          updateExpressions.push('rutAlumno = :rutAlumno');
          expressionAttributeValues[':rutAlumno'] = data.rutAlumno;
        }
        if (data.nombreApoderado !== undefined) {
          updateExpressions.push('nombreApoderado = :nombreApoderado');
          expressionAttributeValues[':nombreApoderado'] = data.nombreApoderado;
        }
        if (data.rutApoderado !== undefined) {
          updateExpressions.push('rutApoderado = :rutApoderado');
          expressionAttributeValues[':rutApoderado'] = data.rutApoderado;
        }
        if (data.correoApoderado !== undefined) {
          updateExpressions.push('correoApoderado = :correoApoderado');
          expressionAttributeValues[':correoApoderado'] = data.correoApoderado;
        }
        if (data.telefonoApoderado !== undefined) {
          updateExpressions.push('telefonoApoderado = :telefonoApoderado');
          expressionAttributeValues[':telefonoApoderado'] = data.telefonoApoderado;
        }
        if (data.curso !== undefined) {
          updateExpressions.push('curso = :curso');
          expressionAttributeValues[':curso'] = data.curso;
        }
        if (data.añoEscolar !== undefined) {
          updateExpressions.push('#anioEscolar = :anioEscolar');
          expressionAttributeNames['#anioEscolar'] = 'añoEscolar';
          expressionAttributeValues[':anioEscolar'] = data.añoEscolar;
        }
        if (data.estado !== undefined) {
          updateExpressions.push('estado = :estado');
          expressionAttributeValues[':estado'] = data.estado;
        }
        if (data.observaciones !== undefined) {
          updateExpressions.push('observaciones = :observaciones');
          expressionAttributeValues[':observaciones'] = data.observaciones;
        }

        if (updateExpressions.length === 0) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'No hay campos para actualizar' })
          };
        }

        const updateParams = {
          TableName: COMUNICACIONES_TABLE,
          Key: { id: matricula.id, timestamp: matricula.timestamp },
          UpdateExpression: 'SET ' + updateExpressions.join(', '),
          ExpressionAttributeValues: expressionAttributeValues
        };

        // Only add ExpressionAttributeNames if needed
        if (Object.keys(expressionAttributeNames).length > 0) {
          updateParams.ExpressionAttributeNames = expressionAttributeNames;
        }

        await docClient.send(new UpdateCommand(updateParams));

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Matrícula actualizada correctamente',
            id
          })
        };
      }
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
        // 1. Crear o actualizar apoderado en tabla Apoderados
        let apoderadoRut = matricula.rutApoderado;

        // Si no hay RUT de apoderado, generar uno ficticio basado en email
        if (!apoderadoRut) {
          const hash = Array.from(matricula.correoApoderado).reduce((s, c) => s + c.charCodeAt(0), 0);
          const numero = Math.abs(hash % 99999999);
          const calcDV = (n) => {
            let sum = 0, mul = 2;
            const str = n.toString();
            for (let i = str.length - 1; i >= 0; i--) {
              sum += parseInt(str[i]) * mul;
              mul = mul === 7 ? 2 : mul + 1;
            }
            const dv = 11 - (sum % 11);
            return dv === 11 ? '0' : dv === 10 ? 'K' : dv.toString();
          };
          apoderadoRut = `${numero}-${calcDV(numero)}`;
        }

        // Verificar si el apoderado ya existe
        const apoderadoExistente = await docClient.send(new GetCommand({
          TableName: APODERADOS_TABLE,
          Key: { rut: apoderadoRut }
        }));

        if (!apoderadoExistente.Item) {
          // Crear nuevo apoderado
          const nuevoApoderado = {
            rut: apoderadoRut,
            nombre: matricula.nombreApoderado || '',
            correo: matricula.correoApoderado,
            telefono: matricula.telefonoApoderado || '',
            activo: true,
            fechaCreacion: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString()
          };

          await docClient.send(new PutCommand({
            TableName: APODERADOS_TABLE,
            Item: nuevoApoderado
          }));
        }

        // 2. Crear usuario en Cognito
        await cognito.send(new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: matricula.correoApoderado,
          TemporaryPassword: passwordTemporal,
          UserAttributes: [
            { Name: 'email', Value: matricula.correoApoderado },
            { Name: 'email_verified', Value: 'true' }
          ]
        }));

        // 3. Asignar al grupo 'alumno'
        await cognito.send(new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: matricula.correoApoderado,
          GroupName: 'alumno'
        }));

        // 4. Crear registro de alumno en DynamoDB (SIN campo curso)
        const nuevoUsuario = {
          rut: matricula.rutAlumno,
          nombre: matricula.nombreAlumno,
          correo: matricula.correoApoderado,
          rol: 'alumno',
          telefono: matricula.telefonoApoderado || '',
          activo: true,
          fechaCreacion: new Date().toISOString(),
          creadoDesdeMatricula: id
        };

        await docClient.send(new PutCommand({
          TableName: USUARIOS_TABLE,
          Item: nuevoUsuario
        }));

        // 5. Crear relación apoderado-alumno
        await docClient.send(new PutCommand({
          TableName: APODERADO_ALUMNO_TABLE,
          Item: {
            apoderadoRut: apoderadoRut,
            alumnoRut: matricula.rutAlumno,
            relacionParentesco: 'apoderado', // Valor por defecto
            esTitular: true,
            curso: data.curso, // El curso se guarda en la relación, no en el usuario
            fechaCreacion: new Date().toISOString()
          }
        }));

        // 6. Actualizar matrícula para marcar que ya fue convertida
        await docClient.send(new UpdateCommand({
          TableName: COMUNICACIONES_TABLE,
          Key: { id: matricula.id, timestamp: matricula.timestamp },
          UpdateExpression: 'SET usuarioCreado = :t, fechaConversion = :f, apoderadoRut = :rut',
          ExpressionAttributeValues: {
            ':t': true,
            ':f': new Date().toISOString(),
            ':rut': apoderadoRut
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
    if (httpMethod === 'DELETE' && path === '/api/matriculas' && queryStringParameters?.id) {
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

      // Validar que la matrícula no haya sido convertida a usuario
      if (matricula.usuarioCreado === true) {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'No se puede eliminar esta matrícula porque ya fue convertida a usuario. El usuario y sus relaciones permanecerán activos.',
            usuarioCreado: true,
            fechaConversion: matricula.fechaConversion,
            apoderadoRut: matricula.apoderadoRut
          })
        };
      }

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
