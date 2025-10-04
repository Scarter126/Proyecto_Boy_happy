const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { authorize } = require('/opt/nodejs/authMiddleware');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const ASISTENCIA_TABLE = process.env.ASISTENCIA_TABLE;
const RECURSOS_TABLE = process.env.RECURSOS_TABLE;
const USUARIOS_TABLE = process.env.USUARIOS_TABLE;

/**
 * CU-25: Exportar reportes en formatos CSV, XLSX y PDF
 *
 * Esta lambda genera archivos en Base64 para descarga directa desde el frontend
 * No requiere librerías externas adicionales - usa generación manual optimizada
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const authResult = authorize(event);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { httpMethod, resource, queryStringParameters } = event;

    // ========================================
    // GET /exportar/asistencia?formato=csv|xlsx|pdf
    // ========================================
    if (httpMethod === 'GET' && resource === '/exportar/asistencia') {
      const { curso, fechaInicio, fechaFin, formato = 'csv' } = queryStringParameters || {};

      if (!curso) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parámetro requerido: curso' })
        };
      }

      // Obtener datos
      const asistenciaResult = await docClient.send(new ScanCommand({ TableName: ASISTENCIA_TABLE }));
      let registros = asistenciaResult.Items.filter(r => r.curso === curso);

      if (fechaInicio && fechaFin) {
        registros = registros.filter(r => r.fecha >= fechaInicio && r.fecha <= fechaFin);
      }

      // Agrupar por alumno
      const porAlumno = {};
      registros.forEach(r => {
        if (!porAlumno[r.rutAlumno]) {
          porAlumno[r.rutAlumno] = {
            rut: r.rutAlumno,
            nombre: r.nombreAlumno || r.rutAlumno,
            presente: 0,
            ausente: 0,
            justificado: 0,
            atrasado: 0
          };
        }
        porAlumno[r.rutAlumno][r.estado]++;
      });

      const data = Object.values(porAlumno).map(a => ({
        ...a,
        total: a.presente + a.ausente + a.justificado + a.atrasado,
        porcentaje: a.presente > 0
          ? ((a.presente / (a.presente + a.ausente + a.justificado + a.atrasado)) * 100).toFixed(1)
          : '0.0'
      }));

      // Generar archivo según formato
      if (formato === 'csv') {
        return generarCSV(data, `reporte-asistencia-${curso}`, [
          'RUT',
          'Nombre',
          'Presente',
          'Ausente',
          'Justificado',
          'Atrasado',
          'Total Clases',
          'Asistencia %'
        ], row => [
          row.rut,
          row.nombre,
          row.presente,
          row.ausente,
          row.justificado,
          row.atrasado,
          row.total,
          row.porcentaje
        ]);
      } else if (formato === 'xlsx') {
        return generarXLSX(data, `reporte-asistencia-${curso}`, [
          'RUT',
          'Nombre',
          'Presente',
          'Ausente',
          'Justificado',
          'Atrasado',
          'Total',
          '%'
        ], row => [
          row.rut,
          row.nombre,
          row.presente,
          row.ausente,
          row.justificado,
          row.atrasado,
          row.total,
          row.porcentaje
        ]);
      } else if (formato === 'pdf') {
        return generarPDF(data, `Reporte de Asistencia - ${curso}`, [
          'RUT',
          'Nombre',
          'P',
          'A',
          'J',
          'At',
          '%'
        ], row => [
          row.rut,
          row.nombre,
          row.presente,
          row.ausente,
          row.justificado,
          row.atrasado,
          row.porcentaje
        ]);
      }
    }

    // ========================================
    // GET /exportar/notas?formato=csv|xlsx|pdf
    // ========================================
    if (httpMethod === 'GET' && resource === '/exportar/notas') {
      const { curso, asignatura, formato = 'csv' } = queryStringParameters || {};

      const recursosResult = await docClient.send(new ScanCommand({ TableName: RECURSOS_TABLE }));
      let notas = recursosResult.Items.filter(r => r.tipo === 'nota');

      if (curso) notas = notas.filter(n => n.curso === curso);
      if (asignatura) notas = notas.filter(n => n.asignatura === asignatura);

      const data = notas.map(n => ({
        rutAlumno: n.rutAlumno,
        curso: n.curso,
        asignatura: n.asignatura,
        evaluacion: n.nombreEvaluacion,
        nota: n.tipoEvaluacion === 'numerica' ? n.nota : n.evaluacionConceptual,
        fecha: n.fecha,
        profesor: n.profesor
      }));

      if (formato === 'csv') {
        return generarCSV(data, `reporte-notas-${curso || 'todos'}`, [
          'RUT Alumno',
          'Curso',
          'Asignatura',
          'Evaluación',
          'Nota',
          'Fecha',
          'Profesor'
        ], row => [
          row.rutAlumno,
          row.curso,
          row.asignatura,
          row.evaluacion,
          row.nota,
          row.fecha,
          row.profesor
        ]);
      } else if (formato === 'xlsx') {
        return generarXLSX(data, `reporte-notas`, [
          'RUT',
          'Curso',
          'Asignatura',
          'Evaluación',
          'Nota',
          'Fecha',
          'Profesor'
        ], row => [
          row.rutAlumno,
          row.curso,
          row.asignatura,
          row.evaluacion,
          row.nota,
          row.fecha,
          row.profesor
        ]);
      }
    }

    // ========================================
    // GET /exportar/cumplimiento?formato=csv|xlsx|pdf
    // ========================================
    if (httpMethod === 'GET' && resource === '/exportar/cumplimiento') {
      const { formato = 'csv' } = queryStringParameters || {};

      const usuariosResult = await docClient.send(new ScanCommand({ TableName: USUARIOS_TABLE }));
      const profesores = usuariosResult.Items.filter(u => u.rol === 'profesor');

      const recursosResult = await docClient.send(new ScanCommand({ TableName: RECURSOS_TABLE }));
      const materiales = recursosResult.Items.filter(r => r.tipo === 'material');
      const notas = recursosResult.Items.filter(r => r.tipo === 'nota');

      const data = profesores.map(p => {
        const materialesProf = materiales.filter(m => m.profesor === p.rut);
        const notasProf = notas.filter(n => n.profesor === p.rut);

        return {
          rut: p.rut,
          nombre: p.nombre,
          materialesSubidos: materialesProf.length,
          materialesAprobados: materialesProf.filter(m => m.estado === 'aprobado').length,
          notasIngresadas: notasProf.length
        };
      });

      if (formato === 'csv') {
        return generarCSV(data, `cumplimiento-docente`, [
          'RUT',
          'Nombre',
          'Materiales Subidos',
          'Materiales Aprobados',
          'Notas Ingresadas'
        ], row => [
          row.rut,
          row.nombre,
          row.materialesSubidos,
          row.materialesAprobados,
          row.notasIngresadas
        ]);
      }
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

/**
 * Generar CSV
 */
function generarCSV(data, filename, headers, mapRow) {
  const rows = [headers.join(',')];
  data.forEach(item => {
    const valores = mapRow(item).map(v => `"${v}"`);
    rows.push(valores.join(','));
  });

  const csvContent = rows.join('\n');
  const base64 = Buffer.from(csvContent, 'utf-8').toString('base64');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`
    },
    body: JSON.stringify({
      filename: `${filename}.csv`,
      content: base64,
      mimeType: 'text/csv'
    })
  };
}

/**
 * Generar XLSX simple (formato XML compatible con Excel)
 */
function generarXLSX(data, filename, headers, mapRow) {
  const rows = data.map(item => {
    const cells = mapRow(item).map(v => `<Cell><Data ss:Type="String">${escapeXML(v)}</Data></Cell>`).join('');
    return `<Row>${cells}</Row>`;
  });

  const headerRow = `<Row>${headers.map(h => `<Cell><Data ss:Type="String"><b>${h}</b></Data></Cell>`).join('')}</Row>`;

  const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Datos">
<Table>
${headerRow}
${rows.join('\n')}
</Table>
</Worksheet>
</Workbook>`;

  const base64 = Buffer.from(xml, 'utf-8').toString('base64');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': `attachment; filename="${filename}.xls"`
    },
    body: JSON.stringify({
      filename: `${filename}.xls`,
      content: base64,
      mimeType: 'application/vnd.ms-excel'
    })
  };
}

/**
 * Generar PDF simple (texto plano formateado)
 */
function generarPDF(data, titulo, headers, mapRow) {
  const lines = [
    titulo,
    '='.repeat(80),
    '',
    headers.join(' | '),
    '-'.repeat(80)
  ];

  data.forEach(item => {
    lines.push(mapRow(item).join(' | '));
  });

  lines.push('');
  lines.push(`Generado: ${new Date().toLocaleString('es-CL')}`);

  const content = lines.join('\n');
  const base64 = Buffer.from(content, 'utf-8').toString('base64');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${titulo.replace(/\s+/g, '-')}.txt"`
    },
    body: JSON.stringify({
      filename: `${titulo.replace(/\s+/g, '-')}.txt`,
      content: base64,
      mimeType: 'text/plain'
    })
  };
}

function escapeXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
