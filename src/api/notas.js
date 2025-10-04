const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { authorize } = require('/opt/nodejs/authMiddleware');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const RECURSOS_TABLE = process.env.RECURSOS_TABLE;

/**
 * Helper: Obtener item de RecursosAcademicos por ID (busca el tipo automáticamente)
 * Necesario porque la tabla tiene composite key {id, tipo} pero frontend solo envía id
 */
async function getItemById(id) {
  // Buscar por id usando Scan (menos eficiente pero funciona)
  const result = await docClient.send(new ScanCommand({
    TableName: RECURSOS_TABLE,
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: { ':id': id },
    Limit: 1
  }));

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

/**
 * Lambda handler para gestión de notas académicas
 * Soporta evaluaciones con escalas numéricas (1.0-7.0) y conceptuales (L, NL, OD, NT)
 *
 * CU-28: Ingresar notas
 * CU-29: Modificar notas
 * CU-30: Eliminar notas
 * CU-31: Cálculo automático de promedios
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, resource, queryStringParameters } = event;

    // ========================================
    // POST /notas - Crear nota
    // ========================================
    if (httpMethod === 'POST' && resource === '/notas') {
      const data = JSON.parse(event.body);

      // Validaciones
      if (!data.rutAlumno || !data.curso || !data.asignatura || !data.nombreEvaluacion) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Campos requeridos: rutAlumno, curso, asignatura, nombreEvaluacion' })
        };
      }

      // Validar tipo de evaluación
      const tipoEvaluacion = data.tipoEvaluacion || 'numerica'; // 'numerica' o 'conceptual'

      if (tipoEvaluacion === 'numerica') {
        if (data.nota === undefined || data.nota === null) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'El campo "nota" es requerido para evaluaciones numéricas' })
          };
        }
        if (data.nota < 1.0 || data.nota > 7.0) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'La nota debe estar entre 1.0 y 7.0' })
          };
        }
      } else if (tipoEvaluacion === 'conceptual') {
        const valoresValidos = ['L', 'NL', 'OD', 'NT'];
        if (!data.evaluacionConceptual || !valoresValidos.includes(data.evaluacionConceptual)) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: 'El campo "evaluacionConceptual" debe ser uno de: L (Logrado), NL (No Logrado), OD (Objetivo en Desarrollo), NT (Objetivo No Trabajado)'
            })
          };
        }
      }

      const item = {
        id: `nota-${uuidv4()}`,
        tipo: 'nota',
        rutAlumno: data.rutAlumno,
        curso: data.curso,
        asignatura: data.asignatura,
        nombreEvaluacion: data.nombreEvaluacion,
        tipoEvaluacion,
        fecha: data.fecha || new Date().toISOString().split('T')[0],
        profesor: data.profesor,
        observaciones: data.observaciones || '',
        timestamp: new Date().toISOString(),
      };

      // Agregar nota según tipo
      if (tipoEvaluacion === 'numerica') {
        item.nota = parseFloat(data.nota.toFixed(1));
      } else {
        item.evaluacionConceptual = data.evaluacionConceptual;
      }

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
    if (httpMethod === 'GET' && resource === '/notas') {
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
        }
      }

      const result = await docClient.send(new ScanCommand(params));

      // Calcular promedio general (solo para notas numéricas)
      const notasNumericas = result.Items.filter(n => n.tipoEvaluacion === 'numerica' && n.nota);
      const promedioGeneral = notasNumericas.length > 0
        ? (notasNumericas.reduce((sum, n) => sum + n.nota, 0) / notasNumericas.length).toFixed(1)
        : null;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notas: result.Items,
          total: result.Items.length,
          promedioGeneral: promedioGeneral ? parseFloat(promedioGeneral) : null
        })
      };
    }

    // ========================================
    // GET /notas/agrupadas - Notas agrupadas por asignatura (para vista de alumnos)
    // ========================================
    if (httpMethod === 'GET' && resource === '/notas/agrupadas') {
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
              promedio: 0
            }
          };
        }

        asignaturas[nota.asignatura].evaluaciones.push({
          id: nota.id,
          nombreEvaluacion: nota.nombreEvaluacion,
          tipoEvaluacion: nota.tipoEvaluacion,
          nota: nota.nota,
          evaluacionConceptual: nota.evaluacionConceptual,
          fecha: nota.fecha,
          observaciones: nota.observaciones
        });
      });

      // Calcular resumen por asignatura
      Object.values(asignaturas).forEach(asig => {
        const notasNumericas = asig.evaluaciones.filter(e => e.tipoEvaluacion === 'numerica' && e.nota);
        asig.resumen.cantidadEvaluaciones = asig.evaluaciones.length;

        if (notasNumericas.length > 0) {
          const suma = notasNumericas.reduce((acc, e) => acc + e.nota, 0);
          asig.resumen.promedio = parseFloat((suma / notasNumericas.length).toFixed(1));
        }
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
    // GET /notas/promedios - Calcular promedios por alumno
    // ========================================
    if (httpMethod === 'GET' && resource === '/notas/promedios') {
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
        FilterExpression: '#tipo = :tipo AND rutAlumno = :rutAlumno AND tipoEvaluacion = :tipoEval',
        ExpressionAttributeNames: {
          '#tipo': 'tipo'
        },
        ExpressionAttributeValues: {
          ':tipo': 'nota',
          ':rutAlumno': rutAlumno,
          ':tipoEval': 'numerica'
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

      // Agrupar por asignatura
      const promediosPorAsignatura = {};

      notas.forEach(nota => {
        if (!promediosPorAsignatura[nota.asignatura]) {
          promediosPorAsignatura[nota.asignatura] = {
            notas: [],
            cantidadEvaluaciones: 0
          };
        }
        promediosPorAsignatura[nota.asignatura].notas.push(nota.nota);
        promediosPorAsignatura[nota.asignatura].cantidadEvaluaciones++;
      });

      // Calcular promedios
      Object.keys(promediosPorAsignatura).forEach(asignatura => {
        const notasAsignatura = promediosPorAsignatura[asignatura].notas;
        const promedio = notasAsignatura.reduce((sum, n) => sum + n, 0) / notasAsignatura.length;
        promediosPorAsignatura[asignatura].promedio = parseFloat(promedio.toFixed(1));
      });

      // Calcular promedio general
      const todosLosPromedios = Object.values(promediosPorAsignatura).map(a => a.promedio);
      const promedioGeneral = todosLosPromedios.length > 0
        ? parseFloat((todosLosPromedios.reduce((sum, p) => sum + p, 0) / todosLosPromedios.length).toFixed(1))
        : null;

      // Obtener información básica del alumno (curso)
      const cursoAlumno = notas.length > 0 ? notas[0].curso : null;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rutAlumno,
          curso: cursoAlumno,
          periodo: periodo || 'Todos los períodos',
          promedios: promediosPorAsignatura,
          promedioGeneral
        })
      };
    }

    // ========================================
    // PUT /notas?id=xxx - Modificar nota
    // ========================================
    if (httpMethod === 'PUT' && resource === '/notas') {
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
      const existingItem = await getItemById(id);

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

      if (data.nota !== undefined && notaActual.tipoEvaluacion === 'numerica') {
        if (data.nota < 1.0 || data.nota > 7.0) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'La nota debe estar entre 1.0 y 7.0' })
          };
        }
        updateParts.push('nota = :nota');
        attrValues[':nota'] = parseFloat(data.nota.toFixed(1));
      }

      if (data.evaluacionConceptual !== undefined && notaActual.tipoEvaluacion === 'conceptual') {
        const valoresValidos = ['L', 'NL', 'OD', 'NT'];
        if (!valoresValidos.includes(data.evaluacionConceptual)) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Evaluación conceptual debe ser: L, NL, OD o NT' })
          };
        }
        updateParts.push('evaluacionConceptual = :evalConceptual');
        attrValues[':evalConceptual'] = data.evaluacionConceptual;
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
    if (httpMethod === 'DELETE' && resource === '/notas') {
      if (!queryStringParameters || !queryStringParameters.id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: id' })
        };
      }

      const id = queryStringParameters.id;

      // Verificar que existe (usando helper)
      const existingItem = await getItemById(id);

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