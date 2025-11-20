/**
 * Asistencia Management Page - Boy Happy
 *
 * Comprehensive production-ready page for attendance management.
 * Implements full CRUD operations with React Query, UI components, and best practices.
 *
 * Features:
 * - Date selection with calendar view
 * - Filter by: date range, curso, estado (presente, ausente, justificado, tarde)
 * - Quick attendance marking with toggle buttons
 * - Bulk actions: Mark all as present, export report
 * - Individual attendance editing with observations
 * - Statistics dashboard (total, present, absent, late, justified)
 * - Export to CSV for reports
 * - Loading and error states
 * - Optimistic updates
 * - Responsive design
 * - Accessibility
 */

import { useState, useMemo } from 'react';
import {
  useAsistencia,
  useRegistrarAsistencia,
  useActualizarAsistencia,
  useDeleteAsistencia
} from '../../hooks/useAsistencia';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import { useCursos } from '../../hooks/useConfiguracion';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import AsistenciaRow from '../../components/business/AsistenciaRow';
import { formatDate, formatNombre, getIniciales } from '../../utils/helpers';
import Swal from 'sweetalert2';

function Asistencia() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  // Current date for attendance
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Filter state
  const [cursoFilter, setCursoFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsistencia, setEditingAsistencia] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    alumno_id: '',
    fecha: selectedDate,
    estado: 'presente',
    observaciones: '',
  });

  // View mode: 'daily' (day view) or 'range' (date range view)
  const [viewMode, setViewMode] = useState('daily');

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  // Build filters object for API
  const asistenciaFilters = useMemo(() => {
    const filters = {};

    if (viewMode === 'daily') {
      filters.fecha = selectedDate;
    } else {
      if (dateFrom) filters.fechaDesde = dateFrom;
      if (dateTo) filters.fechaHasta = dateTo;
    }

    if (cursoFilter) filters.curso = cursoFilter;
    if (estadoFilter) filters.estado = estadoFilter;

    return filters;
  }, [viewMode, selectedDate, dateFrom, dateTo, cursoFilter, estadoFilter]);

  const { data: asistenciaData = [], isLoading, isError, error, refetch } = useAsistencia(asistenciaFilters);
  const { data: alumnos = [] } = useUsuariosPorRol('alumno');
  const { data: cursosDisponibles = [] } = useCursos();

  const registrarMutation = useRegistrarAsistencia();
  const actualizarMutation = useActualizarAsistencia();
  const deleteMutation = useDeleteAsistencia();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Create attendance map for easy lookup
  const asistenciaMap = useMemo(() => {
    if (!Array.isArray(asistenciaData)) return new Map();
    const map = new Map();
    asistenciaData.forEach(reg => {
      const key = `${reg.rutAlumno}_${reg.fecha}`;
      map.set(key, reg);
    });
    return map;
  }, [asistenciaData]);

  // Filter alumnos by curso for daily view
  const alumnosFiltrados = useMemo(() => {
    if (!Array.isArray(alumnos)) return [];
    return alumnos.filter(alumno => {
      const matchesCurso = !cursoFilter || alumno.curso === cursoFilter;
      return matchesCurso;
    });
  }, [alumnos, cursoFilter]);

  // Merge alumnos with their attendance status for daily view
  const alumnosConAsistencia = useMemo(() => {
    return alumnosFiltrados.map(alumno => {
      const key = `${alumno.rut}_${selectedDate}`;
      const registro = asistenciaMap.get(key);

      return {
        ...alumno,
        estadoAsistencia: registro?.estado || 'pendiente',
        observaciones: registro?.observacion || '',
        registroId: registro?.id || null
      };
    });
  }, [alumnosFiltrados, asistenciaMap, selectedDate]);

  // Calculate statistics
  const stats = useMemo(() => {
    const data = viewMode === 'daily' ? alumnosConAsistencia : asistenciaData;
    if (!Array.isArray(data)) return { total: 0, presente: 0, ausente: 0, tarde: 0, justificado: 0, pendiente: 0 };

    const presente = data.filter(a => a.estado === 'presente' || a.estadoAsistencia === 'presente').length;
    const ausente = data.filter(a => a.estado === 'ausente' || a.estadoAsistencia === 'ausente').length;
    const tarde = data.filter(a => a.estado === 'tarde' || a.estadoAsistencia === 'tarde').length;
    const justificado = data.filter(a => a.estado === 'justificado' || a.estadoAsistencia === 'justificado').length;
    const pendiente = data.filter(a => a.estadoAsistencia === 'pendiente').length;

    return {
      total: viewMode === 'daily' ? alumnosConAsistencia.length : data.length,
      presente,
      ausente,
      tarde,
      justificado,
      pendiente
    };
  }, [alumnosConAsistencia, asistenciaData, viewMode]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  // Handle estado change from AsistenciaRow
  const handleEstadoChange = async (alumno, nuevoEstado) => {
    try {
      const key = `${alumno.rut}_${selectedDate}`;
      const registroExistente = asistenciaMap.get(key);

      if (registroExistente) {
        // Update existing record
        await actualizarMutation.mutateAsync({
          id: registroExistente.id,
          estado: nuevoEstado
        });
      } else {
        // Create new record - backend expects array format
        await registrarMutation.mutateAsync({
          curso: alumno.curso || '',
          fecha: selectedDate,
          alumnos: [
            {
              rut: alumno.rut,
              nombre: formatNombre(alumno),
              estado: nuevoEstado,
              observacion: ''
            }
          ]
        });
      }

      // Explicitly refetch to ensure list updates with current filters
      await refetch();
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  };

  // Open modal for adding observations
  const handleAgregarObservacion = (alumno) => {
    const key = `${alumno.rut}_${selectedDate}`;
    const registro = asistenciaMap.get(key);

    setEditingAsistencia(registro || null);
    setFormData({
      alumno_id: alumno.rut,
      fecha: selectedDate,
      estado: registro?.estado || 'presente',
      observaciones: registro?.observacion || '',
    });
    setIsModalOpen(true);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Submit observation form
  const handleSubmitObservacion = async (e) => {
    e.preventDefault();

    try {
      if (editingAsistencia) {
        // Update existing record - PUT uses different format
        await actualizarMutation.mutateAsync({
          id: editingAsistencia.id,
          estado: formData.estado,
          observacion: formData.observaciones  // Map to backend field name
        });
      } else {
        // Create new record - POST expects array format
        const alumno = alumnos.find(a => a.rut === formData.alumno_id);
        await registrarMutation.mutateAsync({
          curso: alumno?.curso || '',
          fecha: formData.fecha,
          alumnos: [
            {
              rut: formData.alumno_id,
              nombre: formatNombre(alumno),
              estado: formData.estado,
              observacion: formData.observaciones
            }
          ]
        });
      }

      // Explicitly refetch to ensure list updates
      await refetch();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting observation:', error);
    }
  };

  // Bulk action: Mark all as present
  const handleMarcarTodosPresentes = async () => {
    const result = await Swal.fire({
      title: '¿Marcar todos como presentes?',
      html: `<p>Se marcarán <strong>${alumnosFiltrados.length} alumnos</strong> como presentes para la fecha <strong>${formatDate(selectedDate)}</strong></p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, marcar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        // Group by curso for efficient bulk registration
        const alumnosPorCurso = {};
        const updatePromises = [];

        alumnosFiltrados.forEach(alumno => {
          const key = `${alumno.rut}_${selectedDate}`;
          const registroExistente = asistenciaMap.get(key);

          if (registroExistente && registroExistente.estado !== 'presente') {
            // Update existing records individually
            updatePromises.push(
              actualizarMutation.mutateAsync({
                id: registroExistente.id,
                estado: 'presente'
              })
            );
          } else if (!registroExistente) {
            // Group new records by curso
            const curso = alumno.curso || 'GENERAL';
            if (!alumnosPorCurso[curso]) {
              alumnosPorCurso[curso] = [];
            }
            alumnosPorCurso[curso].push({
              rut: alumno.rut,
              nombre: formatNombre(alumno),
              estado: 'presente',
              observacion: ''
            });
          }
        });

        // Send bulk registrations per curso
        const registrarPromises = Object.entries(alumnosPorCurso).map(([curso, alumnos]) => {
          return registrarMutation.mutateAsync({
            curso,
            fecha: selectedDate,
            alumnos
          });
        });

        await Promise.all([...updatePromises, ...registrarPromises]);

        // Explicitly refetch to ensure list updates
        await refetch();

        Swal.fire({
          icon: 'success',
          title: 'Completado',
          text: 'Todos los alumnos han sido marcados como presentes',
          timer: 2000
        });
      } catch (error) {
        console.error('Error marking all present:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Hubo un error al marcar la asistencia'
        });
      }
    }
  };

  // Apply filters
  const handleApplyFilters = () => {
    // Filters are automatically applied via useMemo
    console.log('Filters applied:', { cursoFilter, estadoFilter, dateFrom, dateTo });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setCursoFilter('');
    setEstadoFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const data = viewMode === 'daily' ? alumnosConAsistencia : asistenciaData;

    const csv = [
      ['Fecha', 'RUT', 'Nombre', 'Curso', 'Estado', 'Observaciones'].join(','),
      ...data.map(item => {
        const fecha = item.fecha || selectedDate;
        const rut = item.rut || item.rutAlumno;
        const nombre = formatNombre(item);
        const curso = item.curso || '-';
        const estado = item.estado || item.estadoAsistencia || '-';
        const obs = (item.observaciones || item.observacion || '').replace(/,/g, ';');

        return [fecha, rut, nombre, curso, estado, obs].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `asistencia_${viewMode === 'daily' ? selectedDate : 'reporte'}.csv`;
    link.click();
  };

  // Change date (previous/next day)
  const handleChangeDateBy = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Gestión de Asistencia"
        icon="fa-calendar-check"
        buttonText={viewMode === 'daily' ? 'Marcar Todos Presentes' : 'Vista Diaria'}
        buttonIcon={viewMode === 'daily' ? 'fa-check-double' : 'fa-calendar-day'}
        buttonColor="success"
        onButtonClick={viewMode === 'daily' ? handleMarcarTodosPresentes : () => setViewMode('daily')}
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Alumnos</p>
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

        {viewMode === 'daily' && (
          <div className="indicator-card">
            <div className="card-icon">
              <i className="fas fa-question-circle"></i>
            </div>
            <div className="card-content">
              <h3>{stats.pendiente}</h3>
              <p>Pendientes</p>
            </div>
          </div>
        )}
      </StatCardGrid>

      {/* Date Selection (Daily View) */}
      {viewMode === 'daily' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleChangeDateBy(-1)}
                title="Día anterior"
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
                title="Día siguiente"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <strong style={{ fontSize: '1.1em', color: '#667eea' }}>
                <i className="fas fa-calendar-day"></i>
                {' '}
                {formatDate(selectedDate, 'long')}
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
        {/* Date range filters (only in range view) */}
        {viewMode === 'range' && (
          <>
            <div className="form-group">
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

            <div className="form-group">
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

        {/* Curso filter */}
        <div className="form-group">
          <label htmlFor="cursoFilter">
            <i className="fas fa-school"></i> Curso
          </label>
          <select
            id="cursoFilter"
            value={cursoFilter}
            onChange={(e) => setCursoFilter(e.target.value)}
          >
            <option value="">Todos los cursos</option>
            {cursosDisponibles.map(curso => (
              <option key={curso.codigo} value={curso.codigo}>{curso.nombre}</option>
            ))}
          </select>
        </div>

        {/* Estado filter */}
        <div className="form-group">
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
      <ActionBar count={viewMode === 'daily' ? alumnosConAsistencia.length : asistenciaData.length}>
        <button
          className="btn btn-success"
          onClick={handleExportCSV}
          disabled={(viewMode === 'daily' ? alumnosConAsistencia : asistenciaData).length === 0}
        >
          <i className="fas fa-download"></i>
          <span>Exportar CSV</span>
        </button>
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

      {/* Daily View - Attendance List */}
      {!isLoading && !isError && viewMode === 'daily' && (
        <>
          {alumnosConAsistencia.length === 0 ? (
            <EmptyStateCard
              icon="fa-user-graduate"
              title="No hay alumnos en este curso"
              description="Selecciona un curso diferente o verifica los filtros"
              iconColor="#667eea"
            />
          ) : (
            <div className="card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {alumnosConAsistencia.map((alumno) => (
                  <AsistenciaRow
                    key={alumno.rut}
                    alumno={alumno}
                    onEstadoChange={handleEstadoChange}
                    onAgregarObservacion={handleAgregarObservacion}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Range View - Attendance Table */}
      {!isLoading && !isError && viewMode === 'range' && (
        <>
          {asistenciaData.length === 0 ? (
            <EmptyStateCard
              icon="fa-calendar-check"
              title="No hay registros de asistencia"
              description="Selecciona un rango de fechas o ajusta los filtros"
              iconColor="#667eea"
            />
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Alumno</th>
                      <th>Curso</th>
                      <th>Estado</th>
                      <th>Observaciones</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistenciaData.map((registro) => {
                      // Find alumno data
                      const alumno = alumnos.find(a => a.rut === registro.rutAlumno) || {};

                      return (
                        <tr key={registro.id}>
                          {/* Fecha */}
                          <td>
                            <i className="fas fa-calendar"></i>
                            {' '}
                            {formatDate(registro.fecha)}
                          </td>

                          {/* Alumno */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                className="user-avatar"
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
                                  {registro.rutAlumno}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Curso */}
                          <td>{alumno.curso || '-'}</td>

                          {/* Estado Badge */}
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

                          {/* Observaciones */}
                          <td>
                            {registro.observacion ? (
                              <span title={registro.observacion}>
                                {registro.observacion.length > 50
                                  ? registro.observacion.substring(0, 50) + '...'
                                  : registro.observacion}
                              </span>
                            ) : (
                              <span style={{ color: '#999' }}>-</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => {
                                  setEditingAsistencia(registro);
                                  setFormData({
                                    alumno_id: registro.rutAlumno,
                                    fecha: registro.fecha,
                                    estado: registro.estado,
                                    observaciones: registro.observacion || '',
                                  });
                                  setIsModalOpen(true);
                                }}
                                title="Editar"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={async () => {
                                  const result = await Swal.fire({
                                    title: '¿Eliminar registro?',
                                    text: 'Esta acción no se puede deshacer',
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonColor: '#d33',
                                    cancelButtonColor: '#6c757d',
                                    confirmButtonText: 'Sí, eliminar',
                                    cancelButtonText: 'Cancelar'
                                  });
                                  if (result.isConfirmed) {
                                    await deleteMutation.mutateAsync(registro.id);
                                  }
                                }}
                                title="Eliminar"
                              >
                                <i className="fas fa-trash"></i>
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
        </>
      )}

      {/* Edit/Create Observation Modal */}
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
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0 }}>
                <i className="fas fa-comment"></i>
                {' '}
                {editingAsistencia ? 'Editar Asistencia' : 'Agregar Observación'}
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitObservacion}>
              <div className="form-row">
                {/* Alumno (read-only) */}
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="alumno_id">
                    Alumno
                  </label>
                  <input
                    id="alumno_id"
                    type="text"
                    value={formatNombre(alumnos.find(a => a.rut === formData.alumno_id) || {})}
                    disabled
                    style={{ backgroundColor: '#f3f4f6' }}
                  />
                </div>

                {/* Fecha */}
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

                {/* Estado */}
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

                {/* Observaciones */}
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

              {/* Form Actions */}
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

export default Asistencia;


