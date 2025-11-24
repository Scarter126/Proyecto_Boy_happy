const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const requireLayer = require('./requireLayer');
const { authorize, ROLES } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = requireLayer('responseHelper');
const { validarRUT } = requireLayer('validation');
const TABLE_NAMES = require('../shared/table-names.cjs');
const TABLE_KEYS = require('../shared/table-keys.cjs');

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const APODERADOS_TABLE = TABLE_NAMES.APODERADOS_TABLE;
const APODERADO_ALUMNO_TABLE = TABLE_NAMES.APODERADO_ALUMNO_TABLE;
const USUARIOS_TABLE = TABLE_NAMES.USUARIOS_TABLE;

exports.metadata = {
  route: '/apoderados',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  auth: true,
  roles: ['admin', 'apoderado'],
  profile: 'medium',
  tables: [TABLE_KEYS.APODERADOS_TABLE, TABLE_KEYS.APODERADO_ALUMNO_TABLE, TABLE_KEYS.USUARIOS_TABLE],
  additionalPolicies: []
};

exports.handler = async (event) => {
  try {
    const { httpMethod, body, queryStringParameters, pathParameters } = event;
    const path = event.path || '';

    // GET /apoderados/:rut/alumnos - Listar alumnos de un apoderado
    // Permite acceso a ADMIN o al apoderado que consulta sus propios hijos
    if (httpMethod === 'GET' && path.includes('/alumnos')) {
      // Primero verificar autorización básica (cualquier usuario autenticado)
      const authResult = authorize(event, [ROLES.ADMIN, ROLES.APODERADO]);
      if (!authResult.authorized) {
        return authResult.response;
      }

      const rutApoderado = pathParameters?.rut || queryStringParameters?.rut;

      if (!rutApoderado) {
        return badRequest('RUT del apoderado es requerido');
      }

      // Si el usuario no es admin, solo puede ver sus propios hijos
      const { user } = authResult;
      if (user.role === ROLES.APODERADO && user.rut !== rutApoderado) {
        return { statusCode: 403, body: JSON.stringify({ error: 'No autorizado para ver hijos de otro apoderado' }) };
      }

      const result = await docClient.send(new QueryCommand({
        TableName: APODERADO_ALUMNO_TABLE,
        KeyConditionExpression: 'apoderadoRut = :rut',
        ExpressionAttributeValues: {
          ':rut': rutApoderado
        }
      }));

      // Enriquecer con datos de la tabla Usuarios
      const relaciones = result.Items || [];
      const alumnosEnriquecidos = await Promise.all(
        relaciones.map(async (relacion) => {
          try {
            const usuarioResult = await docClient.send(new GetCommand({
              TableName: USUARIOS_TABLE,
              Key: { rut: relacion.alumnoRut }
            }));

            if (usuarioResult.Item) {
              // Combinar datos de la relación con datos del usuario
              return {
                ...usuarioResult.Item,  // Datos completos del alumno (nombre, apellido, email, etc.)
                relacionParentesco: relacion.relacionParentesco,
                esTitular: relacion.esTitular,
                fechaRelacion: relacion.fechaCreacion
              };
            }

            // Si no se encuentra el usuario, retornar solo la relación
            return relacion;
          } catch (error) {
            console.error(`Error al obtener datos del alumno ${relacion.alumnoRut}:`, error);
            return relacion;
          }
        })
      );

      return success(alumnosEnriquecidos);
    }

    // Para todas las demás operaciones, solo admin puede acceder
    const authResult = authorize(event, [ROLES.ADMIN]);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // GET /apoderados/:rut - Obtener un apoderado
    if (httpMethod === 'GET' && pathParameters?.rut) {
      const result = await docClient.send(new GetCommand({
        TableName: APODERADOS_TABLE,
        Key: { rut: pathParameters.rut }
      }));

      if (!result.Item) {
        return notFound('Apoderado no encontrado');
      }

      return success(result.Item);
    }

    // GET /apoderados - Listar todos los apoderados
    if (httpMethod === 'GET') {
      const result = await docClient.send(new ScanCommand({
        TableName: APODERADOS_TABLE,
        FilterExpression: 'activo = :activo',
        ExpressionAttributeValues: {
          ':activo': true
        }
      }));

      return success(result.Items || []);
    }

    // POST /apoderados - Crear apoderado
    if (httpMethod === 'POST') {
      const data = parseBody(body);

      // Validar campos requeridos
      if (!data.rut || !data.nombre || !data.correo) {
        return badRequest('Faltan campos requeridos: rut, nombre, correo');
      }

      // Validar RUT chileno
      if (!validarRUT(data.rut)) {
        return badRequest('RUT inválido. Formato: 12345678-9');
      }

      // Validar formato de email
      if (!data.correo.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return badRequest('Email inválido');
      }

      // Validar que el RUT no exista
      const existente = await docClient.send(new GetCommand({
        TableName: APODERADOS_TABLE,
        Key: { rut: data.rut }
      }));

      if (existente.Item && existente.Item.activo) {
        return badRequest('Ya existe un apoderado con este RUT');
      }

      // Crear apoderado
      const apoderado = {
        rut: data.rut,
        nombre: data.nombre,
        apellido: data.apellido || '',
        correo: data.correo,
        telefono: data.telefono || '',
        direccion: data.direccion || '',
        comuna: data.comuna || '',
        region: data.region || '',
        activo: true,
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: APODERADOS_TABLE,
        Item: apoderado
      }));

      return success(apoderado, 'Apoderado creado exitosamente', 201);
    }

    // PUT /apoderados/:rut - Actualizar apoderado
    if (httpMethod === 'PUT' && pathParameters?.rut) {
      const data = parseBody(body);
      const rut = pathParameters.rut;

      // Verificar que existe
      const existente = await docClient.send(new GetCommand({
        TableName: APODERADOS_TABLE,
        Key: { rut }
      }));

      if (!existente.Item) {
        return notFound('Apoderado no encontrado');
      }

      // Construir expresión de actualización
      const updateExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      const camposActualizables = ['nombre', 'apellido', 'correo', 'telefono', 'direccion', 'comuna', 'region'];

      camposActualizables.forEach(campo => {
        if (data[campo] !== undefined) {
          updateExpressions.push(`#${campo} = :${campo}`);
          expressionAttributeNames[`#${campo}`] = campo;
          expressionAttributeValues[`:${campo}`] = data[campo];
        }
      });

      // Siempre actualizar fecha de modificación
      updateExpressions.push('#fechaActualizacion = :fechaActualizacion');
      expressionAttributeNames['#fechaActualizacion'] = 'fechaActualizacion';
      expressionAttributeValues[':fechaActualizacion'] = new Date().toISOString();

      if (updateExpressions.length === 1) { // Solo fechaActualizacion
        return badRequest('No se proporcionaron campos para actualizar');
      }

      await docClient.send(new UpdateCommand({
        TableName: APODERADOS_TABLE,
        Key: { rut },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      }));

      return success({ rut }, 'Apoderado actualizado exitosamente');
    }

    // DELETE /apoderados/:rut - Soft delete
    if (httpMethod === 'DELETE' && pathParameters?.rut) {
      const rut = pathParameters.rut;

      // Verificar que existe
      const existente = await docClient.send(new GetCommand({
        TableName: APODERADOS_TABLE,
        Key: { rut }
      }));

      if (!existente.Item) {
        return notFound('Apoderado no encontrado');
      }

      // Soft delete
      await docClient.send(new UpdateCommand({
        TableName: APODERADOS_TABLE,
        Key: { rut },
        UpdateExpression: 'SET activo = :activo, fechaActualizacion = :fecha',
        ExpressionAttributeValues: {
          ':activo': false,
          ':fecha': new Date().toISOString()
        }
      }));

      return success({ rut }, 'Apoderado eliminado exitosamente');
    }

    return badRequest('Método no soportado');

  } catch (error) {
    console.error('Error en handler de apoderados:', error);
    return serverError('Error al procesar la solicitud de apoderados');
  }
};
