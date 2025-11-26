const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const requireLayer = require('./requireLayer');

const { authorize } = requireLayer('authMiddleware');
const { success, badRequest, serverError } = requireLayer('responseHelper');
const TABLE_NAMES = require('../shared/table-names.cjs');
const TABLE_KEYS = require('../shared/table-keys.cjs');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const ASISTENCIA_TABLE = TABLE_NAMES.ASISTENCIA_TABLE;
const RECURSOS_TABLE = TABLE_NAMES.RECURSOS_TABLE;

/**
 * Handler para reportes comparativos entre cursos/asignaturas
 *
 * Sistema de evaluación: CONCEPTUAL (L, NL, OD, NT) - NO numérico
 * - L: Logrado
 * - NL: No Logrado
 * - OD: Objetivo en Desarrollo
 * - NT: No Trabajado
 *
 * Query Parameters:
 * - compareBy: 'curso' | 'asignatura' (qué comparar)
 * - comparisonType: 'asistencia' | 'notas' (tipo de métrica)
 * - cursos: string (IDs de cursos separados por coma)
 * - asignaturas: string (IDs de asignaturas separados por coma)
 * - startDate: string (fecha inicio YYYY-MM-DD)
 * - endDate: string (fecha fin YYYY-MM-DD)
 * - periodo: string (periodo académico)
 */
exports.handler = async (event) => {
  const { httpMethod, queryStringParameters } = event;

  console.log('🚀 [BACKEND] Comparativo handler invoked:', {
    httpMethod,
    queryStringParameters
  });

  try {
    // Validar autorización
    const authResult = authorize(event);
    if (!authResult.authorized) {
      console.log('❌ [BACKEND] Authorization failed');
      return authResult.response;
    }

    // Solo GET está soportado
    if (httpMethod !== 'GET') {
      console.log('❌ [BACKEND] Invalid HTTP method:', httpMethod);
      return badRequest('Solo se permite método GET para este endpoint');
    }

    const {
      compareBy = 'curso',
      comparisonType = 'asistencia',
      cursos = '',
      asignaturas = '',
      startDate,
      endDate,
      periodo
    } = queryStringParameters || {};

    console.log('📥 [BACKEND] Parsed parameters:', {
      compareBy,
      comparisonType,
      cursos,
      asignaturas,
      startDate,
      endDate,
      periodo
    });

    // Parse arrays
    const cursosArray = cursos ? cursos.split(',').filter(Boolean) : [];
    const asignaturasArray = asignaturas ? asignaturas.split(',').filter(Boolean) : [];

    console.log('🔧 [BACKEND] Parsed arrays:', {
      cursosArray,
      asignaturasArray
    });

    // Validaciones
    if (compareBy === 'curso' && cursosArray.length === 0) {
      return badRequest('Debe seleccionar al menos un curso para comparar');
    }
    if (compareBy === 'asignatura' && asignaturasArray.length === 0) {
      return badRequest('Debe seleccionar al menos una asignatura para comparar');
    }
    if (startDate && endDate && startDate > endDate) {
      return badRequest('La fecha de inicio debe ser menor que la fecha de fin');
    }

    let comparisons = [];

    // Comparar por curso
    if (compareBy === 'curso') {
      if (comparisonType === 'asistencia') {
        comparisons = await getAsistenciaPromedioPorCurso(cursosArray, startDate, endDate);
      } else if (comparisonType === 'notas') {
        comparisons = await getNotasPromedioPorCurso(cursosArray, asignaturasArray, startDate, endDate, periodo);
      } else {
        return badRequest('Tipo de comparación no soportado. Use "asistencia" o "notas"');
      }
    }
    // Comparar por asignatura
    else if (compareBy === 'asignatura') {
      if (comparisonType === 'asistencia') {
        return badRequest('La asistencia se registra por curso/día, no por asignatura. Use compareBy="curso" en su lugar.');
      } else if (comparisonType === 'notas') {
        comparisons = await getNotasPromedioPorAsignatura(asignaturasArray, cursosArray, startDate, endDate, periodo);
      } else {
        return badRequest('Tipo de comparación no soportado. Use "asistencia" o "notas"');
      }
    } else {
      return badRequest('Parámetro compareBy inválido. Use "curso" o "asignatura"');
    }

    const responseData = {
      comparisons,
      metadata: {
        compareBy,
        comparisonType,
        cursos: cursosArray,
        asignaturas: asignaturasArray,
        dateRange: { startDate, endDate },
        periodo
      }
    };

    console.log('✅ [BACKEND] Sending response:', {
      comparisonsCount: comparisons.length,
      metadata: responseData.metadata,
      firstComparison: comparisons[0] || null
    });

    return success(responseData);

  } catch (error) {
    console.error('❌ [BACKEND] Error en comparativo:', error);
    return serverError('Error al generar el reporte comparativo', error);
  }
};

/**
 * Obtener promedio de asistencia por curso
 * @returns Array de objetos con distribución de asistencia por curso
 */
async function getAsistenciaPromedioPorCurso(cursos, startDate, endDate) {
  try {
    console.log('📊 [BACKEND] getAsistenciaPromedioPorCurso called:', { cursos, startDate, endDate });

    // Obtener todos los registros de asistencia
    const result = await docClient.send(new ScanCommand({
      TableName: ASISTENCIA_TABLE
    }));

    let registros = result.Items || [];
    console.log(`📦 [BACKEND] Retrieved ${registros.length} total attendance records`);

    // Si no hay datos, retornar array vacío con mensaje
    if (registros.length === 0) {
      console.warn('⚠️ [BACKEND] No hay registros de asistencia en la tabla');
      return [];
    }

    // Filtrar por cursos seleccionados
    if (cursos.length > 0) {
      const beforeFilter = registros.length;
      registros = registros.filter(r => cursos.includes(r.curso));
      console.log(`🔍 [BACKEND] Filtered by courses: ${beforeFilter} -> ${registros.length} records`);
    }

    // Filtrar por rango de fechas
    if (startDate && endDate) {
      const beforeFilter = registros.length;
      registros = registros.filter(r => r.fecha >= startDate && r.fecha <= endDate);
      console.log(`📅 [BACKEND] Filtered by date range (${startDate} to ${endDate}): ${beforeFilter} -> ${registros.length} records`);
    } else if (startDate) {
      const beforeFilter = registros.length;
      registros = registros.filter(r => r.fecha >= startDate);
      console.log(`📅 [BACKEND] Filtered by start date (>= ${startDate}): ${beforeFilter} -> ${registros.length} records`);
    } else if (endDate) {
      const beforeFilter = registros.length;
      registros = registros.filter(r => r.fecha <= endDate);
      console.log(`📅 [BACKEND] Filtered by end date (<= ${endDate}): ${beforeFilter} -> ${registros.length} records`);
    }

    // Si después de filtrar no hay datos, retornar array vacío
    if (registros.length === 0) {
      console.warn('⚠️ [BACKEND] No hay registros de asistencia para los filtros seleccionados');
      return [];
    }

    // Agrupar por curso y calcular estadísticas
    const cursosMap = {};
    registros.forEach(registro => {
      if (!cursosMap[registro.curso]) {
        cursosMap[registro.curso] = {
          curso: registro.curso,
          total: 0,
          presente: 0,
          ausente: 0,
          atrasado: 0,
          justificado: 0
        };
      }
      cursosMap[registro.curso].total++;

      // Contar estados
      if (registro.estado === 'presente') {
        cursosMap[registro.curso].presente++;
      } else if (registro.estado === 'ausente') {
        cursosMap[registro.curso].ausente++;
      } else if (registro.estado === 'tarde') {
        cursosMap[registro.curso].atrasado++; // 'tarde' en el sistema = 'atrasado' en estadísticas
      } else if (registro.estado === 'justificado') {
        cursosMap[registro.curso].justificado++;
      }
    });

    // Convertir a array de resultados
    const results = Object.values(cursosMap).map(curso => {
      const porcentajeAsistencia = curso.total > 0
        ? (curso.presente / curso.total) * 100
        : 0;

      return {
        label: curso.curso,
        count: curso.total,
        porcentajeAsistencia: parseFloat(porcentajeAsistencia.toFixed(1)),
        distribucionAsistencia: {
          presente: curso.presente,
          ausente: curso.ausente,
          atrasado: curso.atrasado,
          justificado: curso.justificado
        },
        distribucionAsistenciaPorcentual: {
          presente: `${((curso.presente / curso.total) * 100).toFixed(1)}%`,
          ausente: `${((curso.ausente / curso.total) * 100).toFixed(1)}%`,
          atrasado: `${((curso.atrasado / curso.total) * 100).toFixed(1)}%`,
          justificado: `${((curso.justificado / curso.total) * 100).toFixed(1)}%`
        }
      };
    });

    // Ordenar por porcentaje de asistencia (mayor a menor)
    results.sort((a, b) => b.porcentajeAsistencia - a.porcentajeAsistencia);

    console.log('✅ [BACKEND] Asistencia por curso calculated:', {
      resultsCount: results.length,
      courses: results.map(r => r.label)
    });

    return results;
  } catch (error) {
    console.error('❌ [BACKEND] Error obteniendo asistencia por curso:', error);
    throw error;
  }
}

/**
 * Obtener distribución de logro académico por curso
 * @returns Array de objetos con distribución de niveles L, NL, OD, NT por curso
 */
async function getNotasPromedioPorCurso(cursos, asignaturas, startDate, endDate, periodo) {
  try {
    console.log('📊 [BACKEND] getNotasPromedioPorCurso called:', { cursos, asignaturas, startDate, endDate, periodo });

    // Obtener todos los recursos de tipo 'nota'
    const result = await docClient.send(new ScanCommand({
      TableName: RECURSOS_TABLE
    }));

    let notas = result.Items || [];
    console.log(`📦 [BACKEND] Retrieved ${notas.length} total resources`);

    // Filtrar solo recursos de tipo 'nota'
    notas = notas.filter(item => item.tipo === 'nota');
    console.log(`📝 [BACKEND] Filtered to ${notas.length} nota resources`);

    // Si no hay datos, retornar array vacío
    if (notas.length === 0) {
      console.warn('⚠️ [BACKEND] No hay evaluaciones registradas en la tabla');
      return [];
    }

    // Filtrar por cursos seleccionados
    if (cursos.length > 0) {
      const beforeFilter = notas.length;
      notas = notas.filter(n => cursos.includes(n.curso));
      console.log(`🔍 [BACKEND] Filtered by courses: ${beforeFilter} -> ${notas.length} records`);
    }

    // Filtrar por asignaturas si se especificaron
    if (asignaturas.length > 0) {
      const beforeFilter = notas.length;
      notas = notas.filter(n => asignaturas.includes(n.asignatura));
      console.log(`📚 [BACKEND] Filtered by subjects: ${beforeFilter} -> ${notas.length} records`);
    }

    // Filtrar por periodo
    if (periodo) {
      const beforeFilter = notas.length;
      notas = notas.filter(n => n.periodo === periodo);
      console.log(`📆 [BACKEND] Filtered by period (${periodo}): ${beforeFilter} -> ${notas.length} records`);
    }

    // Filtrar por rango de fechas
    if (startDate && endDate) {
      const beforeFilter = notas.length;
      notas = notas.filter(n => n.fecha >= startDate && n.fecha <= endDate);
      console.log(`📅 [BACKEND] Filtered by date range (${startDate} to ${endDate}): ${beforeFilter} -> ${notas.length} records`);
    } else if (startDate) {
      const beforeFilter = notas.length;
      notas = notas.filter(n => n.fecha >= startDate);
      console.log(`📅 [BACKEND] Filtered by start date (>= ${startDate}): ${beforeFilter} -> ${notas.length} records`);
    } else if (endDate) {
      const beforeFilter = notas.length;
      notas = notas.filter(n => n.fecha <= endDate);
      console.log(`📅 [BACKEND] Filtered by end date (<= ${endDate}): ${beforeFilter} -> ${notas.length} records`);
    }

    // Si después de filtrar no hay datos, retornar array vacío
    if (notas.length === 0) {
      console.warn('⚠️ [BACKEND] No hay evaluaciones para los filtros seleccionados');
      return [];
    }

    // Agrupar por curso y contar niveles de logro
    const cursosMap = {};
    notas.forEach(nota => {
      if (!cursosMap[nota.curso]) {
        cursosMap[nota.curso] = {
          curso: nota.curso,
          total: 0,
          L: 0,   // Logrado
          NL: 0,  // No Logrado
          OD: 0,  // Objetivo en Desarrollo
          NT: 0   // No Trabajado
        };
      }
      cursosMap[nota.curso].total++;

      // Contar niveles de logro
      const nivel = nota.nivelLogro;
      if (nivel === 'L') {
        cursosMap[nota.curso].L++;
      } else if (nivel === 'NL') {
        cursosMap[nota.curso].NL++;
      } else if (nivel === 'OD') {
        cursosMap[nota.curso].OD++;
      } else if (nivel === 'NT') {
        cursosMap[nota.curso].NT++;
      }
    });

    // Convertir a array de resultados
    const results = Object.values(cursosMap).map(curso => {
      return {
        label: curso.curso,
        count: curso.total,
        distribucionLogro: {
          L: curso.L,
          NL: curso.NL,
          OD: curso.OD,
          NT: curso.NT
        },
        distribucionLogroPorcentual: {
          L: `${((curso.L / curso.total) * 100).toFixed(1)}%`,
          NL: `${((curso.NL / curso.total) * 100).toFixed(1)}%`,
          OD: `${((curso.OD / curso.total) * 100).toFixed(1)}%`,
          NT: `${((curso.NT / curso.total) * 100).toFixed(1)}%`
        }
      };
    });

    // Ordenar por cantidad de "Logrado" (mayor a menor)
    results.sort((a, b) => b.distribucionLogro.L - a.distribucionLogro.L);

    console.log('✅ [BACKEND] Notas por curso calculated:', {
      resultsCount: results.length,
      courses: results.map(r => r.label),
      distributions: results.map(r => ({ label: r.label, logro: r.distribucionLogro }))
    });

    return results;
  } catch (error) {
    console.error('❌ [BACKEND] Error obteniendo logro académico por curso:', error);
    throw error;
  }
}

/**
 * Obtener distribución de logro académico por asignatura
 * @returns Array de objetos con distribución de niveles L, NL, OD, NT por asignatura
 */
async function getNotasPromedioPorAsignatura(asignaturas, cursos, startDate, endDate, periodo) {
  try {
    // Obtener todos los recursos de tipo 'nota'
    const result = await docClient.send(new ScanCommand({
      TableName: RECURSOS_TABLE
    }));

    let notas = result.Items || [];

    // Filtrar solo recursos de tipo 'nota'
    notas = notas.filter(item => item.tipo === 'nota');

    // Si no hay datos, retornar array vacío
    if (notas.length === 0) {
      console.warn('No hay evaluaciones registradas en la tabla');
      return [];
    }

    // Filtrar por asignaturas seleccionadas
    if (asignaturas.length > 0) {
      notas = notas.filter(n => asignaturas.includes(n.asignatura));
    }

    // Filtrar por cursos si se especificaron (filtro adicional)
    if (cursos.length > 0) {
      notas = notas.filter(n => cursos.includes(n.curso));
    }

    // Filtrar por periodo
    if (periodo) {
      notas = notas.filter(n => n.periodo === periodo);
    }

    // Filtrar por rango de fechas
    if (startDate && endDate) {
      notas = notas.filter(n => n.fecha >= startDate && n.fecha <= endDate);
    } else if (startDate) {
      notas = notas.filter(n => n.fecha >= startDate);
    } else if (endDate) {
      notas = notas.filter(n => n.fecha <= endDate);
    }

    // Si después de filtrar no hay datos, retornar array vacío
    if (notas.length === 0) {
      console.warn('No hay evaluaciones para los filtros seleccionados');
      return [];
    }

    // Agrupar por asignatura y contar niveles de logro
    const asignaturasMap = {};
    notas.forEach(nota => {
      if (!asignaturasMap[nota.asignatura]) {
        asignaturasMap[nota.asignatura] = {
          asignatura: nota.asignatura,
          total: 0,
          L: 0,
          NL: 0,
          OD: 0,
          NT: 0
        };
      }
      asignaturasMap[nota.asignatura].total++;

      // Contar niveles de logro
      const nivel = nota.nivelLogro;
      if (nivel === 'L') {
        asignaturasMap[nota.asignatura].L++;
      } else if (nivel === 'NL') {
        asignaturasMap[nota.asignatura].NL++;
      } else if (nivel === 'OD') {
        asignaturasMap[nota.asignatura].OD++;
      } else if (nivel === 'NT') {
        asignaturasMap[nota.asignatura].NT++;
      }
    });

    // Convertir a array de resultados
    const results = Object.values(asignaturasMap).map(asignatura => {
      return {
        label: asignatura.asignatura,
        count: asignatura.total,
        distribucionLogro: {
          L: asignatura.L,
          NL: asignatura.NL,
          OD: asignatura.OD,
          NT: asignatura.NT
        },
        distribucionLogroPorcentual: {
          L: `${((asignatura.L / asignatura.total) * 100).toFixed(1)}%`,
          NL: `${((asignatura.NL / asignatura.total) * 100).toFixed(1)}%`,
          OD: `${((asignatura.OD / asignatura.total) * 100).toFixed(1)}%`,
          NT: `${((asignatura.NT / asignatura.total) * 100).toFixed(1)}%`
        }
      };
    });

    // Ordenar por cantidad de "Logrado" (mayor a menor)
    results.sort((a, b) => b.distribucionLogro.L - a.distribucionLogro.L);

    return results;
  } catch (error) {
    console.error('Error obteniendo logro académico por asignatura:', error);
    throw error;
  }
}

// Metadata para auto-discovery de CDK
exports.metadata = {
  route: '/comparativo',
  methods: ['GET'],
  auth: true,
  roles: ['admin'],
  profile: 'medium',
  tables: [TABLE_KEYS.ASISTENCIA_TABLE, TABLE_KEYS.RECURSOS_TABLE],
};
