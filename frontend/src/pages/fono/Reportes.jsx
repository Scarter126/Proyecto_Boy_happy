/**
 * Reportes - Reports Generation for Speech Therapists
 *
 * Features:
 * - Generate various reports (progress, statistics, summaries)
 * - Filter by report type, date range, student
 * - Export reports (PDF, CSV)
 * - Report templates
 * - View historical reports
 */

import { useState, useMemo } from 'react';
import { useReportes, useGenerateReporte } from '../../hooks/useReportes';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre } from '../../utils/helpers';
import Swal from 'sweetalert2';

const TIPOS_REPORTE = [
  { value: 'progreso', label: 'Informe de Progreso', icon: 'fa-chart-line', color: '#48bb78' },
  { value: 'evaluacion', label: 'Reporte de Evaluacion', icon: 'fa-clipboard-check', color: '#667eea' },
  { value: 'sesiones', label: 'Resumen de Sesiones', icon: 'fa-calendar', color: '#9f7aea' },
  { value: 'asistencia', label: 'Reporte de Asistencia', icon: 'fa-user-check', color: '#ed8936' },
  { value: 'estadistico', label: 'Reporte Estadistico', icon: 'fa-chart-bar', color: '#10b981' }
];

const FORMATOS_EXPORTACION = [
  { value: 'pdf', label: 'PDF', icon: 'fa-file-pdf' },
  { value: 'csv', label: 'CSV', icon: 'fa-file-csv' },
  { value: 'docx', label: 'Word', icon: 'fa-file-word' }
];

function Reportes() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [tipoReporteFilter, setTipoReporteFilter] = useState('');
  const [alumnoFilter, setAlumnoFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    tipo: 'progreso',
    alumno_id: '',
    fecha_inicio: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    incluir_evaluaciones: true,
    incluir_asistencia: true,
    incluir_sesiones: true,
    observaciones: '',
    formato: 'pdf'
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const reportesFilters = useMemo(() => {
    const filters = {};

    if (tipoReporteFilter) filters.tipo = tipoReporteFilter;
    if (alumnoFilter) filters.alumno_id = alumnoFilter;
    if (dateFrom) filters.fechaDesde = dateFrom;
    if (dateTo) filters.fechaHasta = dateTo;

    return filters;
  }, [tipoReporteFilter, alumnoFilter, dateFrom, dateTo]);

  const { data: reportes = [], isLoading, isError, error, refetch } = useReportes(reportesFilters);
  const { data: alumnos = [] } = useUsuariosPorRol('alumno');
  const generateReporteMutation = useGenerateReporte();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const stats = useMemo(() => {
    if (!Array.isArray(reportes)) return { total: 0, porTipo: {}, ultimoMes: 0 };

    const porTipo = reportes.reduce((acc, reporte) => {
      acc[reporte.tipo] = (acc[reporte.tipo] || 0) + 1;
      return acc;
    }, {});

    const haceUnMes = new Date();
    haceUnMes.setMonth(haceUnMes.getMonth() - 1);
    const ultimoMes = reportes.filter(r => new Date(r.fecha || r.createdAt) >= haceUnMes).length;

    return {
      total: reportes.length,
      porTipo,
      ultimoMes
    };
  }, [reportes]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleGenerarReporte = () => {
    setFormData({
      tipo: 'progreso',
      alumno_id: '',
      fecha_inicio: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
      fecha_fin: new Date().toISOString().split('T')[0],
      incluir_evaluaciones: true,
      incluir_asistencia: true,
      incluir_sesiones: true,
      observaciones: '',
      formato: 'pdf'
    });
    setIsGenerateModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmitGenerate = async (e) => {
    e.preventDefault();

    try {
      const reportData = await generateReporteMutation.mutateAsync(formData);

      Swal.fire({
        icon: 'success',
        title: 'Reporte Generado',
        text: 'El reporte se ha generado correctamente',
        timer: 2000
      });

      setIsGenerateModalOpen(false);
      refetch();
    } catch (error) {
      console.error('Error generating report:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo generar el reporte'
      });
    }
  };

  const handleVerReporte = (reporte) => {
    const tipoInfo = TIPOS_REPORTE.find(t => t.value === reporte.tipo);
    const alumno = alumnos.find(a => a.rut === reporte.alumno_id) || {};

    Swal.fire({
      title: tipoInfo?.label || reporte.tipo,
      html: `
        <div style="text-align: left;">
          <p><strong>Alumno:</strong> ${formatNombre(alumno)}</p>
          <p><strong>Periodo:</strong> ${formatDate(reporte.fecha_inicio)} - ${formatDate(reporte.fecha_fin)}</p>
          <p><strong>Fecha Generacion:</strong> ${formatDate(reporte.createdAt || reporte.fecha)}</p>
          ${reporte.observaciones ? `<p><strong>Observaciones:</strong> ${reporte.observaciones}</p>` : ''}
          ${reporte.url ? `<p><a href="${reporte.url}" target="_blank" style="color: #667eea;">Descargar Reporte</a></p>` : ''}
        </div>
      `,
      width: 600,
      confirmButtonText: 'Cerrar',
      showCancelButton: true,
      cancelButtonText: 'Descargar PDF',
      cancelButtonColor: '#48bb78'
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.cancel) {
        handleExportarReporte(reporte, 'pdf');
      }
    });
  };

  const handleExportarReporte = async (reporte, formato) => {
    try {
      // TODO: Implement actual export functionality with backend
      Swal.fire({
        icon: 'info',
        title: 'Exportando',
        text: `Funcionalidad de exportación en formato ${formato.toUpperCase()} próximamente disponible`,
        timer: 2000
      });
    } catch (error) {
      console.error('Error exporting report:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo exportar el reporte'
      });
    }
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { tipoReporteFilter, alumnoFilter, dateFrom, dateTo });
  };

  const handleClearFilters = () => {
    setTipoReporteFilter('');
    setAlumnoFilter('');
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
        title="Reportes Fonoaudiologicos"
        icon="fa-file-alt"
        buttonText="Generar Reporte"
        buttonIcon="fa-plus"
        buttonColor="primary"
        onButtonClick={handleGenerarReporte}
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Reportes</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.progreso || 0}</h3>
            <p>Informes de Progreso</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clipboard-check"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.evaluacion || 0}</h3>
            <p>Reportes Evaluacion</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="card-content">
            <h3>{stats.ultimoMes}</h3>
            <p>Ultimo Mes</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Filter Panel */}
      <FilterPanel
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      >
        <div className="form-group" style={{ flex: '1 1 250px' }}>
          <label htmlFor="tipoReporteFilter">
            <i className="fas fa-filter"></i> Tipo de Reporte
          </label>
          <select
            id="tipoReporteFilter"
            value={tipoReporteFilter}
            onChange={(e) => setTipoReporteFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {TIPOS_REPORTE.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: '1 1 250px' }}>
          <label htmlFor="alumnoFilter">
            <i className="fas fa-user"></i> Alumno
          </label>
          <select
            id="alumnoFilter"
            value={alumnoFilter}
            onChange={(e) => setAlumnoFilter(e.target.value)}
          >
            <option value="">Todos los alumnos</option>
            {alumnos.map(alumno => (
              <option key={alumno.rut} value={alumno.rut}>
                {formatNombre(alumno)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="dateFrom">
            <i className="fas fa-calendar-alt"></i> Desde
          </label>
          <input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="dateTo">
            <i className="fas fa-calendar-alt"></i> Hasta
          </label>
          <input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={reportes.length}>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando reportes...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar reportes</h3>
          <p style={{ color: '#999', marginTop: '10px' }}>
            {error?.message || 'Ha ocurrido un error inesperado'}
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '20px' }}
            onClick={() => refetch()}
          >
            <i className="fas fa-redo"></i>
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && reportes.length === 0 && (
        <EmptyStateCard
          icon="fa-file-alt"
          title="No hay reportes generados"
          description="Comienza generando tu primer reporte fonoaudiologico"
          iconColor="#667eea"
          actionText="Generar Reporte"
          onAction={handleGenerarReporte}
        />
      )}

      {/* Reports Grid */}
      {!isLoading && !isError && reportes.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '20px'
          }}
        >
          {reportes.map((reporte) => {
            const tipoInfo = TIPOS_REPORTE.find(t => t.value === reporte.tipo);
            const alumno = alumnos.find(a => a.rut === reporte.alumno_id) || {};

            return (
              <div key={reporte.id} className="card" style={{ padding: '20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1em', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <i
                        className={`fas ${tipoInfo?.icon || 'fa-file'}`}
                        style={{ color: tipoInfo?.color || '#667eea' }}
                      ></i>
                      {tipoInfo?.label || reporte.tipo}
                    </h3>
                  </div>
                </div>

                {/* Content */}
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-user" style={{ width: '20px' }}></i>
                      <strong>Alumno:</strong> {formatNombre(alumno)}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-calendar-alt" style={{ width: '20px' }}></i>
                      <strong>Periodo:</strong> {formatDate(reporte.fecha_inicio)} - {formatDate(reporte.fecha_fin)}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-clock" style={{ width: '20px' }}></i>
                      <strong>Generado:</strong> {formatDate(reporte.createdAt || reporte.fecha)}
                    </div>
                  </div>

                  {reporte.observaciones && (
                    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                      <p style={{ margin: 0, fontSize: '0.85em', color: '#4b5563', fontStyle: 'italic' }}>
                        {reporte.observaciones.length > 100
                          ? reporte.observaciones.substring(0, 100) + '...'
                          : reporte.observaciones}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => handleVerReporte(reporte)}
                  >
                    <i className="fas fa-eye"></i>
                    <span>Ver Detalle</span>
                  </button>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleExportarReporte(reporte, 'pdf')}
                    title="Exportar a PDF"
                  >
                    <i className="fas fa-file-pdf"></i>
                  </button>
                  <button
                    className="btn btn-info btn-sm"
                    onClick={() => handleExportarReporte(reporte, 'csv')}
                    title="Exportar a CSV"
                  >
                    <i className="fas fa-file-csv"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate Report Modal */}
      {isGenerateModalOpen && (
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
          onClick={() => setIsGenerateModalOpen(false)}
        >
          <div
            className="modal-content card"
            style={{
              maxWidth: '700px',
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
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0 }}>
                <i className="fas fa-file-alt"></i> Generar Reporte
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setIsGenerateModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmitGenerate}>
              <div className="form-row">
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="tipo">
                    Tipo de Reporte <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="tipo"
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleInputChange}
                    required
                  >
                    {TIPOS_REPORTE.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="alumno_id">
                    Alumno <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="alumno_id"
                    name="alumno_id"
                    value={formData.alumno_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Seleccionar alumno</option>
                    {alumnos.map(alumno => (
                      <option key={alumno.rut} value={alumno.rut}>
                        {formatNombre(alumno)} - {alumno.rut}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="fecha_inicio">
                    Fecha Inicio <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="fecha_inicio"
                    type="date"
                    name="fecha_inicio"
                    value={formData.fecha_inicio}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="fecha_fin">
                    Fecha Fin <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="fecha_fin"
                    type="date"
                    name="fecha_fin"
                    value={formData.fecha_fin}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label>Incluir en el Reporte</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        name="incluir_evaluaciones"
                        checked={formData.incluir_evaluaciones}
                        onChange={handleInputChange}
                        style={{ width: 'auto' }}
                      />
                      Evaluaciones
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        name="incluir_asistencia"
                        checked={formData.incluir_asistencia}
                        onChange={handleInputChange}
                        style={{ width: 'auto' }}
                      />
                      Asistencia
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        name="incluir_sesiones"
                        checked={formData.incluir_sesiones}
                        onChange={handleInputChange}
                        style={{ width: 'auto' }}
                      />
                      Sesiones Terapeuticas
                    </label>
                  </div>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="formato">
                    Formato de Exportacion
                  </label>
                  <select
                    id="formato"
                    name="formato"
                    value={formData.formato}
                    onChange={handleInputChange}
                  >
                    {FORMATOS_EXPORTACION.map(formato => (
                      <option key={formato.value} value={formato.value}>{formato.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="observaciones">
                    Observaciones Adicionales
                  </label>
                  <textarea
                    id="observaciones"
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Agrega comentarios u observaciones para incluir en el reporte..."
                  />
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: '20px',
                paddingTop: '20px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsGenerateModalOpen(false)}
                >
                  <i className="fas fa-times"></i>
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  <i className="fas fa-file-alt"></i>
                  <span>Generar Reporte</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reportes;
