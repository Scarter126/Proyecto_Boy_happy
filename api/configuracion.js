const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError, parseBody, getCorsHeaders } = requireLayer('responseHelper');
const TABLE_NAMES = require('../shared/table-names.cjs');
const TABLE_KEYS = require('../shared/table-keys.cjs');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONFIG_TABLE = TABLE_NAMES.CONFIGURACION_TABLE;
const USUARIOS_TABLE = TABLE_NAMES.USUARIOS_TABLE;
const ASISTENCIA_TABLE = TABLE_NAMES.ASISTENCIA_TABLE;
const RECURSOS_TABLE = TABLE_NAMES.RECURSOS_TABLE;
const PROFESOR_CURSO_TABLE = TABLE_NAMES.PROFESOR_CURSO_TABLE;
const APODERADO_ALUMNO_TABLE = TABLE_NAMES.APODERADO_ALUMNO_TABLE;

/**
 * CU-11: Configurar parámetros globales
 */

exports.metadata = {
  route: '/configuracion',
  methods: ['GET', 'PUT'],
  auth: true,
  roles: ['admin', 'profesor', 'fono', 'apoderado', 'alumno'], // Todos pueden leer configuración
  profile: 'medium',
  tables: [
    TABLE_KEYS.CONFIGURACION_TABLE,
    `${TABLE_KEYS.ASISTENCIA_TABLE}:read`,       // Para validación al eliminar curso
    `${TABLE_KEYS.RECURSOS_TABLE}:read`,         // Para validación al eliminar curso
    `${TABLE_KEYS.PROFESOR_CURSO_TABLE}:read`,   // Para validación al eliminar curso
    `${TABLE_KEYS.APODERADO_ALUMNO_TABLE}:read`  // Para validación al eliminar curso
  ],
  additionalPolicies: []
};

exports.handler = async (event) => {
  const corsHeaders = getCorsHeaders(event);

  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, queryStringParameters } = event;

    // GET: Obtener configuración
    if (httpMethod === 'GET') {
      if (queryStringParameters?.key) {
        const result = await docClient.send(new GetCommand({
          TableName: CONFIG_TABLE,
          Key: { id: queryStringParameters.key },
          ConsistentRead: true
        }));

        // <<< AQUI >>> Normalización de asignaturas
        if (queryStringParameters.key === 'asignaturas' && result.Item?.asignaturas) {
          const items = (result.Item.asignaturas || []).map(a => {
            const val = a.S || a;
            return { value: val, label: val.charAt(0).toUpperCase() + val.slice(1) };
          });
          result.Item.asignaturas = items;
        }

        console.log('DEBUG - DynamoDB GET result for key', queryStringParameters.key, ':', JSON.stringify(result.Item, null, 2));

        if (!result.Item) {
          if (queryStringParameters.key === 'informacion-general') {
            return success({
              id: 'informacion-general',
              nombre: 'Boy Happy',
              direccion: 'Los Jardines 727, Ñuñoa, Santiago',
              telefono: '+56 9 8668 1455',
              email: 'contacto@boyhappy.cl',
              anoEscolar: new Date().getFullYear()
            }, 200, corsHeaders);
          }
          return notFound(`Configuración con key '${queryStringParameters.key}' no encontrada`, corsHeaders);
        }

        return success(result.Item, 200, corsHeaders);
      }

      const result = await docClient.send(new ScanCommand({ TableName: CONFIG_TABLE }));
      return success({ parametros: result.Items, total: result.Items.length }, 200, corsHeaders);
    }

    // PUT: Actualizar configuración
    if (httpMethod === 'PUT') {
      const body = parseBody(event);

      if (!body) {
        return badRequest('Body inválido o vacío', null, corsHeaders);
      }

      // Si viene con array de parámetros (bulk update)
      if (body.parametros && Array.isArray(body.parametros)) {
        for (const param of body.parametros) {
          if (!param.id || param.valor === undefined) {
            return badRequest('Cada parámetro debe tener id y valor', null, corsHeaders);
          }

          await docClient.send(new PutCommand({
            TableName: CONFIG_TABLE,
            Item: {
              id: param.id,
              valor: param.valor,
              timestamp: new Date().toISOString()
            }
          }));
        }
        return success({ message: 'Parámetros actualizados correctamente' }, 200, corsHeaders);
      }

      // Si viene con key y action (add/remove de cursos o asignaturas)
      if (body.key && body.action) {
        const configResult = await docClient.send(new GetCommand({
          TableName: CONFIG_TABLE,
          Key: { id: body.key }
        }));

        let currentData = configResult.Item || { id: body.key };

        // ADD: Agregar curso o asignatura
        if (body.action === 'add') {
          if (body.key === 'cursos' && body.curso) {
            currentData.cursos = currentData.cursos || [];
            currentData.cursosNombres = currentData.cursosNombres || [];

            // Verificar que no exista
            const existsInCursos = currentData.cursos.includes(body.curso.codigo);
            const existsInCursosNombres = currentData.cursosNombres.some(c => c.codigo === body.curso.codigo);

            if (existsInCursos || existsInCursosNombres) {
              return badRequest(`El curso con código '${body.curso.codigo}' ya existe`, null, corsHeaders);
            }

            // Agregar al array de códigos
            currentData.cursos.push(body.curso.codigo);
            // Agregar al array de objetos {codigo, nombre}
            currentData.cursosNombres.push({ codigo: body.curso.codigo, nombre: body.curso.nombre });
          } else if (body.key === 'asignaturas' && body.asignatura) {
            currentData.asignaturas = currentData.asignaturas || [];

            // Verificar que no exista
            if (currentData.asignaturas.includes(body.asignatura)) {
              return badRequest(`La asignatura '${body.asignatura}' ya existe`, null, corsHeaders);
            }

            currentData.asignaturas.push(body.asignatura);
          }
          // ADD: Agregar item a configuraciones de lista genérica
          else if (body.item) {
            // Lista de claves que son configuraciones de listas (SIMPLIFICADO: 10 → 6)
            const LIST_CONFIGS = [
              'categorias-contenido',
              'tipos-archivo',
              'tipos-actividad',
              'niveles-dificultad',
              'estados-workflow',
              'evaluaciones'
            ];

            if (LIST_CONFIGS.includes(body.key)) {
              currentData.items = currentData.items || [];

              // Validar que el item tenga value y label
              if (!body.item.value || !body.item.label) {
                return badRequest('El item debe tener "value" y "label"', null, corsHeaders);
              }

              // Verificar que no exista
              if (currentData.items.some(item => item.value === body.item.value)) {
                return badRequest(`El item con value '${body.item.value}' ya existe`, null, corsHeaders);
              }

              currentData.items.push(body.item);
            } else {
              return badRequest('Datos inválidos para acción "add"', null, corsHeaders);
            }
          } else {
            return badRequest('Datos inválidos para acción "add"', null, corsHeaders);
          }
        }

        // UPDATE: Actualizar nombre de curso o asignatura
        else if (body.action === 'update') {
          if (body.key === 'cursos' && body.codigo && body.nuevoNombre) {
            currentData.cursos = currentData.cursos || [];
            currentData.cursosNombres = currentData.cursosNombres || [];

            // Buscar el curso en el array de objetos
            const cursoIndex = currentData.cursosNombres.findIndex(c => c.codigo === body.codigo);

            if (cursoIndex === -1) {
              return notFound(`Curso con código '${body.codigo}' no encontrado`, corsHeaders);
            }

            // Actualizar el nombre
            currentData.cursosNombres[cursoIndex].nombre = body.nuevoNombre;
          } else if (body.key === 'asignaturas' && body.asignatura && body.nuevoNombre) {
            currentData.asignaturas = currentData.asignaturas || [];

            const index = currentData.asignaturas.indexOf(body.asignatura);
            if (index === -1) {
              return notFound(`Asignatura '${body.asignatura}' no encontrada`, corsHeaders);
            }

            // Actualizar el nombre
            currentData.asignaturas[index] = body.nuevoNombre;
          }
          // UPDATE: Actualizar item en configuraciones de lista genérica
          else if (body.value && body.nuevoItem) {
            const LIST_CONFIGS = [
              'categorias-contenido',
              'tipos-archivo',
              'tipos-actividad',
              'niveles-dificultad',
              'estados-workflow',
              'evaluaciones'
            ];

            if (LIST_CONFIGS.includes(body.key)) {
              currentData.items = currentData.items || [];

              const itemIndex = currentData.items.findIndex(item => item.value === body.value);
              if (itemIndex === -1) {
                return notFound(`Item con value '${body.value}' no encontrado`, corsHeaders);
              }

              // Actualizar el item completo
              currentData.items[itemIndex] = {
                ...currentData.items[itemIndex],
                ...body.nuevoItem
              };
            } else {
              return badRequest('Datos inválidos para acción "update"', null, corsHeaders);
            }
          } else {
            return badRequest('Datos inválidos para acción "update"', null, corsHeaders);
          }
        }

        // REMOVE: Eliminar curso o asignatura
        else if (body.action === 'remove') {
          if (body.key === 'cursos' && body.codigo) {
            currentData.cursos = currentData.cursos || [];
            currentData.cursosNombres = currentData.cursosNombres || [];

            // Buscar en array de códigos
            const indexCursos = currentData.cursos.indexOf(body.codigo);
            // Buscar en array de objetos
            const indexCursosNombres = currentData.cursosNombres.findIndex(c => c.codigo === body.codigo);

            if (indexCursos === -1 && indexCursosNombres === -1) {
              return notFound(`Curso con código '${body.codigo}' no encontrado`, corsHeaders);
            }

            // VALIDACIÓN: Verificar si hay datos asociados al curso
            const datosAsociados = [];

            // 1. Verificar relaciones profesor-curso
            const profesorCursoResult = await docClient.send(new QueryCommand({
              TableName: PROFESOR_CURSO_TABLE,
              IndexName: 'CursoIndex',
              KeyConditionExpression: 'curso = :curso',
              ExpressionAttributeValues: { ':curso': body.codigo }
            }));
            if (profesorCursoResult.Items && profesorCursoResult.Items.length > 0) {
              datosAsociados.push({
                tipo: 'profesores asignados',
                cantidad: profesorCursoResult.Items.length,
                ejemplos: profesorCursoResult.Items.slice(0, 3).map(p => p.profesorRut)
              });
            }

            // 2. Verificar relaciones apoderado-alumno (alumnos en el curso)
            const apoderadoAlumnoResult = await docClient.send(new QueryCommand({
              TableName: APODERADO_ALUMNO_TABLE,
              IndexName: 'CursoIndex',
              KeyConditionExpression: 'curso = :curso',
              ExpressionAttributeValues: { ':curso': body.codigo }
            }));
            if (apoderadoAlumnoResult.Items && apoderadoAlumnoResult.Items.length > 0) {
              datosAsociados.push({
                tipo: 'alumnos matriculados',
                cantidad: apoderadoAlumnoResult.Items.length,
                ejemplos: apoderadoAlumnoResult.Items.slice(0, 3).map(a => a.alumnoRut)
              });
            }

            // 3. Verificar asistencia
            const asistenciaResult = await docClient.send(new ScanCommand({
              TableName: ASISTENCIA_TABLE,
              FilterExpression: 'curso = :curso',
              ExpressionAttributeValues: { ':curso': body.codigo }
            }));
            if (asistenciaResult.Items && asistenciaResult.Items.length > 0) {
              datosAsociados.push({
                tipo: 'registros de asistencia',
                cantidad: asistenciaResult.Items.length
              });
            }

            // 4. Verificar notas (en RECURSOS_TABLE con tipo='nota')
            const notasResult = await docClient.send(new ScanCommand({
              TableName: RECURSOS_TABLE,
              FilterExpression: '#tipo = :tipo AND curso = :curso',
              ExpressionAttributeNames: { '#tipo': 'tipo' },
              ExpressionAttributeValues: { ':tipo': 'nota', ':curso': body.codigo }
            }));
            if (notasResult.Items && notasResult.Items.length > 0) {
              datosAsociados.push({
                tipo: 'notas',
                cantidad: notasResult.Items.length
              });
            }

            // 5. Verificar materiales
            const materialesResult = await docClient.send(new ScanCommand({
              TableName: RECURSOS_TABLE,
              FilterExpression: '#tipo = :tipo AND curso = :curso',
              ExpressionAttributeNames: { '#tipo': 'tipo' },
              ExpressionAttributeValues: { ':tipo': 'material', ':curso': body.codigo }
            }));
            if (materialesResult.Items && materialesResult.Items.length > 0) {
              datosAsociados.push({
                tipo: 'materiales',
                cantidad: materialesResult.Items.length
              });
            }

            // 6. Verificar bitácoras
            const bitacorasResult = await docClient.send(new ScanCommand({
              TableName: RECURSOS_TABLE,
              FilterExpression: '#tipo = :tipo AND curso = :curso',
              ExpressionAttributeNames: { '#tipo': 'tipo' },
              ExpressionAttributeValues: { ':tipo': 'bitacora', ':curso': body.codigo }
            }));
            if (bitacorasResult.Items && bitacorasResult.Items.length > 0) {
              datosAsociados.push({
                tipo: 'bitácoras',
                cantidad: bitacorasResult.Items.length
              });
            }

            // Si hay datos asociados, bloquear la eliminación
            if (datosAsociados.length > 0) {
              const cursoNombre = currentData.cursosNombres.find(c => c.codigo === body.codigo)?.nombre || body.codigo;
              const detalles = datosAsociados.map(d => `${d.cantidad} ${d.tipo}`).join(', ');

              return badRequest(
                `No se puede eliminar el curso "${cursoNombre}" porque tiene datos asociados: ${detalles}. Debes reasignar o eliminar estos datos primero.`,
                { datosAsociados },
                corsHeaders
              );
            }

            // Si no hay datos asociados, proceder con la eliminación
            if (indexCursos !== -1) {
              currentData.cursos.splice(indexCursos, 1);
            }
            if (indexCursosNombres !== -1) {
              currentData.cursosNombres.splice(indexCursosNombres, 1);
            }
          } else if (body.key === 'asignaturas' && body.asignatura) {
            currentData.asignaturas = currentData.asignaturas || [];

            const index = currentData.asignaturas.indexOf(body.asignatura);
            if (index === -1) {
              return notFound(`Asignatura '${body.asignatura}' no encontrada`, corsHeaders);
            }

            currentData.asignaturas.splice(index, 1);
          }
          // REMOVE: Eliminar item de configuraciones de lista genérica
          else if (body.value) {
            const LIST_CONFIGS = [
              'categorias-contenido',
              'tipos-archivo',
              'tipos-actividad',
              'niveles-dificultad',
              'estados-workflow',
              'evaluaciones'
            ];

            if (LIST_CONFIGS.includes(body.key)) {
              currentData.items = currentData.items || [];

              const itemIndex = currentData.items.findIndex(item => item.value === body.value);
              if (itemIndex === -1) {
                return notFound(`Item con value '${body.value}' no encontrado`, corsHeaders);
              }

              // Eliminar el item
              currentData.items.splice(itemIndex, 1);
            } else {
              return badRequest('Datos inválidos para acción "remove"', null, corsHeaders);
            }
          } else {
            return badRequest('Datos inválidos para acción "remove"', null, corsHeaders);
          }
        } else {
          return badRequest(`Acción '${body.action}' no soportada`, null, corsHeaders);
        }

        // Guardar cambios
        currentData.timestamp = new Date().toISOString();
        await docClient.send(new PutCommand({
          TableName: CONFIG_TABLE,
          Item: currentData
        }));

        return success({ message: `Configuración '${body.key}' actualizada correctamente`, data: currentData }, 200, corsHeaders);
      }

      // Si viene con key específica (single update)
      if (body.key) {
        await docClient.send(new PutCommand({
          TableName: CONFIG_TABLE,
          Item: {
            id: body.key,
            ...body,
            timestamp: new Date().toISOString()
          }
        }));
        return success({ message: `Configuración '${body.key}' actualizada correctamente` }, 200, corsHeaders);
      }

      return badRequest('Debe proporcionar "parametros" (array), o "key" con/sin "action"', null, corsHeaders);
    }

    return badRequest(`Método ${httpMethod} no soportado`, null, corsHeaders);

  } catch (error) {
    console.error('Error en configuracion.js:', error);
    return serverError(error.message, null, corsHeaders);
  }
};
