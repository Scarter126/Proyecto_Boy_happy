/**
 * API Development Server con Bun.serve()
 *
 * Features:
 * - Auto-discovery de lambdas en api/
 * - Hot reload automático con --hot flag + cache busting
 * - Simula API Gateway events
 * - Endpoints de desarrollo (/health, /dev/*)
 * - CORS habilitado para desarrollo
 * - Usa .env como única fuente de verdad
 */

import { readdirSync, readFileSync, watch } from 'fs';
import { join } from 'path';

const PORT = parseInt(process.env.PORT || '3000', 10);
const API_DIR = join(import.meta.dir, '../api');

/**
 * Load S3 bucket names from CDK outputs in development
 * Production lambdas get these injected automatically by CDK
 */
try {
  const outputsPath = join(import.meta.dir, '../infra/outputs.json');
  const outputsContent = readFileSync(outputsPath, 'utf-8');
  const outputs = JSON.parse(outputsContent);
  const stackOutputs = outputs.BoyHappyStack || {};

  // Validate that required bucket outputs exist
  const requiredBuckets = ['ImagesBucketName', 'MaterialesBucketName', 'BackupsBucketName'];
  const missingBuckets = requiredBuckets.filter(bucket => !stackOutputs[bucket]);

  if (missingBuckets.length > 0) {
    console.error('❌ Missing bucket outputs in outputs.json:', missingBuckets);
    console.error('   Run "bun run deploy" to generate all outputs first');
    throw new Error(`Missing bucket outputs: ${missingBuckets.join(', ')}`);
  }

  // Set bucket environment variables
  process.env.IMAGES_BUCKET = stackOutputs.ImagesBucketName;
  process.env.MATERIALES_BUCKET = stackOutputs.MaterialesBucketName;
  process.env.BACKUPS_BUCKET = stackOutputs.BackupsBucketName;

  console.log('✅ Buckets cargados desde outputs.json:');
  console.log('   IMAGES_BUCKET:', process.env.IMAGES_BUCKET);
  console.log('   MATERIALES_BUCKET:', process.env.MATERIALES_BUCKET);
  console.log('   BACKUPS_BUCKET:', process.env.BACKUPS_BUCKET);
} catch (error: any) {
  if (error.code === 'ENOENT') {
    console.error('❌ outputs.json no encontrado en', join(import.meta.dir, '../infra/outputs.json'));
    console.error('   Ejecuta "bun run deploy" para generar outputs.json primero');
  } else {
    console.error('❌ Error cargando buckets desde outputs.json:', error.message);
  }
  throw error;
}

/**
 * Descubre todas las lambdas API disponibles
 */
function discoverLambdas(): Record<string, string> {
  const lambdaRoutes: Record<string, string> = {};

  try {
    const files = readdirSync(API_DIR);

    files.forEach((file) => {
      if (!file.endsWith('.js')) return;
      if (file === 'index.js' || file === 'README.md' || file.startsWith('_')) return;

      const name = file.replace('.js', '');
      const route = `/api/${name}`;
      const lambdaPath = join(API_DIR, file);

      lambdaRoutes[route] = lambdaPath;
    });

    console.log(`🔌 Descubiertas ${Object.keys(lambdaRoutes).length} lambdas API:`,
      Object.keys(lambdaRoutes).sort()
    );
  } catch (error) {
    console.error('❌ Error descubriendo lambdas:', error);
  }

  return lambdaRoutes;
}

/**
 * Convierte Request de Bun a evento Lambda (API Gateway)
 */
async function requestToLambdaEvent(req: Request): Promise<any> {
  const url = new URL(req.url);

  // Parse body si existe
  let body: string | null = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.text();
    } catch (e) {
      body = null;
    }
  }

  // Construir evento Lambda similar a API Gateway
  // API Gateway elimina el prefijo /api/ del path antes de enviarlo a la lambda
  const lambdaPath = url.pathname.replace(/^\/api/, '');

  return {
    httpMethod: req.method,
    path: lambdaPath,
    rawPath: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(req.headers.entries()),
    body: body,
    isBase64Encoded: false,
    requestContext: {
      http: {
        method: req.method,
        path: lambdaPath,
      },
    },
  };
}

/**
 * Ejecuta una función Lambda
 */
async function executeLambda(lambdaPath: string, event: any): Promise<any> {
  try {
    // Importar lambda (invalidar cache con timestamp para hot reload)
    const lambda = await import(`${lambdaPath}?t=${Date.now()}`);

    if (!lambda.handler || typeof lambda.handler !== 'function') {
      throw new Error(`Lambda en ${lambdaPath} no tiene un handler válido`);
    }

    const result = await lambda.handler(event);
    return result;
  } catch (error: any) {
    console.error('❌ Error ejecutando Lambda:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
}

// Mock user para desarrollo (puede ser sobrescrito con /dev/set-user)
let mockUser: any = {
  userId: 'dev-admin',
  email: 'admin@boyhappy.cl',
  'cognito:groups': ['admin'],
  sub: 'dev-admin-sub',
  role: 'admin',
  groups: ['admin'],
};

/**
 * Servidor API
 */
const lambdaRoutes = discoverLambdas();

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // === CORS para desarrollo ===
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Preflight OPTIONS
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // === ENDPOINTS DE DESARROLLO ===

    // Health check
    if (pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          lambdas: Object.keys(lambdaRoutes).length,
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Set mock user
    if (pathname === '/dev/set-user' && req.method === 'POST') {
      try {
        const userData = await req.json();
        mockUser = userData;
        return new Response(
          JSON.stringify({ success: true, user: mockUser }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Get current mock user
    if (pathname === '/dev/current-user') {
      return new Response(
        JSON.stringify({ user: mockUser }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Mock data para /api/comparativo (desarrollo local sin DynamoDB)
    if (pathname === '/api/comparativo' && req.method === 'GET') {
      const params = Object.fromEntries(url.searchParams);
      const compareBy = params.compareBy || 'curso';
      const comparisonType = params.comparisonType || 'asistencia';
      const periodo = params.periodo || ''; // '1', '2', 'trimestre1', 'trimestre2', 'trimestre3', ''

      // Parsear cursos y asignaturas seleccionados
      const cursosSeleccionados = params.cursos ? params.cursos.split(',').filter(Boolean) : [];
      const asignaturasSeleccionadas = params.asignaturas ? params.asignaturas.split(',').filter(Boolean) : [];

      // Factor de ajuste según periodo (simula variación temporal en datos mock)
      let periodoFactor = 1.0;
      if (periodo === '1') periodoFactor = 0.95; // Primer semestre típicamente más bajo
      else if (periodo === '2') periodoFactor = 1.05; // Segundo semestre típicamente más alto
      else if (periodo === 'trimestre1') periodoFactor = 0.90;
      else if (periodo === 'trimestre2') periodoFactor = 0.98;
      else if (periodo === 'trimestre3') periodoFactor = 1.08;

      let mockComparisons: any[] = [];

      if (compareBy === 'curso' && comparisonType === 'asistencia') {
        // Datos base ajustados por periodo
        const baseData = [
          { label: 'medio-mayor', count: 120, porcentaje: 92.5 },
          { label: 'prekinder-a', count: 150, porcentaje: 88.7 },
          { label: 'kinder', count: 140, porcentaje: 95.0 }
        ];

        // Filtrar por cursos seleccionados (si se especificaron)
        const dataFiltrada = cursosSeleccionados.length > 0
          ? baseData.filter(c => cursosSeleccionados.includes(c.label))
          : baseData;

        mockComparisons = dataFiltrada.map(curso => {
          const porcentajeAjustado = Math.min(100, Math.max(0, curso.porcentaje * periodoFactor));
          const presente = Math.round((porcentajeAjustado / 100) * curso.count);
          const ausente = Math.round(((100 - porcentajeAjustado) / 100) * curso.count * 0.6);
          const atrasado = Math.round(((100 - porcentajeAjustado) / 100) * curso.count * 0.3);
          const justificado = curso.count - presente - ausente - atrasado;

          return {
            label: curso.label,
            count: curso.count,
            porcentajeAsistencia: parseFloat(porcentajeAjustado.toFixed(1)),
            distribucionAsistencia: { presente, ausente, atrasado, justificado },
            distribucionAsistenciaPorcentual: {
              presente: `${((presente / curso.count) * 100).toFixed(1)}%`,
              ausente: `${((ausente / curso.count) * 100).toFixed(1)}%`,
              atrasado: `${((atrasado / curso.count) * 100).toFixed(1)}%`,
              justificado: `${((justificado / curso.count) * 100).toFixed(1)}%`
            }
          };
        });
      } else if (compareBy === 'curso' && comparisonType === 'notas') {
        // Datos base ajustados por periodo
        const baseData = [
          { label: 'medio-mayor', count: 80, L: 50, OD: 20, NL: 8, NT: 2 },
          { label: 'prekinder-a', count: 95, L: 65, OD: 18, NL: 10, NT: 2 },
          { label: 'kinder', count: 100, L: 75, OD: 15, NL: 8, NT: 2 }
        ];

        // Filtrar por cursos seleccionados (si se especificaron)
        const dataFiltrada = cursosSeleccionados.length > 0
          ? baseData.filter(c => cursosSeleccionados.includes(c.label))
          : baseData;

        mockComparisons = dataFiltrada.map(curso => {
          // Ajustar distribución según periodo (más L en períodos avanzados)
          const LAjustado = Math.round(curso.L * periodoFactor);
          const NLAjustado = Math.max(1, Math.round(curso.NL * (2 - periodoFactor))); // Menos NL en períodos avanzados
          const ODAjustado = Math.round(curso.OD * (1.5 - periodoFactor * 0.5));
          const NTAjustado = Math.max(0, curso.count - LAjustado - NLAjustado - ODAjustado);

          return {
            label: curso.label,
            count: curso.count,
            distribucionLogro: { L: LAjustado, OD: ODAjustado, NL: NLAjustado, NT: NTAjustado },
            distribucionLogroPorcentual: {
              L: `${((LAjustado / curso.count) * 100).toFixed(1)}%`,
              OD: `${((ODAjustado / curso.count) * 100).toFixed(1)}%`,
              NL: `${((NLAjustado / curso.count) * 100).toFixed(1)}%`,
              NT: `${((NTAjustado / curso.count) * 100).toFixed(1)}%`
            }
          };
        });
      } else if (compareBy === 'asignatura' && comparisonType === 'notas') {
        // Datos base ajustados por periodo
        const baseData = [
          { label: 'Lenguaje y Comunicación', count: 120, L: 85, OD: 22, NL: 10, NT: 3 },
          { label: 'Matemáticas', count: 115, L: 70, OD: 28, NL: 14, NT: 3 },
          { label: 'Ciencias Naturales', count: 110, L: 75, OD: 25, NL: 8, NT: 2 }
        ];

        // Filtrar por asignaturas seleccionadas (si se especificaron)
        const dataFiltrada = asignaturasSeleccionadas.length > 0
          ? baseData.filter(a => asignaturasSeleccionadas.includes(a.label))
          : baseData;

        mockComparisons = dataFiltrada.map(asignatura => {
          // Ajustar distribución según periodo
          const LAjustado = Math.round(asignatura.L * periodoFactor);
          const NLAjustado = Math.max(1, Math.round(asignatura.NL * (2 - periodoFactor)));
          const ODAjustado = Math.round(asignatura.OD * (1.5 - periodoFactor * 0.5));
          const NTAjustado = Math.max(0, asignatura.count - LAjustado - NLAjustado - ODAjustado);

          return {
            label: asignatura.label,
            count: asignatura.count,
            distribucionLogro: { L: LAjustado, OD: ODAjustado, NL: NLAjustado, NT: NTAjustado },
            distribucionLogroPorcentual: {
              L: `${((LAjustado / asignatura.count) * 100).toFixed(1)}%`,
              OD: `${((ODAjustado / asignatura.count) * 100).toFixed(1)}%`,
              NL: `${((NLAjustado / asignatura.count) * 100).toFixed(1)}%`,
              NT: `${((NTAjustado / asignatura.count) * 100).toFixed(1)}%`
            }
          };
        });
      }

      const mockResponse = {
        comparisons: mockComparisons,
        metadata: {
          compareBy,
          comparisonType,
          cursos: params.cursos ? params.cursos.split(',') : [],
          asignaturas: params.asignaturas ? params.asignaturas.split(',') : [],
          dateRange: { startDate: params.startDate, endDate: params.endDate },
          periodo: params.periodo
        }
      };

      return new Response(
        JSON.stringify(mockResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // === EJECUTAR LAMBDAS ===

    // Buscar lambda que coincida con la ruta
    let lambdaPath: string | null = null;

    // Coincidencia exacta
    if (lambdaRoutes[pathname]) {
      lambdaPath = lambdaRoutes[pathname];
    }
    // Coincidencia por prefijo (para rutas con path params como /api/usuarios/123)
    else {
      for (const [route, path] of Object.entries(lambdaRoutes)) {
        if (pathname.startsWith(route)) {
          lambdaPath = path;
          break;
        }
      }
    }

    if (lambdaPath) {
      const event = await requestToLambdaEvent(req);

      // Detectar y parsear mock token del frontend
      const cookies = req.headers.get('cookie') || '';
      const authHeader = req.headers.get('authorization') || '';
      let currentMockUser = mockUser; // Fallback al mock user por defecto
      let token: string | null = null;

      console.log('[DEBUG] Cookies recibidas:', cookies ? 'SI' : 'NO', cookies.substring(0, 50));
      console.log('[DEBUG] Authorization header:', authHeader ? authHeader.substring(0, 30) : 'NO');

      // Buscar token en cookies
      if (cookies) {
        const cookieObj: Record<string, string> = {};
        cookies.split(';').forEach(cookie => {
          const [name, ...rest] = cookie.trim().split('=');
          cookieObj[name] = rest.join('=');
        });

        token = cookieObj.idToken || cookieObj.accessToken;
      }

      // Si no hay token en cookies, buscar en Authorization header
      if (!token && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remover "Bearer "
      }

      console.log('[DEBUG] Token encontrado:', token ? token.substring(0, 20) : 'NO');

      // Parsear el token si es mock
      if (token && token.startsWith('mock.')) {
        try {
          const payload = token.split('.')[1];
          currentMockUser = JSON.parse(Buffer.from(payload, 'base64').toString());
          console.log('🔧 [Dev] Mock user detectado del frontend:', currentMockUser.email || currentMockUser.name);
          console.log('🔍 [Dev] Mock user completo:', JSON.stringify(currentMockUser, null, 2));
        } catch (e) {
          console.warn('⚠️ [Dev] Error parseando mock token:', e);
        }
      }

      // Agregar mock user al evento SOLO si hay autenticación
      const hasCookie = cookies.includes('idToken') || cookies.includes('accessToken');
      const hasAuthHeader = req.headers.get('authorization')?.startsWith('Bearer ');

      if (hasCookie || hasAuthHeader) {
        event.requestContext.authorizer = { claims: currentMockUser };
      }

      const result = await executeLambda(lambdaPath, event);

      // Convertir respuesta Lambda a Response de Bun
      const responseHeaders = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(result.headers || {}),
      };

      const responseBody = typeof result.body === 'string'
        ? result.body
        : JSON.stringify(result.body);

      return new Response(responseBody, {
        status: result.statusCode || 200,
        headers: responseHeaders,
      });
    }

    // === 404 ===
    return new Response(
      JSON.stringify({ error: 'Not Found', path: pathname }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  },

  error(error) {
    console.error('❌ Server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  },
});

console.log(`
╔═══════════════════════════════════════════════════════╗
║  🔌 API Dev Server (Bun)                             ║
╠═══════════════════════════════════════════════════════╣
║  URL:      http://localhost:${PORT}                      ║
║  Lambdas:  ${Object.keys(lambdaRoutes).length.toString().padEnd(2)} rutas descubiertas                     ║
║  Hot:      ✅ Cache busting enabled                  ║
║  Mock User: ${mockUser.email.padEnd(30)}             ║
╠═══════════════════════════════════════════════════════╣
║  Dev Endpoints:                                      ║
║    GET  /health                                      ║
║    POST /dev/set-user                                ║
║    GET  /dev/current-user                            ║
╚═══════════════════════════════════════════════════════╝
`);

// File watcher para logs de cambios
watch(API_DIR, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.js')) {
    console.log(`🔄 Detectado cambio en: ${filename} (se recargará en próximo request)`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Cerrando servidor API...');
  server.stop();
  process.exit(0);
});
