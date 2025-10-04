// ==============================================
// UTILIDADES DE EXPORTACIÓN (CU-25, CU-18)
// ==============================================

/**
 * Exportar tabla HTML a CSV
 * @param {string} tableId - ID de la tabla HTML a exportar
 * @param {string} filename - Nombre del archivo (sin extensión)
 */
function exportToCSV(tableId, filename = 'export') {
  const table = document.getElementById(tableId);
  if (!table) {
    alert('❌ No se encontró la tabla para exportar');
    return;
  }

  let csv = [];
  const rows = table.querySelectorAll('tr');

  rows.forEach(row => {
    const cols = row.querySelectorAll('td, th');
    const csvRow = [];

    cols.forEach(col => {
      // Limpiar el texto de caracteres especiales y comillas
      let text = col.innerText.replace(/"/g, '""');
      csvRow.push(`"${text}"`);
    });

    csv.push(csvRow.join(','));
  });

  const csvString = csv.join('\n');
  const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Exportar datos JSON a Excel (XLSX)
 * @param {Array} data - Array de objetos con los datos
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @param {string} sheetName - Nombre de la hoja
 */
function exportToExcel(data, filename = 'export', sheetName = 'Datos') {
  if (!window.XLSX) {
    alert('❌ La librería XLSX no está cargada. Agrega el script en el HTML.');
    return;
  }

  if (!data || data.length === 0) {
    alert('⚠️ No hay datos para exportar');
    return;
  }

  // Crear workbook y worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generar archivo
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Exportar tabla HTML a Excel
 * @param {string} tableId - ID de la tabla HTML
 * @param {string} filename - Nombre del archivo (sin extensión)
 */
function exportTableToExcel(tableId, filename = 'export') {
  if (!window.XLSX) {
    alert('❌ La librería XLSX no está cargada. Agrega el script en el HTML.');
    return;
  }

  const table = document.getElementById(tableId);
  if (!table) {
    alert('❌ No se encontró la tabla para exportar');
    return;
  }

  const wb = XLSX.utils.table_to_book(table, { sheet: 'Datos' });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Exportar a PDF usando jsPDF
 * @param {string} elementId - ID del elemento HTML a convertir
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @param {Object} options - Opciones de configuración
 */
function exportToPDF(elementId, filename = 'export', options = {}) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('❌ La librería jsPDF no está cargada. Agrega el script en el HTML.');
    return;
  }

  const element = document.getElementById(elementId);
  if (!element) {
    alert('❌ No se encontró el elemento para exportar');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: options.orientation || 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Configuración
  const title = options.title || 'Reporte';
  const subtitle = options.subtitle || '';

  // Encabezado
  doc.setFontSize(18);
  doc.text(title, 14, 22);

  if (subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 30);
  }

  // Línea separadora
  doc.setDrawColor(200);
  doc.line(14, 35, 196, 35);

  // Contenido
  if (window.html2canvas) {
    // Usar html2canvas si está disponible (mejor resultado)
    html2canvas(element, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 180;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      doc.addImage(imgData, 'PNG', 14, 40, imgWidth, imgHeight);
      doc.save(`${filename}.pdf`);
    });
  } else {
    // Fallback: usar autoTable si hay una tabla
    const table = element.querySelector('table');
    if (table && window.jspdf.autoTable) {
      doc.autoTable({
        html: table,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [74, 144, 226] }
      });
      doc.save(`${filename}.pdf`);
    } else {
      // Último recurso: texto plano
      const text = element.innerText;
      const lines = doc.splitTextToSize(text, 180);
      doc.text(lines, 14, 40);
      doc.save(`${filename}.pdf`);
    }
  }
}

/**
 * Exportar tabla HTML a PDF con autoTable
 * @param {string} tableId - ID de la tabla HTML
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @param {Object} options - Opciones de configuración
 */
function exportTableToPDF(tableId, filename = 'export', options = {}) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('❌ La librería jsPDF no está cargada. Agrega el script en el HTML.');
    return;
  }

  const table = document.getElementById(tableId);
  if (!table) {
    alert('❌ No se encontró la tabla para exportar');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: options.orientation || 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Encabezado
  const title = options.title || 'Reporte';
  const subtitle = options.subtitle || new Date().toLocaleDateString('es-CL');

  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 14, 22);

  // Tabla
  if (window.jspdf.autoTable) {
    doc.autoTable({
      html: table,
      startY: 28,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        halign: 'left'
      },
      headStyles: {
        fillColor: [74, 144, 226],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { top: 28, left: 14, right: 14 }
    });
  } else {
    alert('⚠️ autoTable no está disponible. Instala jspdf-autotable.');
    return;
  }

  doc.save(`${filename}.pdf`);
}

/**
 * Crear archivo de datos JSON y descargarlo
 * @param {Array|Object} data - Datos a exportar
 * @param {string} filename - Nombre del archivo (sin extensión)
 */
function exportToJSON(data, filename = 'export') {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Función auxiliar para descargar un Blob
 * @param {Blob} blob - Blob a descargar
 * @param {string} filename - Nombre del archivo
 */
function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Generar nombre de archivo con fecha y hora
 * @param {string} prefix - Prefijo del nombre
 * @returns {string} - Nombre de archivo con timestamp
 */
function getTimestampedFilename(prefix = 'export') {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `${prefix}_${dateStr}_${timeStr}`;
}

/**
 * Exportar asistencia con formato específico
 * @param {Array} registros - Registros de asistencia
 * @param {Object} filtros - Filtros aplicados
 */
function exportarAsistencia(registros, filtros = {}) {
  const filename = getTimestampedFilename('asistencia');

  // Preparar datos para Excel
  const data = registros.map(r => ({
    'Alumno': r.nombreAlumno || 'N/A',
    'RUT': r.rutAlumno || 'N/A',
    'Curso': r.curso || 'N/A',
    'Fecha': r.fecha || 'N/A',
    'Estado': r.estado || 'N/A',
    'Observación': r.observacion || ''
  }));

  // Mostrar opciones
  const formato = confirm('¿Exportar a Excel?\n\nOK = Excel\nCancelar = CSV');

  if (formato) {
    exportToExcel(data, filename, 'Asistencia');
  } else {
    // Convertir a CSV manualmente
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';
    data.forEach(row => {
      const values = headers.map(h => `"${row[h]}"`);
      csv += values.join(',') + '\n';
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);
  }
}

/**
 * Exportar evaluaciones/notas
 * @param {Array} evaluaciones - Evaluaciones a exportar
 */
function exportarEvaluaciones(evaluaciones) {
  const filename = getTimestampedFilename('evaluaciones');

  const data = evaluaciones.map(ev => ({
    'Alumno': ev.nombreAlumno || 'N/A',
    'RUT': ev.rutAlumno || 'N/A',
    'Curso': ev.curso || 'N/A',
    'Asignatura': ev.asignatura || ev.ambito || 'N/A',
    'Objetivo': ev.objetivoAprendizaje || 'N/A',
    'Nivel de Logro': ev.nivelLogro || 'N/A',
    'Fecha': ev.fecha || 'N/A',
    'Observación': ev.observacion || ''
  }));

  const formato = prompt('Formato de exportación:\n1 = Excel\n2 = CSV\n3 = PDF', '1');

  switch(formato) {
    case '1':
      exportToExcel(data, filename, 'Evaluaciones');
      break;
    case '2':
      const headers = Object.keys(data[0]);
      let csv = headers.join(',') + '\n';
      data.forEach(row => {
        const values = headers.map(h => `"${row[h]}"`);
        csv += values.join(',') + '\n';
      });
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `${filename}.csv`);
      break;
    case '3':
      alert('Para PDF, usa la función de imprimir del navegador (Ctrl+P)');
      window.print();
      break;
    default:
      alert('Exportación cancelada');
  }
}

/**
 * Exportar materiales pedagógicos
 * @param {Array} materiales - Lista de materiales
 */
function exportarMateriales(materiales) {
  const filename = getTimestampedFilename('materiales');

  const data = materiales.map(m => ({
    'Título': m.titulo || 'N/A',
    'Curso': m.curso || 'N/A',
    'Asignatura': m.asignatura || 'N/A',
    'Unidad': m.unidad || 'N/A',
    'Profesor': m.profesor || 'N/A',
    'Archivo': m.nombreArchivo || 'N/A',
    'Fecha Subida': new Date(m.fechaSubida).toLocaleDateString('es-CL') || 'N/A',
    'Estado': m.estado || 'N/A'
  }));

  exportToExcel(data, filename, 'Materiales');
}

/**
 * Exportar retroalimentación
 * @param {Array} retroalimentacion - Registros de retroalimentación
 */
function exportarRetroalimentacion(retroalimentacion) {
  const filename = getTimestampedFilename('retroalimentacion');

  const data = retroalimentacion.map(r => ({
    'Usuario': r.nombreUsuario || 'N/A',
    'RUT': r.rutUsuario || 'N/A',
    'Tipo': r.tipo || 'N/A',
    'Contenido': r.contenido || 'N/A',
    'Ámbito': r.ambito || 'N/A',
    'Curso': r.curso || 'N/A',
    'Fecha': new Date(r.fecha || r.timestamp).toLocaleDateString('es-CL'),
    'Creado Por': r.creadoPor || 'N/A',
    'Visibilidad': r.visibilidad || 'N/A'
  }));

  exportToExcel(data, filename, 'Retroalimentación');
}

/**
 * Botón de exportación genérico
 * @param {string} containerId - ID del contenedor donde insertar botones
 * @param {Function} onExport - Callback que recibe el formato seleccionado
 */
function addExportButtons(containerId, onExport) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const buttonsHTML = `
    <div class="export-buttons" style="display: flex; gap: 10px; margin: 15px 0; flex-wrap: wrap;">
      <button class="btn btn-sm btn-success" onclick="handleExport('csv')">
        <i class="fas fa-file-csv"></i> Exportar CSV
      </button>
      <button class="btn btn-sm btn-success" onclick="handleExport('excel')">
        <i class="fas fa-file-excel"></i> Exportar Excel
      </button>
      <button class="btn btn-sm btn-danger" onclick="handleExport('pdf')">
        <i class="fas fa-file-pdf"></i> Exportar PDF
      </button>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', buttonsHTML);

  // Definir handler global
  window.handleExport = (format) => {
    if (onExport && typeof onExport === 'function') {
      onExport(format);
    }
  };
}

// Hacer funciones globales
window.exportToCSV = exportToCSV;
window.exportToExcel = exportToExcel;
window.exportTableToExcel = exportTableToExcel;
window.exportToPDF = exportToPDF;
window.exportTableToPDF = exportTableToPDF;
window.exportToJSON = exportToJSON;
window.exportarAsistencia = exportarAsistencia;
window.exportarEvaluaciones = exportarEvaluaciones;
window.exportarMateriales = exportarMateriales;
window.exportarRetroalimentacion = exportarRetroalimentacion;
window.addExportButtons = addExportButtons;
window.getTimestampedFilename = getTimestampedFilename;
