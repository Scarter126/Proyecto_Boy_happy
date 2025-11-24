/**
 * Lambda Metadata para Auto-discovery
 */
const TABLE_KEYS = require('../shared/table-keys.cjs');

exports.metadata = {
  route: '/profesionales',               // Ruta HTTP
  methods: ['GET'],                      // Solo lectura (endpoint público)
  auth: false,                           // NO requiere autenticación (público)
  roles: ['*'],                          // Acceso público
  profile: 'light',                      // Lambda light (poca memoria/tiempo)
  tables: [`${TABLE_KEYS.USUARIOS_TABLE}:read`]              // Solo lectura en Usuarios table
};

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const requireLayer = require('./requireLayer');
const { getCorsHeaders } = requireLayer('responseHelper');
const TABLE_NAMES = require('../shared/table-names.cjs');

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = TABLE_NAMES.USUARIOS_TABLE;

/**
 * Endpoint PÚBLICO para listar profesionales (admin, profesor, fono)
 * con información reducida para mostrar en el home.
 *
 * No requiere autenticación.
 * Retorna solo: nombre, rol, especialidad (si existe)
 */
exports.handler = async (event) => {
  // Obtener headers CORS dinámicos basados en el origen del request
  const corsHeaders = getCorsHeaders(event);

  try {
    const { httpMethod } = event;

    // Solo permitir GET
    if (httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Método no permitido' })
      };
    }

    // Obtener todos los usuarios
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME
    }));

    // Filtrar solo profesionales (admin, profesor, fono)
    // Si el campo activo no existe, se asume que el usuario está activo
    const profesionales = result.Items
      .filter(u =>
        u.activo &&
        ['admin', 'profesor', 'fono'].includes(u.rol)
      )
      .map(u => ({
        rut: u.rut,
        nombre: u.nombre,
        rol: u.rol,
        genero: u.genero || 'M',
        especialidad: u.especialidad || null,
        descripcion: u.descripcion || null,
        badges: u.badges || null
      }));

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=86400' // Cache 24 horas
      },
      body: JSON.stringify({ data: profesionales })
    };

  } catch (error) {
    console.error('Error en profesionales.handler:', error);

    // Si la tabla no existe (desarrollo local), retornar array vacío
    if (error.name === 'ResourceNotFoundException' || error.message?.includes('Requested resource not found')) {
      console.warn('⚠️ Tabla de usuarios no existe - retornando array vacío para desarrollo');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ data: [] })
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Error al cargar profesionales',
        message: error.message
      })
    };
  }
};
