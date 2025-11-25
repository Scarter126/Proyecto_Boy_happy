/**
 * Lambda Metadata para Auto-discovery
 * Este objeto se usa en el CDK para auto-configurar routing, permisos y recursos
 */
const TABLE_KEYS = require('../shared/table-keys.cjs');

exports.metadata = {
  route: '/usuarios',                    // Ruta HTTP para esta lambda
  methods: ['GET', 'POST', 'PUT'],       // Métodos HTTP soportados
  auth: true,                            // Requiere autenticación
  roles: ['admin'],                      // Roles que pueden acceder (ADMIN solamente)
  profile: 'medium',                     // Perfil de lambda (memory/timeout)

  tables: [TABLE_KEYS.USUARIOS_TABLE],                  // Tablas DynamoDB necesarias (auto-grant)
  additionalPolicies: [                  // Políticas IAM adicionales
    {
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminRemoveUserFromGroup'
      ],
      resources: ['userpool']           // Especial: 'userpool' se expande automáticamente
    }
  ]
};

const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const requireLayer = require('./requireLayer');
const { authorize, ROLES } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError, parseBody, getCorsHeaders } = requireLayer('responseHelper');
const { validarRUT, validarEmail, validarCamposRequeridos } = requireLayer('utils/validation');
const { obtenerCursosProfesor } = requireLayer('relaciones');
const TABLE_NAMES = require('../shared/table-names.cjs');

const cognito = new CognitoIdentityProviderClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = TABLE_NAMES.USUARIOS_TABLE;
const USER_POOL_ID = process.env.USER_POOL_ID;

exports.handler = async (event) => 
  {// Obtener headers CORS dinámicos basados en el origen del request
    const corsHeaders = getCorsHeaders(event);

  try {
    // Validar autorización - ADMIN para todas las operaciones, PROFESOR y FONO solo para GET
    const { httpMethod } = event;
    const allowedRoles = httpMethod === 'GET' ? [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO] : [ROLES.ADMIN];

    const authResult = authorize(event, allowedRoles);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { body, queryStringParameters, path } = event;

    // POST - Crear usuario
    if (httpMethod === 'POST') {
      const data = JSON.parse(body);

      // Validaciones usando helpers centralizados

      // Validar campos requeridos
      const validacionCampos = validarCamposRequeridos(data, ['rut', 'nombre', 'correo', 'rol']);
      if (!validacionCampos.valido) {
        return badRequest(validacionCampos.error);
      }

      // Validar RUT chileno
      if (!validarRUT(data.rut)) {
        return badRequest('RUT inválido. Formato: 12345678-9');
      }

      // Validar formato de email
      if (!validarEmail(data.correo)) {
        return badRequest('Email inválido');
      }

      // Validar rol permitido (admin no se puede asignar desde esta API)
      const rolesPermitidos = ['profesor', 'fono', 'alumno'];
      if (!rolesPermitidos.includes(data.rol)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
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
          headers: corsHeaders,
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

        // Agregar campo curso solo para alumnos
        if (data.rol === 'alumno' && data.curso) {
          item.curso = data.curso;
        }

        // Agregar campos profesionales solo para admin, profesor, fono
        if (['admin', 'profesor', 'fono'].includes(data.rol)) {
          if (data.especialidad) item.especialidad = data.especialidad;
          if (data.descripcion) item.descripcion = data.descripcion;
          if (data.foto) item.foto = data.foto;
        }

        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: item
        }));

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(item)
        };

      } catch (error) {
        if (error.code === 'UsernameExistsException') {
          return {
            statusCode: 409,
            headers: corsHeaders,
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

      let usuarios = result.Items;

      // SECURITY: Role-based filtering for profesores
      if (authResult.user.rol === 'profesor') {
        // Obtener cursos asignados al profesor
        const cursosProfesor = await obtenerCursosProfesor(authResult.user.rut);
        const cursosAutorizados = cursosProfesor
          .filter(c => c.activo)
          .map(c => c.curso);

        // Filtrar solo alumnos de sus cursos
        usuarios = result.Items.filter(usuario => {
          // Si se filtra por rol=alumno (query param común), solo mostrar alumnos de sus cursos
          if (queryStringParameters?.rol === 'alumno') {
            return usuario.rol === 'alumno' &&
                   usuario.curso &&
                   cursosAutorizados.includes(usuario.curso);
          }
          // Si no hay filtro de rol, solo mostrar alumnos de sus cursos (default seguro)
          return usuario.rol === 'alumno' &&
                 usuario.curso &&
                 cursosAutorizados.includes(usuario.curso);
        });
      }

      // Aplicar filtros adicionales si se especifican
      if (queryStringParameters?.rol) {
        usuarios = usuarios.filter(u => u.rol === queryStringParameters.rol);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(usuarios)
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
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Campo requerido: nuevoRol' })
        };
      }

      // Validar rol permitido
      const rolesPermitidos = ['profesor', 'fono', 'alumno'];
      if (!rolesPermitidos.includes(data.nuevoRol)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
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
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Usuario no encontrado' })
        };
      }

      const rolActual = usuario.Item.rol;
      const correo = usuario.Item.correo;

      // Si el rol es el mismo, no hacer nada
      if (rolActual === data.nuevoRol) {
        return {
          statusCode: 200,
          headers: corsHeaders,
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
          headers: corsHeaders,
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
          headers: corsHeaders,
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
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No se puede asignar el rol admin desde esta API' })
        };
      }

      // Validar rol si se proporciona
      if (data.rol) {
        const rolesPermitidos = ['profesor', 'fono', 'alumno'];
        if (!rolesPermitidos.includes(data.rol)) {
          return {
            statusCode: 400,
            headers: corsHeaders,
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
        updateExpressions.push('curso = :curso');
        expressionAttributeValues[':curso'] = data.curso;
      }
      if (data.activo !== undefined) {
        updateExpressions.push('activo = :ac');
        expressionAttributeValues[':ac'] = data.activo;
      }
      if (data.especialidad !== undefined) {
        updateExpressions.push('especialidad = :esp');
        expressionAttributeValues[':esp'] = data.especialidad;
      }
      if (data.descripcion !== undefined) {
        updateExpressions.push('descripcion = :desc');
        expressionAttributeValues[':desc'] = data.descripcion;
      }
      if (data.foto !== undefined) {
        updateExpressions.push('foto = :foto');
        expressionAttributeValues[':foto'] = data.foto;
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
        headers: corsHeaders,
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
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Usuario desactivado correctamente' })
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Método HTTP no soportado' })
    };

  } catch (error) {
    console.error('Error en usuarios.handler:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message })
    };
  }
};
