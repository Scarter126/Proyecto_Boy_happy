/**
 * Reportes - Report Generation for Teachers
 *
 * Features:
 * - Generate various reports (student performance, class statistics, attendance)
 * - Filters: report type, class/course, date range, subject
 * - Report types: performance summary, grade reports, progress reports, attendance reports
 * - Export reports (PDF, CSV, Excel)
 * - View historical reports
 * - Report templates
 */

import { useState, useMemo } from 'react';
import { useReportes, useGenerateReporte } from '../../hooks/useReportes';
import { useNotas } from '../../hooks/useNotas';
import { useAsistencia } from '../../hooks/useAsistencia';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import { useCursos } from '../../hooks/useConfiguracion';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre } from '../../utils/helpers';
import { calcularPromedioConceptual, calcularEstadisticasConceptuales } from '../../utils/evaluacionHelper';
import Swal from 'sweetalert2';

const TIPOS_REPORTE = [
  { value: 'rendimiento', label: 'Rendimiento Académico', icon: 'fa-chart-line', color: '#667eea' },
  { value: 'calificaciones', label: 'Reporte de Calificaciones', icon: 'fa-clipboard-list', color: '#48bb78' },
  { value: 'asistencia', label: 'Reporte de Asistencia', icon: 'fa-calendar-check', color: '#ed8936' },
  { value: 'progreso', label: 'Progreso Estudiantil', icon: 'fa-chart-bar', color: '#9f7aea' },
  { value: 'estadisticas', label: 'Estadísticas del Curso', icon: 'fa-chart-pie', color: '#ecc94b' }
];

const ASIGNATURAS = [
  { value: 'matematicas', label: 'Matemáticas' },
  { value: 'lenguaje', label: 'Lenguaje y Comunicación' },
  { value: 'ciencias', label: 'Ciencias Naturales' },
  { value: 'historia', label: 'Historia y Geografía' },
  { value: 'arte', label: 'Artes' },
  { value: 'musica', label: 'Música' },
  { value: 'educacion-fisica', label: 'Educación Física' }
];

const FORMATOS_EXPORT = [
  { value: 'csv', label: 'CSV', icon: 'fa-file-csv' },
  { value: 'pdf', label: 'PDF', icon: 'fa-file-pdf' },
  { value: 'excel', label: 'Excel', icon: 'fa-file-excel' }
];

function Reportes() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [tipoReporte, setTipoReporte] = useState('rendimiento');
  const [cursoFilter, setCursoFilter] = useState('');
  const [asignaturaFilter, setAsignaturaFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formatoExport, setFormatoExport] = useState('csv');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [reportePreview, setReportePreview] = useState(null);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: reportesHistoricos = [], isLoading: isLoadingReportes, refetch } = useReportes();
  const { data: notas = [] } = useNotas();
  const { data: asistencia = [] } = useAsistencia();
  const { data: alumnos = [] } = useUsuariosPorRol('alumno');
  const { data: cursosConfig = [], isLoading: loadingCursos } = useCursos();
  const generateMutation = useGenerateReporte();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const stats = useMemo(() => {
    const totalReportes = reportesHistoricos.length;
    const reportesPorTipo = reportesHistoricos.reduce((acc, reporte) => {
      acc[reporte.tipo] = (acc[reporte.tipo] || 0) + 1;
      return acc;
    }, {});

    const ultimoMes = new Date();
    ultimoMes.setMonth(ultimoMes.getMonth() - 1);
    const reportesRecientes = reportesHistoricos.filter(r =>
      new Date(r.fecha) >= ultimoMes
    ).length;

    return {
      totalReportes,
      reportesPorTipo,
      reportesRecientes
    };
  }, [reportesHistoricos]);

  // Generate report data based on filters
  const generateReportData = () => {
    let alumnosFiltrados = alumnos;
    if (cursoFilter) {
      alumnosFiltrados = alumnosFiltrados.filter(a => a.curso === cursoFilter);
    }

    const data = alumnosFiltrados.map(alumno => {
      let notasAlumno = notas.filter(n => n.rutAlumno === alumno.rut);
      let asistenciaAlumno = asistencia.filter(a => a.rutAlumno === alumno.rut);

      // Apply filters
      if (asignaturaFilter) {
        notasAlumno = notasAlumno.filter(n => n.asignatura === asignaturaFilter);
      }

      if (dateFrom) {
        notasAlumno = notasAlumno.filter(n => n.fecha >= dateFrom);
        asistenciaAlumno = asistenciaAlumno.filter(a => a.fecha >= dateFrom);
      }

      if (dateTo) {
        notasAlumno = notasAlumno.filter(n => n.fecha <= dateTo);
        asistenciaAlumno = asistenciaAlumno.filter(a => a.fecha <= dateTo);
      }

      // Calcular promedio usando evaluación conceptual (nivelLogro)
      const promedio = notasAlumno.length > 0
        ? calcularPromedioConceptual(notasAlumno)
        : 'N/A';

      const porcentajeAsistencia = asistenciaAlumno.length > 0
        ? ((asistenciaAlumno.filter(a => a.estado === 'presente').length / asistenciaAlumno.length) * 100).toFixed(0)
        : 'N/A';

      return {
        alumno,
        promedio,
        porcentajeAsistencia,
        totalNotas: notasAlumno.length,
        totalAsistencias: asistenciaAlumno.length,
        notas: notasAlumno,
        asistencias: asistenciaAlumno
      };
    });

    return data;
  };

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleGenerateReport = () => {
    if (!cursoFilter) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Debes seleccionar un curso para generar el reporte'
      });
      return;
    }

    const reportData = generateReportData();

    if (reportData.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin datos',
        text: 'No hay datos disponibles para generar el reporte con los filtros seleccionados'
      });
      return;
    }

    setReportePreview({
      tipo: tipoReporte,
      curso: cursoFilter,
      asignatura: asignaturaFilter,
      dateFrom,
      dateTo,
      data: reportData,
      fecha: new Date().toISOString()
    });
    setIsPreviewModalOpen(true);
  };

  const handleExportReport = () => {
    if (!reportePreview) return;

    const tipoConfig = TIPOS_REPORTE.find(t => t.value === reportePreview.tipo);
    const curso = cursosConfig.find(c => c.codigo === reportePreview.curso);

    if (formatoExport === 'csv') {
      let csv = '';

      if (reportePreview.tipo === 'rendimiento' || reportePreview.tipo === 'progreso') {
        csv = [
          ['Alumno', 'RUT', 'Curso', 'Promedio', 'Total Notas'].join(','),
          ...reportePreview.data.map(item => [
            `"${formatNombre(item.alumno)}"`,
            item.alumno.rut,
            curso?.label || reportePreview.curso,
            item.promedio,
            item.totalNotas
          ].join(','))
        ].join('\n');
      } else if (reportePreview.tipo === 'calificaciones') {
        csv = [
          ['Alumno', 'RUT', 'Fecha', 'Asignatura', 'Tipo', 'Nota'].join(','),
          ...reportePreview.data.flatMap(item =>
            item.notas.map(nota => [
              `"${formatNombre(item.alumno)}"`,
              item.alumno.rut,
              nota.fecha,
              nota.asignatura,
              nota.tipo,
              nota.nota
            ].join(','))
          )
        ].join('\n');
      } else if (reportePreview.tipo === 'asistencia') {
        csv = [
          ['Alumno', 'RUT', 'Curso', 'Asistencia %', 'Total Registros'].join(','),
          ...reportePreview.data.map(item => [
            `"${formatNombre(item.alumno)}"`,
            item.alumno.rut,
            curso?.label || reportePreview.curso,
            item.porcentajeAsistencia,
            item.totalAsistencias
          ].join(','))
        ].join('\n');
      } else if (reportePreview.tipo === 'estadisticas') {
        const promedios = reportePreview.data.map(d => parseFloat(d.promedio)).filter(p => !isNaN(p));
        const promedioGeneral = promedios.length > 0
          ? (promedios.reduce((a, b) => a + b, 0) / promedios.length).toFixed(1)
          : 'N/A';

        csv = [
          ['Estadística', 'Valor'].join(','),
          ['Total Alumnos', reportePreview.data.length].join(','),
          ['Promedio General', promedioGeneral].join(','),
          ['Alumnos con Promedio >= 4.0', promedios.filter(p => p >= 4.0).length].join(','),
          ['Alumnos con Promedio < 4.0', promedios.filter(p => p < 4.0).length].join(',')
        ].join('\n');
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `reporte_${reportePreview.tipo}_${reportePreview.curso}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      Swal.fire({
        icon: 'success',
        title: 'Exportado',
        text: `Reporte exportado como ${formatoExport.toUpperCase()}`,
        timer: 2000
      });
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Función no disponible',
        text: `La exportación en formato ${formatoExport.toUpperCase()} estará disponible próximamente`
      });
    }
  };

  const handleSaveReport = async () => {
    try {
      await generateMutation.mutateAsync({
        tipo: reportePreview.tipo,
        curso: reportePreview.curso,
        asignatura: reportePreview.asignatura,
        dateFrom: reportePreview.dateFrom,
        dateTo: reportePreview.dateTo,
        data: reportePreview.data
      });

      Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: 'El reporte ha sido guardado en el historial',
        timer: 2000
      });

      refetch();
    } catch (error) {
      console.error('Error saving report:', error);
    }
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { tipoReporte, cursoFilter, asignaturaFilter, dateFrom, dateTo });
  };

  const handleClearFilters = () => {
    setTipoReporte('rendimiento');
    setCursoFilter('');
    setAsignaturaFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Generación de Reportes"
        icon="fa-file-alt"
        subtitle="Crea y exporta reportes académicos personalizados"
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="card-content">
            <h3>{stats.totalReportes}</h3>
            <p>Total Reportes</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="card-content">
            <h3>{stats.reportesRecientes}</h3>
            <p>Último Mes</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="card-content">
            <h3>{stats.reportesPorTipo.rendimiento || 0}</h3>
            <p>Rendimiento</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="card-content">
            <h3>{stats.reportesPorTipo.asistencia || 0}</h3>
            <p>Asistencia</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Report Configuration */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>
          <i className="fas fa-cog"></i> Configuración del Reporte
        </h3>

        <div className="form-row">
          <div className="form-group" style={{ flex: '1 1 100%' }}>
            <label htmlFor="tipoReporte">
              <i className="fas fa-clipboard-list"></i> Tipo de Reporte <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <select
              id="tipoReporte"
              value={tipoReporte}
              onChange={(e) => setTipoReporte(e.target.value)}
              style={{ fontSize: '1em', padding: '12px' }}
            >
              {TIPOS_REPORTE.map(tipo => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="cursoFilter">
              <i className="fas fa-school"></i> Curso <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <select
              id="cursoFilter"
              value={cursoFilter}
              onChange={(e) => setCursoFilter(e.target.value)}
            >
              <option value="">{loadingCursos ? 'Cargando cursos...' : 'Seleccionar curso'}</option>
              {cursosConfig.map((curso) => (
                <option key={curso.codigo} value={curso.nombre}>
                  {curso.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="asignaturaFilter">
              <i className="fas fa-book"></i> Asignatura
            </label>
            <select
              id="asignaturaFilter"
              value={asignaturaFilter}
              onChange={(e) => setAsignaturaFilter(e.target.value)}
            >
              <option value="">Todas las asignaturas</option>
              {ASIGNATURAS.map(asignatura => (
                <option key={asignatura.value} value={asignatura.value}>{asignatura.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ flex: '1 1 50%' }}>
            <label htmlFor="dateFrom">
              <i className="fas fa-calendar-alt"></i> Fecha Desde
            </label>
            <input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ flex: '1 1 50%' }}>
            <label htmlFor="dateTo">
              <i className="fas fa-calendar-alt"></i> Fecha Hasta
            </label>
            <input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ flex: '1 1 100%' }}>
            <label htmlFor="formatoExport">
              <i className="fas fa-file-download"></i> Formato de Exportación
            </label>
            <select
              id="formatoExport"
              value={formatoExport}
              onChange={(e) => setFormatoExport(e.target.value)}
            >
              {FORMATOS_EXPORT.map(formato => (
                <option key={formato.value} value={formato.value}>
                  {formato.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            onClick={handleClearFilters}
          >
            <i className="fas fa-times"></i>
            <span>Limpiar</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={handleGenerateReport}
            disabled={!cursoFilter}
          >
            <i className="fas fa-file-alt"></i>
            <span>Generar Reporte</span>
          </button>
        </div>
      </div>

      {/* Report Types Info */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>
          <i className="fas fa-info-circle"></i> Tipos de Reportes Disponibles
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          {TIPOS_REPORTE.map(tipo => (
            <div
              key={tipo.value}
              style={{
                padding: '15px',
                backgroundColor: tipoReporte === tipo.value ? `${tipo.color}15` : '#f9fafb',
                borderRadius: '8px',
                border: tipoReporte === tipo.value ? `2px solid ${tipo.color}` : '1px solid #e5e7eb',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => setTipoReporte(tipo.value)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i
                  className={`fas ${tipo.icon}`}
                  style={{ fontSize: '24px', color: tipo.color }}
                ></i>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>{tipo.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Reports */}
      <div className="card">
        <h3 style={{ marginBottom: '15px' }}>
          <i className="fas fa-history"></i> Historial de Reportes
        </h3>

        {isLoadingReportes && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ color: '#667eea' }}></i>
            <p style={{ marginTop: '15px', color: '#666' }}>Cargando historial...</p>
          </div>
        )}

        {!isLoadingReportes && reportesHistoricos.length === 0 && (
          <EmptyStateCard
            icon="fa-file-alt"
            title="No hay reportes en el historial"
            description="Los reportes que generes aparecerán aquí"
            iconColor="#667eea"
          />
        )}

        {!isLoadingReportes && reportesHistoricos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reportesHistoricos.slice(0, 10).map((reporte, index) => {
              const tipoConfig = TIPOS_REPORTE.find(t => t.value === reporte.tipo);
              return (
                <div
                  key={index}
                  style={{
                    padding: '15px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <i
                      className={`fas ${tipoConfig?.icon || 'fa-file'}`}
                      style={{ fontSize: '24px', color: tipoConfig?.color || '#667eea' }}
                    ></i>
                    <div>
                      <strong>{tipoConfig?.label || reporte.tipo}</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: '#6b7280' }}>
                        {cursosConfig.find(c => c.codigo === reporte.curso)?.nombre || reporte.curso} - {formatDate(reporte.fecha)}
                      </p>
                    </div>
                  </div>
                  <button className="btn btn-secondary" style={{ minWidth: 'auto' }}>
                    <i className="fas fa-download"></i>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      {isPreviewModalOpen && reportePreview && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setIsPreviewModalOpen(false)}
        >
          <div
            className="modal-content card"
            style={{
              maxWidth: '1000px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <div>
                <h2 style={{ margin: 0 }}>
                  <i className="fas fa-file-alt"></i> Vista Previa del Reporte
                </h2>
                <p style={{ margin: '5px 0 0', color: '#6b7280', fontSize: '0.9em' }}>
                  {TIPOS_REPORTE.find(t => t.value === reportePreview.tipo)?.label} - {cursosConfig.find(c => c.codigo === reportePreview.curso)?.nombre}
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setIsPreviewModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Report Summary */}
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <h3 style={{ marginBottom: '10px' }}>Resumen</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>Total Alumnos</label>
                  <p style={{ margin: '4px 0 0', fontSize: '1.2em', fontWeight: 'bold' }}>{reportePreview.data.length}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>Promedio General</label>
                  <p style={{ margin: '4px 0 0', fontSize: '1.2em', fontWeight: 'bold' }}>
                    {reportePreview.data.length > 0
                      ? (reportePreview.data.reduce((sum, d) => sum + (parseFloat(d.promedio) || 0), 0) / reportePreview.data.length).toFixed(1)
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>Fecha Generación</label>
                  <p style={{ margin: '4px 0 0', fontSize: '1.2em', fontWeight: 'bold' }}>{formatDate(reportePreview.fecha)}</p>
                </div>
              </div>
            </div>

            {/* Report Data Table */}
            <div style={{ marginBottom: '20px', maxHeight: '400px', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Alumno</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>RUT</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Promedio</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Asistencia</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Total Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {reportePreview.data.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px' }}>{formatNombre(item.alumno)}</td>
                      <td style={{ padding: '10px' }}>{item.alumno.rut}</td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: item.promedio !== 'N/A' && parseFloat(item.promedio) >= 4.0 ? '#48bb78' : '#e53e3e' }}>
                        {item.promedio}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{item.porcentajeAsistencia}%</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{item.totalNotas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsPreviewModalOpen(false)}
              >
                <i className="fas fa-times"></i>
                <span>Cerrar</span>
              </button>
              <button
                className="btn btn-success"
                onClick={handleSaveReport}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-save"></i>
                )}
                <span>Guardar</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExportReport}
              >
                <i className="fas fa-download"></i>
                <span>Exportar {formatoExport.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reportes;
