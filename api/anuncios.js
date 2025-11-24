const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { getCorsHeaders, parseBody } = requireLayer('responseHelper');
const { authorize, ROLES } = requireLayer('authMiddleware');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.COMUNICACIONES_TABLE;

exports.handler = async (event) => {
  // Obtener headers CORS dinámicos basados en el origen del request
  const corsHeaders = getCorsHeaders(event);

  // Crear helpers de respuesta con CORS dinámico
  const success = (data, statusCode = 200) => ({
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data)
  });

  const badRequest = (message, details = null) => ({
    statusCode: 400,
    headers: corsHeaders,
    body: JSON.stringify({ error: message, ...(details && { details }) })
  });

  const serverError = (message, details = null) => ({
    statusCode: 500,
    headers: corsHeaders,
    body: JSON.stringify({ error: message, ...(details && { details }) })
  });

  const { httpMethod } = event;

  try {
    // POST - Crear anuncio (solo admin)
    if (httpMethod === 'POST') {
      const authResult = authorize(event, [ROLES.ADMIN]);
      if (!authResult.authorized) {
        return authResult.response;
      }

      const data = parseBody(event);

      if (!data.titulo || !data.contenido) {
        return badRequest('Campos requeridos: titulo, contenido');
      }

      const timestamp = new Date().toISOString();
      const item = {
        id: `anuncio-${uuidv4()}`,
        tipo: 'anuncio',
        timestamp: timestamp,
        titulo: data.titulo,
        contenido: data.contenido,
        fecha: timestamp.split('T')[0],
        autor: authResult.user.name || authResult.user.email, // Extraído del token
        prioridad: data.prioridad || 'media', // 'alta', 'media', 'baja'
        visibilidad: data.visibilidad || 'todos' // 'todos', 'admin', 'profesor', 'fono', 'apoderado'
      };

      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      return success(item);
    }

    // GET - Listar anuncios (todos pueden ver)
    if (httpMethod === 'GET') {
      const authResult = authorize(event, []); // Público, pero intentamos extraer user

      // Obtener todos los anuncios
      const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
      let anuncios = result.Items || [];

      // Filtrar por visibilidad según el rol del usuario
      if (authResult.authorized && authResult.user && authResult.user.rol) {
        const userRole = authResult.user.rol;

        // Si es admin, ve todos los anuncios
        if (userRole === ROLES.ADMIN) {
          return success(anuncios);
        }

        // Otros roles solo ven anuncios 'todos' o específicos para su rol
        anuncios = anuncios.filter(anuncio => {
          return anuncio.visibilidad === 'todos' || anuncio.visibilidad === userRole;
        });
      } else {
        // Usuario no autenticado: solo ve anuncios públicos
        anuncios = anuncios.filter(anuncio => anuncio.visibilidad === 'todos');
      }

      return success(anuncios);
    }

    // PUT - Editar anuncio (solo admin)
    if (httpMethod === 'PUT') {
      const authResult = authorize(event, [ROLES.ADMIN]);
      if (!authResult.authorized) {
        return authResult.response;
      }

      // Extraer ID del path: /anuncios/123 o del query param ?id=123
      const pathMatch = event.path?.match(/\/anuncios\/([^/]+)$/);
      const id = pathMatch ? pathMatch[1] : event.queryStringParameters?.id;

      if (!id) {
        return badRequest('Se requiere el parámetro id');
      }

      const data = parseBody(event);

      // Buscar el anuncio primero para obtener el timestamp
      const getResult = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        return badRequest('Anuncio no encontrado');
      }

      const anuncio = getResult.Items[0];

      // Construir UpdateExpression dinámicamente
      const updateParts = [];
      const expressionAttributeValues = {
        ':ts': new Date().toISOString()
      };

      if (data.titulo) {
        updateParts.push('titulo = :titulo');
        expressionAttributeValues[':titulo'] = data.titulo;
      }

      if (data.contenido) {
        updateParts.push('contenido = :contenido');
        expressionAttributeValues[':contenido'] = data.contenido;
      }

      if (data.prioridad) {
        updateParts.push('prioridad = :prioridad');
        expressionAttributeValues[':prioridad'] = data.prioridad;
      }

      if (data.visibilidad) {
        updateParts.push('visibilidad = :visibilidad');
        expressionAttributeValues[':visibilidad'] = data.visibilidad;
      }

      updateParts.push('ultimaModificacion = :ts');

      const updateExpression = 'SET ' + updateParts.join(', ');

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          id: anuncio.id,
          timestamp: anuncio.timestamp
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues
      }));

      return success({ message: 'Anuncio actualizado correctamente', id });
    }

    // DELETE - Eliminar anuncio (solo admin)
    if (httpMethod === 'DELETE') {
      const authResult = authorize(event, [ROLES.ADMIN]);
      if (!authResult.authorized) {
        return authResult.response;
      }

      // Extraer ID del path: /anuncios/123 o del query param ?id=123
      const pathMatch = event.path?.match(/\/anuncios\/([^/]+)$/);
      const id = pathMatch ? pathMatch[1] : event.queryStringParameters?.id;

      if (!id) {
        return badRequest('Se requiere el parámetro id');
      }

      console.log('🗑️ DELETE anuncio - ID recibido:', id);

      // Buscar el anuncio primero para obtener el timestamp (la tabla tiene composite key: id + timestamp)
      const getResult = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      }));

      if (!getResult.Items || getResult.Items.length === 0) {
        console.error('❌ Anuncio no encontrado:', id);
        return badRequest('Anuncio no encontrado');
      }

      const anuncio = getResult.Items[0];
      console.log('📦 Anuncio encontrado:', { id: anuncio.id, timestamp: anuncio.timestamp });

      // Eliminar usando composite key
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          id: anuncio.id,
          timestamp: anuncio.timestamp
        }
      }));

      console.log('✅ Anuncio eliminado exitosamente');
      return success({ message: 'Anuncio eliminado', id });
    }

    return badRequest('Método no soportado');

  } catch (err) {
    console.error('Error en anuncios:', err);

    // Si la tabla no existe (desarrollo local), retornar array vacío para GET
    if (httpMethod === 'GET' && (err.name === 'ResourceNotFoundException' || err.message?.includes('Requested resource not found'))) {
      console.warn('⚠️ Tabla de anuncios no existe - retornando array vacío para desarrollo');
      return success([]);
    }

    return serverError(err.message);
  }
};

// Metadata para auto-discovery de CDK
exports.metadata = {
  route: '/anuncios',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  auth: true,
  roles: ['admin', 'profesor', 'fono', 'apoderado'],
  profile: 'medium',
  tables: ['Comunicaciones:readwrite']
};
