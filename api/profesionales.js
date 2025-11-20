/**
 * Lambda Metadata para Auto-discovery
 */
exports.metadata = {
  route: '/profesionales',               // Ruta HTTP
  methods: ['GET'],                      // Solo lectura (endpoint público)
  auth: false,                           // NO requiere autenticación (público)
  roles: ['*'],                          // Acceso público
  profile: 'light',                      // Lambda light (poca memoria/tiempo)
  tables: ['Usuarios:read']              // Solo lectura en Usuarios table
};

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.USUARIOS_TABLE;

/**
 * Endpoint PÚBLICO para listar profesionales (admin, profesor, fono)
 * con información reducida para mostrar en el home.
 *
 * No requiere autenticación.
 * Retorna solo: nombre, rol, especialidad (si existe)
 */
exports.handler = async (event) => {
  try {
    const { httpMethod } = event;

    // Solo permitir GET
    if (httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
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
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400' // Cache 24 horas
      },
      body: JSON.stringify(profesionales)
    };

  } catch (error) {
    console.error('Error en profesionales.handler:', error);

    // Si la tabla no existe (desarrollo local), retornar array vacío
    if (error.name === 'ResourceNotFoundException' || error.message?.includes('Requested resource not found')) {
      console.warn('⚠️ Tabla de usuarios no existe - retornando array vacío para desarrollo');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify([])
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
