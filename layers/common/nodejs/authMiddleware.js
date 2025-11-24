/**
 * Middleware de Autorización para Lambdas
 *
 * Valida que el usuario tenga el rol correcto para ejecutar la operación.
 * Extrae el rol del token JWT de Cognito y lo compara con los roles permitidos.
 *
 * Uso:
 * const { authorize, ROLES } = require('/opt/nodejs/authMiddleware');
 *
 * exports.handler = async (event) => {
 *   const authResult = authorize(event, [ROLES.ADMIN, ROLES.PROFESOR]);
 *   if (!authResult.authorized) {
 *     return authResult.response;
 *   }
 *   // Continuar con la lógica del handler...
 * }
 */

// Importar roles desde constantes compartidas (single source of truth)
const { ROLES } = require('./shared-constants');
const { getCorsHeaders } = require('./responseHelper');

// Matriz de permisos por recurso y método HTTP
const PERMISSIONS_MATRIX = {
  // Gestión de usuarios (solo admins para modificación, profesores y fonos pueden ver alumnos)
  '/usuarios': {
    'POST': [ROLES.ADMIN],
    'GET': [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO],
    'PUT': [ROLES.ADMIN],
    'DELETE': [ROLES.ADMIN]
  },

  // Categorías (solo admins)
  '/categorias': {
    'POST': [ROLES.ADMIN],
    'GET': [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO, ROLES.APODERADO],
    'PUT': [ROLES.ADMIN],
    'DELETE': [ROLES.ADMIN]
  },

  // Configuración del sistema (lectura amplia, modificación solo admins)
  '/configuracion': {
    'GET': [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO, ROLES.APODERADO],
    'PUT': [ROLES.ADMIN]
  },

  // Materiales pedagógicos
  '/materiales': {
    'POST': [ROLES.PROFESOR, ROLES.ADMIN],
    'GET': [ROLES.PROFESOR, ROLES.ADMIN, ROLES.FONO, ROLES.APODERADO],
    'PUT': [ROLES.PROFESOR, ROLES.ADMIN],
    'DELETE': [ROLES.PROFESOR, ROLES.ADMIN]
  },
  '/materiales/aprobar': {
    'PUT': [ROLES.ADMIN]
  },
  '/materiales/rechazar': {
    'PUT': [ROLES.ADMIN]
  },
  '/materiales/corregir': {
    'PUT': [ROLES.ADMIN]
  },

  // Notas académicas
  '/notas': {
    'POST': [ROLES.PROFESOR, ROLES.ADMIN],
    'GET': [ROLES.PROFESOR, ROLES.ADMIN, ROLES.FONO, ROLES.ALUMNO, ROLES.APODERADO],
    'PUT': [ROLES.PROFESOR, ROLES.ADMIN],
    'DELETE': [ROLES.PROFESOR, ROLES.ADMIN]
  },
  '/notas/promedios': {
    'GET': [ROLES.PROFESOR, ROLES.ADMIN, ROLES.ALUMNO, ROLES.APODERADO]
  },

  // Asistencia
  '/asistencia': {
    'POST': [ROLES.PROFESOR, ROLES.ADMIN],
    'GET': [ROLES.PROFESOR, ROLES.ADMIN, ROLES.FONO, ROLES.APODERADO],
    'PUT': [ROLES.PROFESOR, ROLES.ADMIN],
    'DELETE': [ROLES.PROFESOR, ROLES.ADMIN]
  },

  // Alumnos (incluye sub-rutas /alumnos/por-curso/:curso y /alumnos/:rut/curso)
  '/alumnos': {
    'GET': [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO]
  },

  // Apoderados - Relación con alumnos
  '/apoderados': {
    'GET': [ROLES.ADMIN, ROLES.APODERADO],
    'POST': [ROLES.ADMIN],
    'PUT': [ROLES.ADMIN],
    'DELETE': [ROLES.ADMIN]
  },

  // Bitácora de clases
  '/bitacora': {
    'POST': [ROLES.PROFESOR, ROLES.FONO, ROLES.ADMIN],
    'GET': [ROLES.PROFESOR, ROLES.FONO, ROLES.ADMIN],
    'PUT': [ROLES.PROFESOR, ROLES.FONO, ROLES.ADMIN],
    'DELETE': [ROLES.PROFESOR, ROLES.FONO, ROLES.ADMIN]
  },

  // Sesiones terapéuticas (fonoaudiología)
  '/sesiones': {
    'POST': [ROLES.FONO, ROLES.ADMIN],
    'GET': [ROLES.FONO, ROLES.ADMIN],
    'PUT': [ROLES.FONO, ROLES.ADMIN],
    'DELETE': [ROLES.FONO, ROLES.ADMIN]
  },
  '/sesiones/archivos': {
    'POST': [ROLES.FONO, ROLES.ADMIN],
    'DELETE': [ROLES.FONO, ROLES.ADMIN]
  },

  // Informes de evaluación
  '/informes': {
    'POST': [ROLES.FONO, ROLES.ADMIN],
    'GET': [ROLES.FONO, ROLES.ADMIN],
    'PUT': [ROLES.FONO, ROLES.ADMIN],
    'DELETE': [ROLES.FONO, ROLES.ADMIN]
  },

  // Reportes (acceso amplio con validación adicional)
  '/reportes': {
    'GET': [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO]
  },
  '/reportes/asistencia': {
    'GET': [ROLES.ADMIN, ROLES.PROFESOR]
  },
  '/reportes/cumplimiento': {
    'GET': [ROLES.ADMIN]
  },
  '/reportes/actividades': {
    'GET': [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO]
  },
  '/reportes/notas': {
    'GET': [ROLES.ADMIN, ROLES.PROFESOR]
  },
  '/reportes/consolidado': {
    'POST': [ROLES.ADMIN]
  },
  '/reportes/indicadores': {
    'GET': [ROLES.ADMIN]
  },

  // Retroalimentación
  '/retroalimentacion': {
    'POST': [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO],
    'GET': [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO, ROLES.ALUMNO],
    'PUT': [ROLES.ADMIN, ROLES.PROFESOR, ROLES.FONO]
  },

  // Eventos (acceso público para GET, restricción para modificación)
  '/eventos': {
    'POST': [ROLES.ADMIN],
    'GET': [], // Público
    'PUT': [ROLES.ADMIN],
    'DELETE': [ROLES.ADMIN]
  },

  // Anuncios (acceso público para GET)
  '/anuncios': {
    'POST': [ROLES.ADMIN],
    'GET': [], // Público
    'PUT': [ROLES.ADMIN],
    'DELETE': [ROLES.ADMIN]
  },

  // Matrículas
  '/matriculas': {
    'POST': [], // Público (formulario de solicitud)
    'GET': [ROLES.ADMIN],
    'PUT': [ROLES.ADMIN],
    'DELETE': [ROLES.ADMIN]
  },

  // Notificaciones
  '/notificaciones': {
    'POST': [ROLES.ADMIN]
  },

  // Reportes comparativos
  '/comparativo': {
    'GET': [ROLES.ADMIN]
  }
};

/**
 * Extrae el rol del usuario desde el token JWT de Cognito
 * @param {Object} event - Evento de API Gateway
 * @returns {Object} { rol: string, rut: string, email: string } o null si no se puede extraer
 */
function extractUserFromToken(event) {
  try {
    // Opción 1: Desde authorizer context (recomendado)
    if (event.requestContext?.authorizer?.claims) {
      const claims = event.requestContext.authorizer.claims;
      const groups = claims['cognito:groups'] || [];
      // groups puede ser un array o un string
      const roles = Array.isArray(groups)
        ? groups.map(g => g.trim())
        : groups.split(',').map(g => g.trim());

      const userObj = {
        rol: roles[0] || null, // Primer grupo como rol principal
        roles: roles, // Todos los roles
        email: claims.email,
        sub: claims.sub,
        rut: claims['custom:rut'] || claims.rut || null
      };

      console.log('🔍 [AuthMiddleware] Extrayendo user de authorizer.claims:', {
        hasClaims: !!claims,
        hasCustomRut: !!claims['custom:rut'],
        hasRut: !!claims.rut,
        extractedRut: userObj.rut,
        claimsKeys: Object.keys(claims)
      });

      return userObj;
    }

    // Opción 2: Desde cookies (para requests del navegador)
    const cookies = event.headers?.cookie || event.headers?.Cookie || '';
    if (cookies) {
      const cookieObj = {};
      cookies.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        cookieObj[name] = rest.join('=');
      });

      const token = cookieObj.idToken || cookieObj.accessToken;
      if (token) {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const groups = payload['cognito:groups'] || [];

        return {
          rol: groups[0] || null,
          roles: groups,
          email: payload.email,
          sub: payload.sub,
          rut: payload['custom:rut'] || null
        };
      }
    }

    // Opción 3: Desde header Authorization (para APIs)
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      const groups = payload['cognito:groups'] || [];

      return {
        rol: groups[0] || null,
        roles: groups,
        email: payload.email,
        sub: payload.sub,
        rut: payload['custom:rut'] || null
      };
    }

    return null;
  } catch (error) {
    console.error('Error extrayendo usuario del token:', error);
    return null;
  }
}

/**
 * Valida si el usuario tiene permisos para ejecutar la operación
 * @param {Object} event - Evento de API Gateway
 * @param {Array<string>} allowedRoles - Roles permitidos (opcional, usa matriz si no se especifica)
 * @returns {Object} { authorized: boolean, user: Object, response: Object }
 */
function authorize(event, allowedRoles = null) {
  const { httpMethod, resource, path } = event;

  // Obtener headers CORS dinámicos basados en el origen del request
  const corsHeaders = getCorsHeaders(event);

  // Usar path como resource si resource es /{proxy+}
  let effectiveResource = (resource === '/{proxy+}' || !resource) ? path : resource;

  // Remover prefijo /api/ para coincidir con la matriz de permisos
  if (effectiveResource.startsWith('/api/')) {
    effectiveResource = effectiveResource.substring(4); // Remove '/api'
  }

  // Extraer información del usuario
  const user = extractUserFromToken(event);

  // Debug logging
  console.log('Auth Debug:', {
    httpMethod,
    resource,
    path,
    effectiveResource,
    user: user ? { rol: user.rol, roles: user.roles, email: user.email, rut: user.rut } : null
  });

  // Si no se puede extraer el usuario, denegar acceso (excepto rutas públicas)
  if (!user || !user.rol) {
    // Verificar si es una ruta pública
    const permissions = PERMISSIONS_MATRIX[effectiveResource];
    if (permissions && permissions[httpMethod] && permissions[httpMethod].length === 0) {
      // Ruta pública, permitir acceso
      return {
        authorized: true,
        user: { rol: 'public', email: 'public' },
        response: null
      };
    }

    // Logging detallado para debugging (sin exponer datos sensibles)
    console.error('Auth failed - No user or role:', {
      hasUser: !!user,
      hasRol: user?.rol,
      hasCookieHeader: !!event.headers?.cookie || !!event.headers?.Cookie,
      hasAuthHeader: !!event.headers?.Authorization || !!event.headers?.authorization,
      hasAuthorizerClaims: !!event.requestContext?.authorizer?.claims,
      resource,
      effectiveResource,
      httpMethod,
      path
    });

    return {
      authorized: false,
      user: null,
      response: {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'No autenticado',
          message: 'Debe iniciar sesión para acceder a este recurso'
        })
      }
    };
  }

  // Determinar roles permitidos
  let rolesPermitidos = allowedRoles;

  // Si no se especificaron roles, usar la matriz de permisos
  if (!rolesPermitidos) {
    let permissions = PERMISSIONS_MATRIX[effectiveResource];

    // Si no se encuentra coincidencia exacta, buscar en rutas padre
    if (!permissions || !permissions[httpMethod]) {
      const pathParts = effectiveResource.split('/').filter(p => p);

      // Intentar con rutas padre progresivamente más cortas
      // Por ejemplo: /sesiones/123 -> /sesiones, /alumnos/por-curso/1A -> /alumnos/por-curso -> /alumnos
      for (let i = pathParts.length - 1; i > 0; i--) {
        const parentPath = '/' + pathParts.slice(0, i).join('/');
        if (PERMISSIONS_MATRIX[parentPath] && PERMISSIONS_MATRIX[parentPath][httpMethod]) {
          permissions = PERMISSIONS_MATRIX[parentPath];
          console.log(`Using parent path permissions: ${parentPath} for ${effectiveResource}`);
          break;
        }
      }
    }

    if (permissions && permissions[httpMethod]) {
      rolesPermitidos = permissions[httpMethod];
    } else {
      // Si no hay configuración específica, denegar por defecto
      console.warn(`No hay configuración de permisos para ${httpMethod} ${effectiveResource}`);
      return {
        authorized: false,
        user,
        response: {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          },
          body: JSON.stringify({
            error: 'Acceso denegado',
            message: 'No tiene permisos para acceder a este recurso'
          })
        }
      };
    }
  }

  // Si la ruta es pública (array vacío), permitir acceso
  if (rolesPermitidos.length === 0) {
    return {
      authorized: true,
      user,
      response: null
    };
  }

  // Verificar si el usuario tiene alguno de los roles permitidos
  const tienePermiso = user.roles.some(rol => rolesPermitidos.includes(rol));

  if (!tienePermiso) {
    console.warn(`Usuario ${user.email} con rol ${user.rol} intentó acceder a ${httpMethod} ${effectiveResource}`);
    return {
      authorized: false,
      user,
      response: {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Acceso denegado',
          message: `No tiene permisos para ejecutar esta operación. Roles requeridos: ${rolesPermitidos.join(', ')}`,
          userRole: user.rol
        })
      }
    };
  }

  // Usuario autorizado
  return {
    authorized: true,
    user,
    response: null
  };
}

/**
 * Verifica si el usuario puede acceder a recursos de otro usuario
 * @param {Object} user - Usuario autenticado
 * @param {string} targetRut - RUT del recurso que se intenta acceder
 * @returns {boolean} true si puede acceder
 */
function canAccessUserData(user, targetRut) {
  // Admins pueden acceder a todo
  if (user.roles.includes(ROLES.ADMIN)) {
    return true;
  }

  // Usuarios solo pueden acceder a sus propios datos
  return user.rut === targetRut;
}

/**
 * Middleware para validar propiedad de recursos
 * Útil para operaciones como GET /notas?rutAlumno=xxx
 */
function authorizeResourceAccess(event, resourceOwnerRut) {
  const corsHeaders = getCorsHeaders(event);
  const authResult = authorize(event);

  if (!authResult.authorized) {
    return authResult;
  }

  const { user } = authResult;

  // Verificar si puede acceder a los datos del recurso
  if (!canAccessUserData(user, resourceOwnerRut)) {
    return {
      authorized: false,
      user,
      response: {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Acceso denegado',
          message: 'No puede acceder a recursos de otros usuarios'
        })
      }
    };
  }

  return authResult;
}

module.exports = {
  authorize,
  authorizeResourceAccess,
  canAccessUserData,
  extractUserFromToken,
  ROLES,
  PERMISSIONS_MATRIX
}; 
