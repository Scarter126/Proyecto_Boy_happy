const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, notFound, serverError, parseBody } = requireLayer('responseHelper');
const { obtenerCursosProfesor } = requireLayer('relaciones');
const { getItemById } = requireLayer('sharedHelpers');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const RECURSOS_TABLE = process.env.RECURSOS_TABLE;

/**
 * Lambda handler para gestión de notas académicas
 * Sistema de evaluación CONCEPTUAL para educación parvularia (L, NL, OD, NT)
 *
 * L = Logrado
 * NL = No Logrado
 * OD = Objetivo en Desarrollo
 * NT = No Trabajado
 *
 * CU-28: Ingresar notas
 * CU-29: Modificar notas
 * CU-30: Eliminar notas
 */
exports.handler = async (event) => {

  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, path, queryStringParameters } = event;

    // ========================================
    // POST /notas - Crear nota
    // ========================================
    if (httpMethod === 'POST' && path === '/notas') {
      const data = JSON.parse(event.body);

      // Validaciones
      if (!data.rutAlumno || !data.curso || !data.asignatura || !data.nombreEvaluacion) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: rutAlumno, curso, asignatura, nombreEvaluacion' })
        };
      }

      // Validar evaluación conceptual (único sistema de evaluación para educación parvularia)
      const valoresValidos = ['L', 'NL', 'OD', 'NT'];
      if (!data.nivelLogro || !valoresValidos.includes(data.nivelLogro)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'El campo "nivelLogro" es requerido y debe ser uno de: L (Logrado), NL (No Logrado), OD (Objetivo en Desarrollo), NT (No Trabajado)'
          })
        };
      }

      const item = {
        id: `nota-${uuidv4()}`,
        tipo: 'nota',
        rutAlumno: data.rutAlumno,
        curso: data.curso,
        asignatura: data.asignatura,
        nombreEvaluacion: data.nombreEvaluacion,
        nivelLogro: data.nivelLogro,
        fecha: data.fecha || new Date().toISOString().split('T')[0],
        profesor: data.profesor,
        observaciones: data.observaciones || '',
        timestamp: new Date().toISOString(),
      };

      await docClient.send(new PutCommand({
        TableName: RECURSOS_TABLE,
        Item: item
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      };
    }

    // ========================================
    // GET /notas - Listar notas (con filtros)
    // ========================================
    if (httpMethod === 'GET' && path === '/notas') {
      // SECURITY: Role-based filtering for profesores
      let cursosAutorizados = null;
      if (authResult.user.rol === 'profesor') {
        const cursosProfesor = await obtenerCursosProfesor(authResult.user.rut);
        cursosAutorizados = cursosProfesor
          .filter(c => c.activo)
          .map(c => c.curso);

        // Si el profesor no tiene cursos asignados, retornar vacío
        if (cursosAutorizados.length === 0) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notas: [], total: 0 })
          };
        }

        // Si se especifica un curso en el filtro, validar autorización
        if (queryStringParameters?.curso && !cursosAutorizados.includes(queryStringParameters.curso)) {
          return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'No autorizado para acceder a notas de este curso' })
          };
        }
      }

      const params = {
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo',
        ExpressionAttributeNames: {
          '#tipo': 'tipo'
        },
        ExpressionAttributeValues: {
          ':tipo': 'nota'
        }
      };

      // Aplicar filtros opcionales
      if (queryStringParameters) {
        const filters = [];
        const attrNames = { '#tipo': 'tipo' };
        const attrValues = { ':tipo': 'nota' };

        if (queryStringParameters.rutAlumno) {
          filters.push('rutAlumno = :rutAlumno');
          attrValues[':rutAlumno'] = queryStringParameters.rutAlumno;
        }

        if (queryStringParameters.curso) {
          filters.push('curso = :curso');
          attrValues[':curso'] = queryStringParameters.curso;
        }

        if (queryStringParameters.asignatura) {
          filters.push('asignatura = :asignatura');
          attrValues[':asignatura'] = queryStringParameters.asignatura;
        }

        if (queryStringParameters.profesor) {
          filters.push('profesor = :profesor');
          attrValues[':profesor'] = queryStringParameters.profesor;
        }

        if (queryStringParameters.tipoEvaluacion) {
          filters.push('tipoEvaluacion = :tipoEvaluacion');
          attrValues[':tipoEvaluacion'] = queryStringParameters.tipoEvaluacion;
        }

        if (queryStringParameters.fechaInicio && queryStringParameters.fechaFin) {
          filters.push('fecha BETWEEN :fechaInicio AND :fechaFin');
          attrValues[':fechaInicio'] = queryStringParameters.fechaInicio;
          attrValues[':fechaFin'] = queryStringParameters.fechaFin;
        }

        if (filters.length > 0) {
          params.FilterExpression = `#tipo = :tipo AND ${filters.join(' AND ')}`;
          params.ExpressionAttributeValues = attrValues;
          params.ExpressionAttributeNames = attrNames;
        }
      }

      // SECURITY: Si es profesor y no se especificó curso, filtrar por cursos autorizados
      if (cursosAutorizados && !queryStringParameters?.curso) {
        const currentFilters = params.FilterExpression ? params.FilterExpression : '#tipo = :tipo';
        params.FilterExpression = `${currentFilters} AND curso IN (:curso1${cursosAutorizados.length > 1 ? ', ' + cursosAutorizados.slice(1).map((_, i) => `:curso${i + 2}`).join(', ') : ''})`;
        params.ExpressionAttributeValues = params.ExpressionAttributeValues || { ':tipo': 'nota' };
        cursosAutorizados.forEach((curso, index) => {
          params.ExpressionAttributeValues[`:curso${index + 1}`] = curso;
        });
        params.ExpressionAttributeNames = params.ExpressionAttributeNames || { '#tipo': 'tipo' };
      }

      const result = await docClient.send(new ScanCommand(params));

      // Post-filter results for professors (additional security layer)
      let filteredItems = result.Items;
      if (cursosAutorizados) {
        filteredItems = result.Items.filter(item => cursosAutorizados.includes(item.curso));
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notas: filteredItems,
          total: filteredItems.length
        })
      };
    }

    // ========================================
    // GET /notas/agrupadas - Notas agrupadas por asignatura (para vista de alumnos)
    // ========================================
    if (httpMethod === 'GET' && path === '/notas/agrupadas') {
      if (!queryStringParameters || !queryStringParameters.rutAlumno) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: rutAlumno' })
        };
      }

      const rutAlumno = queryStringParameters.rutAlumno;

      // Obtener todas las notas del alumno
      const params = {
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo AND rutAlumno = :rutAlumno',
        ExpressionAttributeNames: { '#tipo': 'tipo' },
        ExpressionAttributeValues: {
          ':tipo': 'nota',
          ':rutAlumno': rutAlumno
        }
      };

      const result = await docClient.send(new ScanCommand(params));

      // Agrupar por asignatura
      const asignaturas = {};

      result.Items.forEach(nota => {
        if (!asignaturas[nota.asignatura]) {
          asignaturas[nota.asignatura] = {
            asignatura: nota.asignatura,
            curso: nota.curso,
            evaluaciones: [],
            resumen: {
              cantidadEvaluaciones: 0,
              logrados: 0,
              enDesarrollo: 0,
              noLogrados: 0,
              noTrabajados: 0
            }
          };
        }

        asignaturas[nota.asignatura].evaluaciones.push({
          id: nota.id,
          nombreEvaluacion: nota.nombreEvaluacion,
          nivelLogro: nota.nivelLogro,
          fecha: nota.fecha,
          observaciones: nota.observaciones
        });
      });

      // Calcular resumen por asignatura
      Object.values(asignaturas).forEach(asig => {
        asig.resumen.cantidadEvaluaciones = asig.evaluaciones.length;
        asig.evaluaciones.forEach(e => {
          if (e.nivelLogro === 'L') asig.resumen.logrados++;
          else if (e.nivelLogro === 'OD') asig.resumen.enDesarrollo++;
          else if (e.nivelLogro === 'NL') asig.resumen.noLogrados++;
          else if (e.nivelLogro === 'NT') asig.resumen.noTrabajados++;
        });
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asignaturas: Object.values(asignaturas)
        })
      };
    }

    // ========================================
    // GET /notas/resumen - Resumen de evaluaciones conceptuales por alumno
    // ========================================
    if (httpMethod === 'GET' && path === '/notas/resumen') {
      if (!queryStringParameters || !queryStringParameters.rutAlumno) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: rutAlumno' })
        };
      }

      const rutAlumno = queryStringParameters.rutAlumno;
      const periodo = queryStringParameters.periodo; // Formato: 2025-S1 o 2025-S2

      // Obtener todas las notas del alumno
      const params = {
        TableName: RECURSOS_TABLE,
        FilterExpression: '#tipo = :tipo AND rutAlumno = :rutAlumno',
        ExpressionAttributeNames: {
          '#tipo': 'tipo'
        },
        ExpressionAttributeValues: {
          ':tipo': 'nota',
          ':rutAlumno': rutAlumno
        }
      };

      const result = await docClient.send(new ScanCommand(params));
      let notas = result.Items;

      // Filtrar por periodo si se especifica
      if (periodo) {
        const [anio, semestre] = periodo.split('-');
        const rangosFecha = {
          'S1': { inicio: `${anio}-03-01`, fin: `${anio}-07-31` },
          'S2': { inicio: `${anio}-08-01`, fin: `${anio}-12-31` }
        };

        if (rangosFecha[semestre]) {
          notas = notas.filter(n =>
            n.fecha >= rangosFecha[semestre].inicio &&
            n.fecha <= rangosFecha[semestre].fin
          );
        }
      }

      // Agrupar por asignatura y contar niveles de logro
      const resumenPorAsignatura = {};

      notas.forEach(nota => {
        if (!resumenPorAsignatura[nota.asignatura]) {
          resumenPorAsignatura[nota.asignatura] = {
            cantidadEvaluaciones: 0,
            logrados: 0,
            enDesarrollo: 0,
            noLogrados: 0,
            noTrabajados: 0
          };
        }
        resumenPorAsignatura[nota.asignatura].cantidadEvaluaciones++;

        if (nota.nivelLogro === 'L') resumenPorAsignatura[nota.asignatura].logrados++;
        else if (nota.nivelLogro === 'OD') resumenPorAsignatura[nota.asignatura].enDesarrollo++;
        else if (nota.nivelLogro === 'NL') resumenPorAsignatura[nota.asignatura].noLogrados++;
        else if (nota.nivelLogro === 'NT') resumenPorAsignatura[nota.asignatura].noTrabajados++;
      });

      // Calcular resumen general
      const totalEvaluaciones = notas.length;
      const resumenGeneral = {
        logrados: notas.filter(n => n.nivelLogro === 'L').length,
        enDesarrollo: notas.filter(n => n.nivelLogro === 'OD').length,
        noLogrados: notas.filter(n => n.nivelLogro === 'NL').length,
        noTrabajados: notas.filter(n => n.nivelLogro === 'NT').length
      };

      // Obtener información básica del alumno (curso)
      const cursoAlumno = notas.length > 0 ? notas[0].curso : null;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rutAlumno,
          curso: cursoAlumno,
          periodo: periodo || 'Todos los períodos',
          totalEvaluaciones,
          resumenGeneral,
          resumenPorAsignatura
        })
      };
    }

    // ========================================
    // PUT /notas?id=xxx - Modificar nota
    // ========================================
    if (httpMethod === 'PUT' && path === '/notas') {
      if (!queryStringParameters || !queryStringParameters.id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;
      const data = JSON.parse(event.body);

      // Verificar que la nota existe (usando helper que busca automáticamente)
      const existingItem = await getItemById(RECURSOS_TABLE, id);

      if (!existingItem) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Nota no encontrada' })
        };
      }

      const notaActual = existingItem;

      // Construir expresión de actualización
      const updateParts = [];
      const attrNames = {};
      const attrValues = {};

      if (data.nivelLogro !== undefined) {
        const valoresValidos = ['L', 'NL', 'OD', 'NT'];
        if (!valoresValidos.includes(data.nivelLogro)) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'nivelLogro debe ser: L (Logrado), NL (No Logrado), OD (Objetivo en Desarrollo), o NT (No Trabajado)' })
          };
        }
        updateParts.push('nivelLogro = :nivelLogro');
        attrValues[':nivelLogro'] = data.nivelLogro;
      }

      if (data.observaciones !== undefined) {
        updateParts.push('observaciones = :obs');
        attrValues[':obs'] = data.observaciones;
      }

      if (data.nombreEvaluacion !== undefined) {
        updateParts.push('nombreEvaluacion = :nombre');
        attrValues[':nombre'] = data.nombreEvaluacion;
      }

      if (data.fecha !== undefined) {
        updateParts.push('fecha = :fecha');
        attrValues[':fecha'] = data.fecha;
      }

      // Agregar timestamp de última modificación
      updateParts.push('ultimaModificacion = :timestamp');
      attrValues[':timestamp'] = new Date().toISOString();

      if (updateParts.length === 1) { // Solo timestamp
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No se especificaron campos para actualizar' })
        };
      }

      await docClient.send(new UpdateCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: existingItem.tipo }, // ✅ Usar tipo del item existente
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: attrValues
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Nota actualizada correctamente',
          id,
          actualizaciones: Object.keys(data)
        })
      };
    }

    // ========================================
    // DELETE /notas?id=xxx - Eliminar nota
    // ========================================
    if (httpMethod === 'DELETE' && path === '/notas') {
      if (!queryStringParameters || !queryStringParameters.id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;

      // Verificar que existe (usando helper)
      const existingItem = await getItemById(RECURSOS_TABLE, id);

      if (!existingItem) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Nota no encontrada' })
        };
      }

      await docClient.send(new DeleteCommand({
        TableName: RECURSOS_TABLE,
        Key: { id, tipo: existingItem.tipo } // ✅ Usar tipo del item existente
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Nota eliminada correctamente',
          id
        })
      };
    }

    // Ruta no encontrada
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ruta o método no soportado' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Error interno del servidor',
        error: error.message
      })
    };
  }
};