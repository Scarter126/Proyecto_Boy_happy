const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, getCorsHeaders, notFound, serverError, parseBody } = requireLayer('responseHelper');
const TABLE_NAMES = require('../shared/table-names.cjs');
const TABLE_KEYS = require('../shared/table-keys.cjs');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AGENDA_TABLE = TABLE_NAMES.AGENDA_TABLE;

/**
 * CU-45: Documentación de Actividades por Sesión Terapéutica
 *
 * Esta bitácora es DIFERENTE a la de profesores (bitacora.js)
 * - Profesores: Conducta, Aprendizaje, Social (RecursosAcademicos)
 * - Fonoaudióloga: Sesiones terapéuticas, Objetivos, Actividades (AgendaFonoaudiologia)
 */
exports.metadata = {
  route: '/bitacora-fono',
  methods: ['GET', 'POST', 'DELETE'],
  auth: true,
  roles: ['fono', 'admin'],
  profile: 'medium',
  tables: [TABLE_KEYS.AGENDA_TABLE],
  additionalPolicies: []
};

exports.handler = async (event) => {

  try {
    const corsHeaders = getCorsHeaders(event);
    // Validar autorización - solo fonoaudiólogos y admin
    const authResult = authorize(event, ['fono', 'admin']);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, path, queryStringParameters } = event;

    // ========================================
    // POST /bitacora-fono - Registrar sesión terapéutica
    // ========================================
    if (httpMethod === 'POST' && (path === '/bitacora-fono' || path === '/bitacora-fono/')) {
      const data = JSON.parse(event.body);

      // Validaciones
      if (!data.rutAlumno || !data.fechaSesion || !data.objetivosTrabajados || !data.actividadesRealizadas || !data.resultados) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Campos requeridos: rutAlumno, fechaSesion, objetivosTrabajados, actividadesRealizadas, resultados'
          })
        };
      }

      const item = {
        fechaHora: `${data.fechaSesion}T00:00:00`, // PK - Formato compatible con agenda
        id: `bitacora-fono-${uuidv4()}`,
        tipo: 'bitacora-terapeutica', // Diferenciador
        rutAlumno: data.rutAlumno,
        nombreAlumno: data.nombreAlumno || '',
        fechaSesion: data.fechaSesion,
        duracion: data.duracion || 45,
        objetivosTrabajados: data.objetivosTrabajados,
        actividadesRealizadas: data.actividadesRealizadas,
        resultados: data.resultados,
        proximosPasos: data.proximosPasos || '',
        fonoaudiologo: authResult.userEmail || data.fonoaudiologo || 'Sistema',
        timestamp: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: AGENDA_TABLE,
        Item: item
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // GET /bitacora-fono - Consultar bitácora con filtros
    // ========================================
    if (httpMethod === 'GET' && (path === '/bitacora-fono' || path === '/bitacora-fono/')) {
      const result = await docClient.send(new ScanCommand({
        TableName: AGENDA_TABLE
      }));

      // Filtrar solo registros de bitácora terapéutica
      let items = result.Items.filter(item => item.tipo === 'bitacora-terapeutica');

      // Aplicar filtros opcionales
      if (queryStringParameters) {
        if (queryStringParameters.rutAlumno) {
          items = items.filter(i => i.rutAlumno === queryStringParameters.rutAlumno);
        }

        if (queryStringParameters.fonoaudiologo) {
          items = items.filter(i => i.fonoaudiologo === queryStringParameters.fonoaudiologo);
        }

        if (queryStringParameters.fechaInicio && queryStringParameters.fechaFin) {
          items = items.filter(i =>
            i.fechaSesion >= queryStringParameters.fechaInicio &&
            i.fechaSesion <= queryStringParameters.fechaFin
          );
        }
      }

      // Ordenar por fecha descendente
      items.sort((a, b) => new Date(b.fechaSesion) - new Date(a.fechaSesion));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(items)
      };
    }

    // ========================================
    // DELETE /bitacora-fono?id=xxx - Eliminar registro
    // ========================================
    if (httpMethod === 'DELETE' && (path === '/bitacora-fono' || path === '/bitacora-fono/')) {
      if (!queryStringParameters || !queryStringParameters.id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;

      // Buscar el registro
      const scanResult = await docClient.send(new ScanCommand({
        TableName: AGENDA_TABLE
      }));

      const registro = scanResult.Items.find(item => item.id === id && item.tipo === 'bitacora-terapeutica');

      if (!registro) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Registro de bitácora no encontrado' })
        };
      }

      // Eliminar usando la PK
      await docClient.send(new DeleteCommand({
        TableName: AGENDA_TABLE,
        Key: { fechaHora: registro.fechaHora }
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Registro de bitácora eliminado correctamente',
          id
        })
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Ruta o método no soportado' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Error interno del servidor',
        error: error.message
      })
    };
  }
};
