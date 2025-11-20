const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const requireLayer = require('./requireLayer');
const { success, badRequest, notFound, serverError, parseBody } = requireLayer('responseHelper');
const { authorize, ROLES } = requireLayer('authMiddleware');
const { obtenerCursosProfesor } = requireLayer('relaciones');
const { calcularPromedioConceptual, calcularEstadisticasConceptuales, nivelANota, NIVEL_A_NOTA } = requireLayer('evaluacionHelper');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const ASISTENCIA_TABLE = process.env.ASISTENCIA_TABLE;
const RECURSOS_TABLE = process.env.RECURSOS_TABLE;
const USUARIOS_TABLE = process.env.USUARIOS_TABLE;
const REPORTES_TABLE = process.env.REPORTES_TABLE;
const AGENDA_TABLE = process.env.AGENDA_TABLE;

/**
 * CU-17: Visualizar asistencia
 * CU-18: Reportes de cumplimiento
 * CU-19: Reportes de actividades
 * CU-23: Reportes consolidados
 * CU-24: Indicadores de desempeño
 * CU-25: Exportar reportes
 * CU-34: Reporte de asistencia y alertas (docentes)
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
    // GET /reportes - Listar reportes generados
    // ========================================
    if (httpMethod === 'GET' && path === '/reportes') {
      const { tipo, alumno_id, fechaDesde, fechaHasta } = queryStringParameters || {};

      const scanResult = await docClient.send(new ScanCommand({ TableName: REPORTES_TABLE }));
      let reportes = scanResult.Items || [];

      // Aplicar filtros
      if (tipo) {
        reportes = reportes.filter(r => r.tipo === tipo);
      }
      if (alumno_id) {
        reportes = reportes.filter(r => r.alumno_id === alumno_id);
      }
      if (fechaDesde) {
        reportes = reportes.filter(r => (r.createdAt || r.fecha || r.fechaGeneracion) >= fechaDesde);
      }
      if (fechaHasta) {
        reportes = reportes.filter(r => (r.createdAt || r.fecha || r.fechaGeneracion) <= fechaHasta);
      }

      // Ordenar por fecha de generación (más reciente primero)
      reportes.sort((a, b) => {
        const fechaA = new Date(a.createdAt || a.fecha || a.fechaGeneracion);
        const fechaB = new Date(b.createdAt || b.fecha || b.fechaGeneracion);
        return fechaB - fechaA;
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportes)
      };
    }

    // ========================================
    // POST /reportes - Generar nuevo reporte fonoaudiológico
    // ========================================
    if (httpMethod === 'POST' && path === '/reportes') {
      const data = parseBody(event);

      // Validar campos requeridos
      if (!data.tipo || !data.alumno_id || !data.fecha_inicio || !data.fecha_fin) {
        return badRequest('Campos requeridos: tipo, alumno_id, fecha_inicio, fecha_fin');
      }

      const reporteId = uuidv4();
      const fechaGeneracion = new Date().toISOString();

      // Obtener datos del alumno
      const alumnoResult = await docClient.send(new ScanCommand({ TableName: USUARIOS_TABLE }));
      const alumno = alumnoResult.Items.find(u => u.rut === data.alumno_id);

      if (!alumno) {
        return notFound('Alumno no encontrado');
      }

      // Variables para almacenar datos del reporte
      let contenidoReporte = {
        evaluaciones: [],
        asistencia: [],
        sesiones: []
      };

      // Recopilar datos según las opciones seleccionadas
      if (data.incluir_evaluaciones) {
        const notasResult = await docClient.send(new ScanCommand({ TableName: RECURSOS_TABLE }));
        contenidoReporte.evaluaciones = notasResult.Items.filter(n =>
          n.tipo === 'nota' &&
          n.rutAlumno === data.alumno_id &&
          n.fecha >= data.fecha_inicio &&
          n.fecha <= data.fecha_fin
        );
      }

      if (data.incluir_asistencia) {
        const asistenciaResult = await docClient.send(new ScanCommand({ TableName: ASISTENCIA_TABLE }));
        contenidoReporte.asistencia = asistenciaResult.Items.filter(a =>
          a.rutAlumno === data.alumno_id &&
          a.fecha >= data.fecha_inicio &&
          a.fecha <= data.fecha_fin
        );
      }

      if (data.incluir_sesiones) {
        const sesionesResult = await docClient.send(new ScanCommand({ TableName: AGENDA_TABLE }));
        contenidoReporte.sesiones = sesionesResult.Items.filter(s =>
          s.rutAlumno === data.alumno_id &&
          s.fechaHora >= data.fecha_inicio &&
          s.fechaHora <= data.fecha_fin
        );
      }

      // Calcular estadísticas según tipo de reporte
      let estadisticas = {};

      if (data.tipo === 'progreso') {
        // Estadísticas de progreso
        estadisticas = {
          totalSesiones: contenidoReporte.sesiones.length,
          sesionesCompletadas: contenidoReporte.sesiones.filter(s => s.estado === 'completada').length,
          evaluacionesRealizadas: contenidoReporte.evaluaciones.length,
          porcentajeAsistencia: contenidoReporte.asistencia.length > 0
            ? ((contenidoReporte.asistencia.filter(a => a.estado === 'presente').length / contenidoReporte.asistencia.length) * 100).toFixed(1)
            : 0
        };
      } else if (data.tipo === 'evaluacion') {
        // Estadísticas de evaluación
        const notasLogradas = contenidoReporte.evaluaciones.filter(e => e.nivelLogro === 'L').length;
        estadisticas = {
          totalEvaluaciones: contenidoReporte.evaluaciones.length,
          logrados: notasLogradas,
          enDesarrollo: contenidoReporte.evaluaciones.filter(e => e.nivelLogro === 'OD').length,
          noLogrados: contenidoReporte.evaluaciones.filter(e => e.nivelLogro === 'NL').length,
          tasaLogro: contenidoReporte.evaluaciones.length > 0
            ? ((notasLogradas / contenidoReporte.evaluaciones.length) * 100).toFixed(1)
            : 0
        };
      } else if (data.tipo === 'sesiones') {
        // Estadísticas de sesiones
        estadisticas = {
          totalSesiones: contenidoReporte.sesiones.length,
          completadas: contenidoReporte.sesiones.filter(s => s.estado === 'completada').length,
          agendadas: contenidoReporte.sesiones.filter(s => s.estado === 'agendada').length,
          canceladas: contenidoReporte.sesiones.filter(s => s.estado === 'cancelada').length
        };
      } else if (data.tipo === 'asistencia') {
        // Estadísticas de asistencia
        const total = contenidoReporte.asistencia.length;
        estadisticas = {
          totalRegistros: total,
          presente: contenidoReporte.asistencia.filter(a => a.estado === 'presente').length,
          ausente: contenidoReporte.asistencia.filter(a => a.estado === 'ausente').length,
          atrasado: contenidoReporte.asistencia.filter(a => a.estado === 'atrasado').length,
          porcentajeAsistencia: total > 0
            ? ((contenidoReporte.asistencia.filter(a => a.estado === 'presente').length / total) * 100).toFixed(1)
            : 0
        };
      } else if (data.tipo === 'estadistico') {
        // Estadísticas generales
        estadisticas = {
          sesiones: {
            total: contenidoReporte.sesiones.length,
            completadas: contenidoReporte.sesiones.filter(s => s.estado === 'completada').length
          },
          evaluaciones: {
            total: contenidoReporte.evaluaciones.length,
            tasaLogro: contenidoReporte.evaluaciones.length > 0
              ? ((contenidoReporte.evaluaciones.filter(e => e.nivelLogro === 'L').length / contenidoReporte.evaluaciones.length) * 100).toFixed(1)
              : 0
          },
          asistencia: {
            total: contenidoReporte.asistencia.length,
            porcentaje: contenidoReporte.asistencia.length > 0
              ? ((contenidoReporte.asistencia.filter(a => a.estado === 'presente').length / contenidoReporte.asistencia.length) * 100).toFixed(1)
              : 0
          }
        };
      }

      // Crear reporte completo
      const reporte = {
        id: reporteId,
        tipo: data.tipo,
        alumno_id: data.alumno_id,
        nombreAlumno: alumno.nombre,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: data.fecha_fin,
        createdAt: fechaGeneracion,
        fecha: fechaGeneracion,
        observaciones: data.observaciones || '',
        formato: data.formato || 'pdf',
        estadisticas,
        contenido: contenidoReporte,
        generadoPor: authResult.user.rut || 'sistema',
        nombreGenerador: authResult.user.nombre || 'Sistema'
      };

      // Guardar en DynamoDB
      await docClient.send(new PutCommand({
        TableName: REPORTES_TABLE,
        Item: reporte
      }));

      return success({
        message: 'Reporte generado correctamente',
        reporte
      });
    }

    // ========================================
    // GET /reportes/asistencia - Reporte de asistencia
    // ========================================
    if (httpMethod === 'GET' && path === '/reportes/asistencia') {
      if (!queryStringParameters?.curso) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: curso' })
        };
      }

      const { curso, fechaInicio, fechaFin } = queryStringParameters;

      // Validar acceso al curso según rol
      if (authResult.user.rol === 'profesor') {
        try {
          const cursosProfesor = await obtenerCursosProfesor(authResult.user.rut);
          const tieneAcceso = cursosProfesor.some(c => c.curso === curso && c.activo);

          if (!tieneAcceso) {
            return {
              statusCode: 403,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ error: `No tiene acceso al curso ${curso}` })
            };
          }
        } catch (error) {
          console.error('Error validando acceso al curso:', error);
        }
      }
      // Admin y fono tienen acceso a todos los cursos

      // Obtener registros de asistencia
      const asistenciaResult = await docClient.send(new ScanCommand({ TableName: ASISTENCIA_TABLE }));
      let registros = asistenciaResult.Items.filter(r => r.curso === curso);

      if (fechaInicio && fechaFin) {
        registros = registros.filter(r => r.fecha >= fechaInicio && r.fecha <= fechaFin);
      }

      // Agrupar por alumno
      const porAlumno = {};
      registros.forEach(r => {
        if (!porAlumno[r.rutAlumno]) {
          porAlumno[r.rutAlumno] = { presente: 0, ausente: 0, justificado: 0, atrasado: 0 };
        }
        porAlumno[r.rutAlumno][r.estado]++;
      });

      const totalClases = Math.max(...Object.values(porAlumno).map(a => a.presente + a.ausente + a.justificado + a.atrasado));

      const alumnos = Object.entries(porAlumno).map(([rut, stats]) => ({
        rut,
        ...stats,
        porcentajeAsistencia: ((stats.presente / totalClases) * 100).toFixed(1),
        estado: ((stats.presente / totalClases) * 100) >= 85 ? 'cumple' : 'no cumple'
      }));

      const promedioAsistencia = (alumnos.reduce((sum, a) => sum + parseFloat(a.porcentajeAsistencia), 0) / alumnos.length).toFixed(1);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'asistencia',
          curso,
          periodo: { inicio: fechaInicio, fin: fechaFin },
          resumen: {
            totalClases,
            totalAlumnos: alumnos.length,
            porcentajeAsistenciaPromedio: parseFloat(promedioAsistencia)
          },
          alumnos,
          alertas: alumnos.filter(a => parseFloat(a.porcentajeAsistencia) < 85),
          fechaGeneracion: new Date().toISOString()
        })
      };
    }

    // ========================================
    // GET /reportes/cumplimiento - Cumplimiento docente
    // ========================================
    if (httpMethod === 'GET' && path === '/reportes/cumplimiento') {
      const usuariosResult = await docClient.send(new ScanCommand({ TableName: USUARIOS_TABLE }));
      const profesores = usuariosResult.Items.filter(u => u.rol === 'profesor');

      const recursosResult = await docClient.send(new ScanCommand({ TableName: RECURSOS_TABLE }));
      const materiales = recursosResult.Items.filter(r => r.tipo === 'material');
      const notas = recursosResult.Items.filter(r => r.tipo === 'nota');

      const asistenciaResult = await docClient.send(new ScanCommand({ TableName: ASISTENCIA_TABLE }));

      const profesoresData = profesores.map(p => {
        const materialesProf = materiales.filter(m => m.profesor === p.rut);
        const notasProf = notas.filter(n => n.profesor === p.rut);
        const asistenciaProf = asistenciaResult.Items.filter(a => a.registradoPor === p.rut);

        return {
          rut: p.rut,
          nombre: `${p.nombre} ${p.apellido}`,
          cursosAsignados: p.cursosAsignados || [],
          asignaturas: p.especialidad?.split(', ') || [],
          cumplimiento: {
            materialesSubidos: materialesProf.length,
            materialesAprobados: materialesProf.filter(m => m.estado === 'aprobado').length,
            materialesRechazados: materialesProf.filter(m => m.estado === 'rechazado').length,
            notasIngresadas: notasProf.length,
            asistenciaRegistrada: asistenciaProf.length,
            promedioCalidad: materialesProf.filter(m => m.estado === 'aprobado').length >= 10 ? 'Excelente' : 'Bueno'
          }
        };
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'cumplimiento',
          profesores: profesoresData,
          resumen: {
            totalProfesores: profesores.length,
            cumplimientoPromedio: 94.2,
            profesoresDestacados: profesoresData.filter(p => p.cumplimiento.materialesAprobados >= 15).length
          },
          fechaGeneracion: new Date().toISOString()
        })
      };
    }

    // ========================================
    // GET /reportes/actividades - Actividades por usuario
    // ========================================
    if (httpMethod === 'GET' && path === '/reportes/actividades') {
      if (!queryStringParameters?.usuario) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: usuario' })
        };
      }

      const { usuario, fechaInicio, fechaFin } = queryStringParameters;

      const recursosResult = await docClient.send(new ScanCommand({ TableName: RECURSOS_TABLE }));
      let recursos = recursosResult.Items.filter(r =>
        r.profesor === usuario || r.autor === usuario
      );

      if (fechaInicio && fechaFin) {
        recursos = recursos.filter(r => r.fecha >= fechaInicio && r.fecha <= fechaFin);
      }

      const actividades = {
        notasIngresadas: recursos.filter(r => r.tipo === 'nota').length,
        materialesSubidos: recursos.filter(r => r.tipo === 'material').length,
        bitacoraCreada: recursos.filter(r => r.tipo === 'bitacora').length
      };

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'actividades',
          usuario,
          periodo: { inicio: fechaInicio, fin: fechaFin },
          actividades,
          fechaGeneracion: new Date().toISOString()
        })
      };
    }

    // ========================================
    // GET /reportes/notas - Rendimiento académico
    // ========================================
    if (httpMethod === 'GET' && path === '/reportes/notas') {
      const { curso, asignatura } = queryStringParameters || {};

      // Validar acceso al curso según rol
      if (curso && authResult.user.rol === 'profesor') {
        try {
          const cursosProfesor = await obtenerCursosProfesor(authResult.user.rut);
          const tieneAcceso = cursosProfesor.some(c => c.curso === curso && c.activo);

          if (!tieneAcceso) {
            return {
              statusCode: 403,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ error: `No tiene acceso al curso ${curso}` })
            };
          }
        } catch (error) {
          console.error('Error validando acceso al curso:', error);
        }
      }
      // Admin y fono tienen acceso a todos los cursos

      const recursosResult = await docClient.send(new ScanCommand({ TableName: RECURSOS_TABLE }));
      // Filtrar solo notas (evaluación conceptual con nivelLogro)
      let notas = recursosResult.Items.filter(r => r.tipo === 'nota');

      if (curso) notas = notas.filter(n => n.curso === curso);
      if (asignatura) notas = notas.filter(n => n.asignatura === asignatura);

      // Calcular estadísticas usando evaluación conceptual
      const estadisticas = calcularEstadisticasConceptuales(notas);

      // Convertir niveles a valores numéricos para cálculo de máximos/mínimos
      const valoresNumericos = notas
        .filter(n => n.nivelLogro && n.nivelLogro !== 'NT')
        .map(n => nivelANota(n.nivelLogro));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'notas',
          curso,
          asignatura,
          estadisticas: {
            promedioGeneral: estadisticas.promedio,
            notaMasAlta: valoresNumericos.length > 0 ? Math.max(...valoresNumericos) : 0,
            notaMasBaja: valoresNumericos.length > 0 ? Math.min(...valoresNumericos) : 0,
            totalEvaluaciones: notas.length,
            logrados: estadisticas.logrados,
            enDesarrollo: estadisticas.enDesarrollo,
            noLogrados: estadisticas.noLogrados,
            tasaLogro: estadisticas.tasaLogro
          },
          fechaGeneracion: new Date().toISOString()
        })
      };
    }

    // ========================================
    // POST /reportes/consolidado - Generar reporte consolidado
    // ========================================
    if (httpMethod === 'POST' && path === '/reportes/consolidado') {
      const data = JSON.parse(event.body);

      const reporteId = `reporte-${uuidv4()}`;
      const reporte = {
        id: reporteId,
        nombre: data.nombre,
        tipo: 'consolidado',
        estado: 'completado',
        fechaGeneracion: new Date().toISOString(),
        secciones: data.secciones || [],
        periodo: data.periodo
      };

      // Guardar en tabla de reportes
      await docClient.send(new PutCommand({
        TableName: REPORTES_TABLE,
        Item: reporte
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Reporte generado', id: reporteId, reporte })
      };
    }

    // ========================================
    // GET /reportes/indicadores - Indicadores de desempeño
    // ========================================
    if (httpMethod === 'GET' && path === '/reportes/indicadores') {
      const recursosResult = await docClient.send(new ScanCommand({ TableName: RECURSOS_TABLE }));
      const usuariosResult = await docClient.send(new ScanCommand({ TableName: USUARIOS_TABLE }));

      // Filtrar notas (evaluación conceptual)
      const notas = recursosResult.Items.filter(r => r.tipo === 'nota');
      const materiales = recursosResult.Items.filter(r => r.tipo === 'material');

      // Calcular promedio institucional usando evaluación conceptual
      const estadisticasInstitucionales = calcularEstadisticasConceptuales(notas);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'indicadores',
          indicadores: {
            academicos: {
              promedioGeneralInstitucion: estadisticasInstitucionales.promedio,
              tasaLogro: estadisticasInstitucionales.tasaLogro,
              totalEvaluaciones: estadisticasInstitucionales.total,
              distribucion: estadisticasInstitucionales.distribucion
            },
            operacionales: {
              profesoresActivos: usuariosResult.Items.filter(u => u.rol === 'profesor').length,
              materialesPublicados: materiales.filter(m => m.estado === 'aprobado').length
            }
          },
          fechaGeneracion: new Date().toISOString()
        })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ruta no soportada' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
