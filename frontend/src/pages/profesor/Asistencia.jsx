/**
 * Asistencia Page - Profesor Role
 *
 * Simplified attendance management for teachers.
 * Teachers can only manage attendance for their own courses.
 *
 * Features:
 * - Daily attendance view
 * - Filter by curso
 * - Quick attendance marking
 * - Bulk action: Mark all as present
 * - Individual observations
 * - Statistics dashboard
 * - Export to CSV
 */

import { useState, useMemo } from 'react';
import {
  useAsistencia,
  useRegistrarAsistencia,
  useActualizarAsistencia
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
import { formatDate, formatNombre } from '../../utils/helpers';
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

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  // Build filters object for API
  const asistenciaFilters = useMemo(() => {
    const filters = { fecha: selectedDate };
    if (cursoFilter) filters.curso = cursoFilter;
    if (estadoFilter) filters.estado = estadoFilter;
    return filters;
  }, [selectedDate, cursoFilter, estadoFilter]);

  const { data: asistenciaData = [], isLoading, isError, error, refetch } = useAsistencia(asistenciaFilters);
  const { data: alumnos = [] } = useUsuariosPorRol('alumno');
  const { data: cursosDisponibles = [] } = useCursos();

  const registrarMutation = useRegistrarAsistencia();
  const actualizarMutation = useActualizarAsistencia();

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

  // Filter alumnos by curso
  const alumnosFiltrados = useMemo(() => {
    if (!Array.isArray(alumnos)) return [];
    return alumnos.filter(alumno => {
      const matchesCurso = !cursoFilter || alumno.curso === cursoFilter;
      return matchesCurso;
    });
  }, [alumnos, cursoFilter]);

  // Merge alumnos with their attendance status
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
    if (!Array.isArray(alumnosConAsistencia)) return { total: 0, presente: 0, ausente: 0, tarde: 0, justificado: 0, pendiente: 0 };

    const presente = alumnosConAsistencia.filter(a => a.estadoAsistencia === 'presente').length;
    const ausente = alumnosConAsistencia.filter(a => a.estadoAsistencia === 'ausente').length;
    const tarde = alumnosConAsistencia.filter(a => a.estadoAsistencia === 'tarde').length;
    const justificado = alumnosConAsistencia.filter(a => a.estadoAsistencia === 'justificado').length;
    const pendiente = alumnosConAsistencia.filter(a => a.estadoAsistencia === 'pendiente').length;

    return {
      total: alumnosConAsistencia.length,
      presente,
      ausente,
      tarde,
      justificado,
      pendiente
    };
  }, [alumnosConAsistencia]);

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
        // Create new record
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
        // Update existing record
        await actualizarMutation.mutateAsync({
          id: editingAsistencia.id,
          estado: formData.estado,
          observacion: formData.observaciones
        });
      } else {
        // Create new record
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
        const alumnosPorCurso = {};
        const updatePromises = [];

        alumnosFiltrados.forEach(alumno => {
          const key = `${alumno.rut}_${selectedDate}`;
          const registroExistente = asistenciaMap.get(key);

          if (registroExistente && registroExistente.estado !== 'presente') {
            updatePromises.push(
              actualizarMutation.mutateAsync({
                id: registroExistente.id,
                estado: 'presente'
              })
            );
          } else if (!registroExistente) {
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

        const registrarPromises = Object.entries(alumnosPorCurso).map(([curso, alumnos]) => {
          return registrarMutation.mutateAsync({
            curso,
            fecha: selectedDate,
            alumnos
          });
        });

        await Promise.all([...updatePromises, ...registrarPromises]);
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

  // Clear all filters
  const handleClearFilters = () => {
    setCursoFilter('');
    setEstadoFilter('');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const csv = [
      ['Fecha', 'RUT', 'Nombre', 'Curso', 'Estado', 'Observaciones'].join(','),
      ...alumnosConAsistencia.map(item => {
        const fecha = selectedDate;
        const rut = item.rut;
        const nombre = formatNombre(item);
        const curso = item.curso || '-';
        const estado = item.estadoAsistencia || '-';
        const obs = (item.observaciones || '').replace(/,/g, ';');

        return [fecha, rut, nombre, curso, estado, obs].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `asistencia_${selectedDate}.csv`;
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
        title="Registro de Asistencia"
        icon="fa-calendar-check"
        buttonText="Marcar Todos Presentes"
        buttonIcon="fa-check-double"
        buttonColor="success"
        onButtonClick={handleMarcarTodosPresentes}
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

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-question-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.pendiente}</h3>
            <p>Pendientes</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Date Selection */}
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
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        onClearFilters={handleClearFilters}
      >
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
            <option value="">Todos mis cursos</option>
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
      <ActionBar count={alumnosConAsistencia.length}>
        <button
          className="btn btn-success"
          onClick={handleExportCSV}
          disabled={alumnosConAsistencia.length === 0}
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

      {/* Attendance List */}
      {!isLoading && !isError && (
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
