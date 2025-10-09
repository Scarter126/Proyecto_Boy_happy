const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { authorize } = require('/opt/nodejs/authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = require('/opt/nodejs/responseHelper');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONFIG_TABLE = process.env.CONFIGURACION_TABLE;
const USUARIOS_TABLE = process.env.USUARIOS_TABLE;
const ASISTENCIA_TABLE = process.env.ASISTENCIA_TABLE;
const RECURSOS_TABLE = process.env.RECURSOS_TABLE;

/**
 * CU-11: Configurar parámetros globales
 */
exports.handler = async (event) => {
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
          Key: { id: queryStringParameters.key }
        }));

        if (!result.Item) {
          // Si es información general y no existe, retornar valores por defecto
          if (queryStringParameters.key === 'informacion-general') {
            return success({
              id: 'informacion-general',
              nombre: 'Boy Happy',
              direccion: 'Los Jardines 727, Ñuñoa, Santiago',
              telefono: '+56 9 8668 1455',
              email: 'contacto@boyhappy.cl',
              anoEscolar: new Date().getFullYear()
            });
          }
          return notFound(`Configuración con key '${queryStringParameters.key}' no encontrada`);
        }

        return success(result.Item);
      }

      const result = await docClient.send(new ScanCommand({ TableName: CONFIG_TABLE }));
      return success({ parametros: result.Items, total: result.Items.length });
    }

    // PUT: Actualizar configuración
    if (httpMethod === 'PUT') {
      const body = parseBody(event);

      if (!body) {
        return badRequest('Body inválido o vacío');
      }

      // Si viene con array de parámetros (bulk update)
      if (body.parametros && Array.isArray(body.parametros)) {
        for (const param of body.parametros) {
          if (!param.id || param.valor === undefined) {
            return badRequest('Cada parámetro debe tener id y valor');
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
        return success({ message: 'Parámetros actualizados correctamente' });
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
              return badRequest(`El curso con código '${body.curso.codigo}' ya existe`);
            }

            // Agregar al array de códigos
            currentData.cursos.push(body.curso.codigo);
            // Agregar al array de objetos {codigo, nombre}
            currentData.cursosNombres.push({ codigo: body.curso.codigo, nombre: body.curso.nombre });
          } else if (body.key === 'asignaturas' && body.asignatura) {
            currentData.asignaturas = currentData.asignaturas || [];

            // Verificar que no exista
            if (currentData.asignaturas.includes(body.asignatura)) {
              return badRequest(`La asignatura '${body.asignatura}' ya existe`);
            }

            currentData.asignaturas.push(body.asignatura);
          } else {
            return badRequest('Datos inválidos para acción "add"');
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
              return notFound(`Curso con código '${body.codigo}' no encontrado`);
            }

            // VALIDACIÓN: Verificar si hay datos asociados al curso
            const datosAsociados = [];

            // 1. Verificar usuarios (alumnos y profesores)
            const usuariosResult = await docClient.send(new ScanCommand({
              TableName: USUARIOS_TABLE,
              FilterExpression: 'curso = :curso OR contains(cursosAsignados, :curso)',
              ExpressionAttributeValues: { ':curso': body.codigo }
            }));
            if (usuariosResult.Items && usuariosResult.Items.length > 0) {
              datosAsociados.push({
                tipo: 'usuarios',
                cantidad: usuariosResult.Items.length,
                ejemplos: usuariosResult.Items.slice(0, 3).map(u => u.nombre)
              });
            }

            // 2. Verificar asistencia
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

            // 3. Verificar notas (en RECURSOS_TABLE con tipo='nota')
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

            // 4. Verificar materiales
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

            // 5. Verificar bitácoras
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
                { datosAsociados }
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
              return notFound(`Asignatura '${body.asignatura}' no encontrada`);
            }

            currentData.asignaturas.splice(index, 1);
          } else {
            return badRequest('Datos inválidos para acción "remove"');
          }
        } else {
          return badRequest(`Acción '${body.action}' no soportada`);
        }

        // Guardar cambios
        currentData.timestamp = new Date().toISOString();
        await docClient.send(new PutCommand({
          TableName: CONFIG_TABLE,
          Item: currentData
        }));

        return success({ message: `Configuración '${body.key}' actualizada correctamente`, data: currentData });
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
        return success({ message: `Configuración '${body.key}' actualizada correctamente` });
      }

      return badRequest('Debe proporcionar "parametros" (array), o "key" con/sin "action"');
    }

    return badRequest(`Método ${httpMethod} no soportado`);

  } catch (error) {
    console.error('Error en configuracion.js:', error);
    return serverError(error.message);
  }
};
