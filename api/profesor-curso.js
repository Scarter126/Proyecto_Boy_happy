const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const requireLayer = require('./requireLayer');
const { authorize, ROLES } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = requireLayer('responseHelper');

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const PROFESOR_CURSO_TABLE = process.env.PROFESOR_CURSO_TABLE;
const USUARIOS_TABLE = process.env.USUARIOS_TABLE;

/**
 * Construye el Sort Key compuesto para profesor-curso
 * Formato: "1A#jefe" o "1A#asignatura#Matemáticas"
 */
function construirCursoTipo(curso, tipo, asignatura = null) {
  if (tipo === 'jefe') {
    return `${curso}#jefe`;
  } else if (tipo === 'asignatura' && asignatura) {
    return `${curso}#asignatura#${asignatura}`;
  }
  throw new Error('Tipo inválido o falta asignatura para tipo "asignatura"');
}

/**
 * Parsea el Sort Key compuesto
 * Retorna: { curso, tipo, asignatura }
 */
function parsearCursoTipo(cursoTipo) {
  const partes = cursoTipo.split('#');
  return {
    curso: partes[0],
    tipo: partes[1],
    asignatura: partes[2] || null
  };
}

exports.handler = async (event) => {
  try {
    const { httpMethod, body, queryStringParameters, pathParameters } = event;
    const path = event.path || '';

    // GET /profesor-curso/profesor/:rut - Listar cursos de un profesor
    // Los profesores pueden ver sus propios cursos, admin puede ver cualquiera
    if (httpMethod === 'GET' && path.match(/\/profesor-curso\/profesor/)) {
      const authResult = authorize(event, [ROLES.ADMIN, ROLES.PROFESOR]);
      if (!authResult.authorized) {
        return authResult.response;
      }

      console.log('[DEBUG] authResult.user:', JSON.stringify(authResult.user, null, 2));

      const profesorRut = pathParameters?.rut || queryStringParameters?.profesorRut;

      console.log('[DEBUG] profesorRut solicitado:', profesorRut);

      if (!profesorRut) {
        return badRequest('RUT del profesor es requerido');
      }

      // Si es profesor, solo puede ver sus propios cursos
      if (authResult.user.rol === 'profesor' && authResult.user.rut !== profesorRut) {
        console.warn(`[WARN] Profesor ${authResult.user.rut} intentó acceder a cursos de ${profesorRut}`);
        return {
          statusCode: 403,
          body: JSON.stringify({ message: 'No tienes permiso para ver cursos de otros profesores' })
        };
      }

      console.log('[DEBUG] Ejecutando DynamoDB Query:', {
        TableName: PROFESOR_CURSO_TABLE,
        profesorRut
      });

      const result = await docClient.send(new QueryCommand({
        TableName: PROFESOR_CURSO_TABLE,
        KeyConditionExpression: 'profesorRut = :rut',
        ExpressionAttributeValues: {
          ':rut': profesorRut
        }
      }));

      console.log('[DEBUG] DynamoDB result:', {
        ItemsCount: result.Items?.length || 0,
        Items: result.Items
      });

      // Parsear y formatear resultados
      const cursos = (result.Items || []).map(item => ({
        profesorRut: item.profesorRut,
        ...parsearCursoTipo(item.cursoTipo),
        fechaAsignacion: item.fechaAsignacion,
        activo: item.activo
      }));

      console.log('[DEBUG] Cursos formateados:', cursos);

      return success(cursos);
    }

    // GET /profesor-curso/curso/:id - Listar profesores de un curso
    // Admin, profesores y fonos pueden ver
    if (httpMethod === 'GET' && path.match(/\/profesor-curso\/curso/)) {
      const authResult = authorize(event, [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO]);
      if (!authResult.authorized) {
        return authResult.response;
      }

      const curso = pathParameters?.id || queryStringParameters?.curso;

      if (!curso) {
        return badRequest('ID del curso es requerido');
      }

      const result = await docClient.send(new QueryCommand({
        TableName: PROFESOR_CURSO_TABLE,
        IndexName: 'CursoIndex',
        KeyConditionExpression: 'curso = :curso',
        ExpressionAttributeValues: {
          ':curso': curso
        },
        FilterExpression: 'activo = :activo',
        ExpressionAttributeValues: {
          ':curso': curso,
          ':activo': true
        }
      }));

      // Agrupar por tipo
      const profesores = {
        jefe: null,
        asignaturas: []
      };

      for (const item of result.Items || []) {
        if (item.tipo === 'jefe') {
          profesores.jefe = {
            profesorRut: item.profesorRut,
            curso: item.curso,
            fechaAsignacion: item.fechaAsignacion
          };
        } else if (item.tipo === 'asignatura') {
          profesores.asignaturas.push({
            profesorRut: item.profesorRut,
            curso: item.curso,
            asignatura: item.asignatura,
            fechaAsignacion: item.fechaAsignacion
          });
        }
      }

      return success(profesores);
    }

    // POST /profesor-curso - Asignar profesor a curso (solo admin)
    if (httpMethod === 'POST') {
      const authResult = authorize(event, [ROLES.ADMIN]);
      if (!authResult.authorized) {
        return authResult.response;
      }

      const data = parseBody(body);

      // Validar campos requeridos
      if (!data.profesorRut || !data.curso || !data.tipo) {
        return badRequest('Faltan campos requeridos: profesorRut, curso, tipo');
      }

      // Validar tipo
      if (!['jefe', 'asignatura'].includes(data.tipo)) {
        return badRequest('Tipo debe ser "jefe" o "asignatura"');
      }

      // Si es asignatura, validar que se proporcione la asignatura
      if (data.tipo === 'asignatura' && !data.asignatura) {
        return badRequest('Campo "asignatura" es requerido para tipo "asignatura"');
      }

      // Verificar que el profesor existe
      const profesor = await docClient.send(new GetCommand({
        TableName: USUARIOS_TABLE,
        Key: { rut: data.profesorRut }
      }));

      if (!profesor.Item || profesor.Item.rol !== 'profesor') {
        return badRequest('El RUT proporcionado no corresponde a un profesor válido');
      }

      // Si es profesor jefe, verificar que el curso no tenga ya un jefe
      if (data.tipo === 'jefe') {
        const jefeActual = await docClient.send(new QueryCommand({
          TableName: PROFESOR_CURSO_TABLE,
          IndexName: 'CursoIndex',
          KeyConditionExpression: 'curso = :curso AND tipo = :tipo',
          ExpressionAttributeValues: {
            ':curso': data.curso,
            ':tipo': 'jefe'
          },
          FilterExpression: 'activo = :activo',
          ExpressionAttributeValues: {
            ':curso': data.curso,
            ':tipo': 'jefe',
            ':activo': true
          }
        }));

        if (jefeActual.Items && jefeActual.Items.length > 0) {
          return badRequest(`El curso ${data.curso} ya tiene un profesor jefe asignado`);
        }
      }

      // Construir el Sort Key
      const cursoTipo = construirCursoTipo(data.curso, data.tipo, data.asignatura);

      // Verificar que no exista ya esta asignación
      const existente = await docClient.send(new GetCommand({
        TableName: PROFESOR_CURSO_TABLE,
        Key: {
          profesorRut: data.profesorRut,
          cursoTipo
        }
      }));

      if (existente.Item && existente.Item.activo) {
        return badRequest('Esta asignación ya existe');
      }

      // Crear la asignación
      const asignacion = {
        profesorRut: data.profesorRut,
        cursoTipo,
        curso: data.curso,
        tipo: data.tipo,
        asignatura: data.asignatura || null,
        activo: true,
        fechaAsignacion: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: PROFESOR_CURSO_TABLE,
        Item: asignacion
      }));

      return success(
        { ...asignacion, cursoTipo: parsearCursoTipo(cursoTipo) },
        'Asignación creada exitosamente',
        201
      );
    }

    // DELETE /profesor-curso - Eliminar asignación
    if (httpMethod === 'DELETE') {
      const { profesorRut, curso, tipo, asignatura } = queryStringParameters || {};

      if (!profesorRut || !curso || !tipo) {
        return badRequest('Parámetros requeridos: profesorRut, curso, tipo');
      }

      const cursoTipo = construirCursoTipo(curso, tipo, asignatura);

      // Verificar que existe
      const existente = await docClient.send(new GetCommand({
        TableName: PROFESOR_CURSO_TABLE,
        Key: {
          profesorRut,
          cursoTipo
        }
      }));

      if (!existente.Item) {
        return notFound('Asignación no encontrada');
      }

      // Eliminar (hard delete, ya que es una tabla de relación)
      await docClient.send(new DeleteCommand({
        TableName: PROFESOR_CURSO_TABLE,
        Key: {
          profesorRut,
          cursoTipo
        }
      }));

      return success({ profesorRut, cursoTipo }, 'Asignación eliminada exitosamente');
    }

    return badRequest('Método no soportado');

  } catch (error) {
    console.error('Error en handler de profesor-curso:', error);
    return serverError('Error al procesar la solicitud de profesor-curso');
  }
};
