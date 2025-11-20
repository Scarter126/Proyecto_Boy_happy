/**
 * Asistencia - Attendance Tracking for Speech Therapy Sessions
 *
 * Features:
 * - Track attendance to therapy sessions
 * - Filter by date range, student, session type
 * - Statistics: attendance rate, absences, justified/unjustified
 * - Mark attendance functionality
 * - Export to CSV
 */

import { useState, useMemo } from 'react';
import {
  useAsistencia,
  useRegistrarAsistencia,
  useActualizarAsistencia
} from '../../hooks/useAsistencia';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre, getIniciales } from '../../utils/helpers';
import Swal from 'sweetalert2';

function AsistenciaFono() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [alumnoFilter, setAlumnoFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [viewMode, setViewMode] = useState('daily');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsistencia, setEditingAsistencia] = useState(null);

  const [formData, setFormData] = useState({
    alumno_id: '',
    fecha: selectedDate,
    estado: 'presente',
    tipo_sesion: 'individual',
    observaciones: '',
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const asistenciaFilters = useMemo(() => {
    const filters = { tipo: 'fonoaudiologia' };

    if (viewMode === 'daily') {
      filters.fecha = selectedDate;
    } else {
      if (dateFrom) filters.fechaDesde = dateFrom;
      if (dateTo) filters.fechaHasta = dateTo;
    }

    if (alumnoFilter) filters.alumno_id = alumnoFilter;
    if (estadoFilter) filters.estado = estadoFilter;

    return filters;
  }, [viewMode, selectedDate, dateFrom, dateTo, alumnoFilter, estadoFilter]);

  const { data: asistenciaData = [], isLoading, isError, error, refetch } = useAsistencia(asistenciaFilters);
  const { data: alumnos = [] } = useUsuariosPorRol('alumno');

  const registrarMutation = useRegistrarAsistencia();
  const actualizarMutation = useActualizarAsistencia();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const stats = useMemo(() => {
    if (!Array.isArray(asistenciaData)) return { total: 0, presente: 0, ausente: 0, tarde: 0, justificado: 0 };

    const presente = asistenciaData.filter(a => a.estado === 'presente').length;
    const ausente = asistenciaData.filter(a => a.estado === 'ausente').length;
    const tarde = asistenciaData.filter(a => a.estado === 'tarde').length;
    const justificado = asistenciaData.filter(a => a.estado === 'justificado').length;

    return {
      total: asistenciaData.length,
      presente,
      ausente,
      tarde,
      justificado,
      tasaAsistencia: asistenciaData.length > 0 ? ((presente / asistenciaData.length) * 100).toFixed(1) : 0
    };
  }, [asistenciaData]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleRegistrarAsistencia = () => {
    setEditingAsistencia(null);
    setFormData({
      alumno_id: '',
      fecha: selectedDate,
      estado: 'presente',
      tipo_sesion: 'individual',
      observaciones: '',
    });
    setIsModalOpen(true);
  };

  const handleEditAsistencia = (registro) => {
    setEditingAsistencia(registro);
    setFormData({
      alumno_id: registro.alumno_id,
      fecha: registro.fecha,
      estado: registro.estado,
      tipo_sesion: registro.tipo_sesion || 'individual',
      observaciones: registro.observaciones || '',
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.alumno_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Debes seleccionar un alumno'
      });
      return;
    }

    try {
      if (editingAsistencia) {
        await actualizarMutation.mutateAsync({
          id: editingAsistencia.id,
          ...formData
        });
      } else {
        await registrarMutation.mutateAsync(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting attendance:', error);
    }
  };

  const handleChangeDateBy = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { alumnoFilter, estadoFilter, dateFrom, dateTo });
  };

  const handleClearFilters = () => {
    setAlumnoFilter('');
    setEstadoFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Fecha', 'Alumno', 'RUT', 'Estado', 'Tipo Sesion', 'Observaciones'].join(','),
      ...asistenciaData.map(registro => {
        const alumno = alumnos.find(a => a.rut === registro.alumno_id) || {};
        return [
          registro.fecha,
          `"${formatNombre(alumno)}"`,
          registro.alumno_id,
          registro.estado,
          registro.tipo_sesion || '-',
          `"${(registro.observaciones || '').replace(/,/g, ';')}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `asistencia_fono_${viewMode === 'daily' ? selectedDate : 'reporte'}.csv`;
    link.click();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Asistencia a Terapia"
        icon="fa-calendar-check"
        buttonText="Registrar Asistencia"
        buttonIcon="fa-plus"
        buttonColor="primary"
        onButtonClick={handleRegistrarAsistencia}
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clipboard-check"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Registros</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.presente}</h3>
            <p>Presentes</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-times-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.ausente}</h3>
            <p>Ausentes</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="card-content">
            <h3>{stats.tarde}</h3>
            <p>Tarde</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-file-medical"></i>
          </div>
          <div className="card-content">
            <h3>{stats.justificado}</h3>
            <p>Justificados</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="card-content">
            <h3>{stats.tasaAsistencia}%</h3>
            <p>Tasa Asistencia</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Date Selection (Daily View) */}
      {viewMode === 'daily' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleChangeDateBy(-1)}
                title="Dia anterior"
              >
                <i className="fas fa-chevron-left"></i>
              </button>

              <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 'bold' }}
                />
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => handleChangeDateBy(1)}
                title="Dia siguiente"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <strong style={{ fontSize: '1.1em', color: '#667eea' }}>
                <i className="fas fa-calendar-day"></i> {formatDate(selectedDate, 'long')}
              </strong>
            </div>

            <button
              className="btn btn-info"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            >
              <i className="fas fa-calendar-day"></i>
              <span>Hoy</span>
            </button>

            <button
              className="btn btn-outline-secondary"
              onClick={() => setViewMode('range')}
            >
              <i className="fas fa-calendar-alt"></i>
              <span>Vista por Rango</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <FilterPanel
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      >
        {viewMode === 'range' && (
          <>
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
          </>
        )}

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
          <label htmlFor="estadoFilter">
            <i className="fas fa-filter"></i> Estado
          </label>
          <select
            id="estadoFilter"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="presente">Presente</option>
            <option value="ausente">Ausente</option>
            <option value="tarde">Tarde</option>
            <option value="justificado">Justificado</option>
          </select>
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={asistenciaData.length}>
        <button
          className="btn btn-success"
          onClick={handleExportCSV}
          disabled={asistenciaData.length === 0}
        >
          <i className="fas fa-download"></i>
          <span>Exportar CSV</span>
        </button>
        {viewMode === 'range' && (
          <button
            className="btn btn-outline-secondary"
            onClick={() => setViewMode('daily')}
          >
            <i className="fas fa-calendar-day"></i>
            <span>Vista Diaria</span>
          </button>
        )}
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando asistencia...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar asistencia</h3>
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
      {!isLoading && !isError && asistenciaData.length === 0 && (
        <EmptyStateCard
          icon="fa-calendar-check"
          title="No hay registros de asistencia"
          description={
            viewMode === 'daily'
              ? 'No hay registros para esta fecha'
              : 'Selecciona un rango de fechas o ajusta los filtros'
          }
          iconColor="#667eea"
          actionText="Registrar Asistencia"
          onAction={handleRegistrarAsistencia}
        />
      )}

      {/* Attendance Table */}
      {!isLoading && !isError && asistenciaData.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Alumno</th>
                  <th>Estado</th>
                  <th>Tipo Sesion</th>
                  <th>Observaciones</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {asistenciaData.map((registro) => {
                  const alumno = alumnos.find(a => a.rut === registro.alumno_id) || {};

                  return (
                    <tr key={registro.id}>
                      <td>
                        <i className="fas fa-calendar"></i> {formatDate(registro.fecha)}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: '#667eea',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '12px'
                            }}
                          >
                            {getIniciales(formatNombre(alumno))}
                          </div>
                          <div>
                            <strong>{formatNombre(alumno)}</strong>
                            <div style={{ fontSize: '0.85em', color: '#666' }}>
                              {registro.alumno_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`badge badge-${
                            registro.estado === 'presente' ? 'success' :
                            registro.estado === 'ausente' ? 'danger' :
                            registro.estado === 'tarde' ? 'warning' :
                            registro.estado === 'justificado' ? 'info' : 'default'
                          }`}
                        >
                          {registro.estado === 'presente' && <i className="fas fa-check-circle"></i>}
                          {registro.estado === 'ausente' && <i className="fas fa-times-circle"></i>}
                          {registro.estado === 'tarde' && <i className="fas fa-clock"></i>}
                          {registro.estado === 'justificado' && <i className="fas fa-file-medical"></i>}
                          {' '}
                          {registro.estado.charAt(0).toUpperCase() + registro.estado.slice(1)}
                        </span>
                      </td>

                      <td>{registro.tipo_sesion || 'Individual'}</td>

                      <td>
                        {registro.observaciones ? (
                          <span title={registro.observaciones}>
                            {registro.observaciones.length > 50
                              ? registro.observaciones.substring(0, 50) + '...'
                              : registro.observaciones}
                          </span>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleEditAsistencia(registro)}
                            title="Editar"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register/Edit Attendance Modal */}
      {isModalOpen && (
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
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="modal-content card"
            style={{
              maxWidth: '600px',
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
                <i className={`fas ${editingAsistencia ? 'fa-edit' : 'fa-plus'}`}></i>
                {' '}
                {editingAsistencia ? 'Editar Asistencia' : 'Registrar Asistencia'}
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
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
                  <label htmlFor="fecha">
                    Fecha <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="fecha"
                    type="date"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="estado">
                    Estado <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="presente">Presente</option>
                    <option value="ausente">Ausente</option>
                    <option value="tarde">Tarde</option>
                    <option value="justificado">Justificado</option>
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="tipo_sesion">
                    Tipo de Sesion
                  </label>
                  <select
                    id="tipo_sesion"
                    name="tipo_sesion"
                    value={formData.tipo_sesion}
                    onChange={handleInputChange}
                  >
                    <option value="individual">Individual</option>
                    <option value="grupal">Grupal</option>
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="observaciones">
                    Observaciones
                  </label>
                  <textarea
                    id="observaciones"
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Ingrese observaciones sobre la asistencia..."
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
                  onClick={() => setIsModalOpen(false)}
                  disabled={registrarMutation.isPending || actualizarMutation.isPending}
                >
                  <i className="fas fa-times"></i>
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={registrarMutation.isPending || actualizarMutation.isPending}
                >
                  {(registrarMutation.isPending || actualizarMutation.isPending) && (
                    <i className="fas fa-spinner fa-spin"></i>
                  )}
                  {!(registrarMutation.isPending || actualizarMutation.isPending) && (
                    <i className="fas fa-save"></i>
                  )}
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AsistenciaFono;
