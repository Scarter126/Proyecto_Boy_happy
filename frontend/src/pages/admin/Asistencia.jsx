/**
 * Asistencia Management Page - Admin
 *
 * Simplified daily attendance management.
 * Single source of truth: alumnos list
 * Attendance records are just metadata
 */

import { useState, useMemo, useEffect } from 'react';
import {
  useAsistencia,
  useRegistrarAsistencia,
  useActualizarAsistencia,
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
  // STATE
  // ==========================================

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [cursoFilter, setCursoFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlumno, setEditingAlumno] = useState(null);
  const [observaciones, setObservaciones] = useState('');

  // ==========================================
  // DATA FETCHING
  // ==========================================

  // PRIMARY source of truth: All students
  const { data: alumnos = [], isLoading: loadingAlumnos } = useUsuariosPorRol('alumno');

  // METADATA: Attendance records for selected date
  const { data: asistenciaData = [], isLoading: loadingAsistencia, refetch } = useAsistencia({
    fecha: selectedDate
  });

  const { data: cursosDisponibles = [] } = useCursos();
  const registrarMutation = useRegistrarAsistencia();
  const actualizarMutation = useActualizarAsistencia();

  // ==========================================
  // COMPUTED DATA
  // ==========================================

  // Debug logging
  useEffect(() => {
    console.log('[Asistencia] Data loaded:', {
      alumnos: alumnos.length,
      asistenciaRecords: asistenciaData.length,
      selectedDate,
      cursoFilter
    });
  }, [alumnos, asistenciaData, selectedDate, cursoFilter]);

  // Create attendance lookup map (rutAlumno -> registro)
  const asistenciaMap = useMemo(() => {
    const map = new Map();
    asistenciaData.forEach(reg => {
      map.set(reg.rutAlumno, reg);
    });
    return map;
  }, [asistenciaData]);

  // Filter students by curso
  const alumnosFiltrados = useMemo(() => {
    if (!cursoFilter) return alumnos;
    return alumnos.filter(a => a.curso === cursoFilter);
  }, [alumnos, cursoFilter]);

  // MAIN DATA: Merge students with their attendance status
  const alumnosConAsistencia = useMemo(() => {
    return alumnosFiltrados.map(alumno => {
      const registro = asistenciaMap.get(alumno.rut);
      return {
        ...alumno,
        estadoAsistencia: registro?.estado || 'pendiente',
        observaciones: registro?.observacion || '',
        registroId: registro?.id || null
      };
    });
  }, [alumnosFiltrados, asistenciaMap]);

  // Statistics (based on alumnosConAsistencia only)
  const stats = useMemo(() => {
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

  const handleEstadoChange = async (alumno, nuevoEstado) => {
    try {
      const registroExistente = asistenciaMap.get(alumno.rut);

      if (registroExistente) {
        // Update existing
        await actualizarMutation.mutateAsync({
          id: registroExistente.id,
          estado: nuevoEstado
        });
      } else {
        // Create new
        await registrarMutation.mutateAsync({
          curso: alumno.curso || 'GENERAL',
          fecha: selectedDate,
          alumnos: [{
            rut: alumno.rut,
            nombre: formatNombre(alumno),
            estado: nuevoEstado,
            observacion: ''
          }]
        });
      }

      await refetch();
    } catch (error) {
      console.error('Error updating attendance:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo actualizar la asistencia'
      });
    }
  };

  const handleAgregarObservacion = (alumno) => {
    setEditingAlumno(alumno);
    setObservaciones(alumno.observaciones || '');
    setIsModalOpen(true);
  };

  const handleSubmitObservacion = async (e) => {
    e.preventDefault();

    try {
      const registroExistente = asistenciaMap.get(editingAlumno.rut);

      if (registroExistente) {
        await actualizarMutation.mutateAsync({
          id: registroExistente.id,
          estado: registroExistente.estado,
          observacion: observaciones
        });
      } else {
        await registrarMutation.mutateAsync({
          curso: editingAlumno.curso || 'GENERAL',
          fecha: selectedDate,
          alumnos: [{
            rut: editingAlumno.rut,
            nombre: formatNombre(editingAlumno),
            estado: 'presente',
            observacion: observaciones
          }]
        });
      }

      await refetch();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting observation:', error);
    }
  };

  const handleMarcarTodosPresentes = async () => {
    const result = await Swal.fire({
      title: '¿Marcar todos como presentes?',
      html: `<p>Se marcarán <strong>${alumnosFiltrados.length} alumnos</strong> como presentes</p>`,
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
          const registroExistente = asistenciaMap.get(alumno.rut);

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
          text: 'Todos los alumnos marcados como presentes',
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

  const handleExportCSV = () => {
    const csv = [
      ['Fecha', 'RUT', 'Nombre', 'Curso', 'Estado', 'Observaciones'].join(','),
      ...alumnosConAsistencia.map(item => {
        const rut = item.rut;
        const nombre = formatNombre(item);
        const curso = item.curso || '-';
        const estado = item.estadoAsistencia || '-';
        const obs = (item.observaciones || '').replace(/,/g, ';');
        return [selectedDate, rut, nombre, curso, estado, obs].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `asistencia_${selectedDate}.csv`;
    link.click();
  };

  const handleChangeDateBy = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  // ==========================================
  // RENDER
  // ==========================================

  const isLoading = loadingAlumnos || loadingAsistencia;

  return (
    <div className="page-content">
      {/* Header */}
      <SectionHeader
        title="Gestión de Asistencia"
        icon="fa-calendar-check"
        buttonText="Marcar Todos Presentes"
        buttonIcon="fa-check-double"
        buttonColor="success"
        onButtonClick={handleMarcarTodosPresentes}
      />

      {/* Statistics */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon"><i className="fas fa-users"></i></div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Alumnos</p>
          </div>
        </div>
        <div className="indicator-card">
          <div className="card-icon"><i className="fas fa-check-circle"></i></div>
          <div className="card-content">
            <h3>{stats.presente}</h3>
            <p>Presentes</p>
          </div>
        </div>
        <div className="indicator-card">
          <div className="card-icon"><i className="fas fa-times-circle"></i></div>
          <div className="card-content">
            <h3>{stats.ausente}</h3>
            <p>Ausentes</p>
          </div>
        </div>
        <div className="indicator-card">
          <div className="card-icon"><i className="fas fa-clock"></i></div>
          <div className="card-content">
            <h3>{stats.tarde}</h3>
            <p>Tarde</p>
          </div>
        </div>
        <div className="indicator-card">
          <div className="card-icon"><i className="fas fa-file-medical"></i></div>
          <div className="card-content">
            <h3>{stats.justificado}</h3>
            <p>Justificados</p>
          </div>
        </div>
        <div className="indicator-card">
          <div className="card-icon"><i className="fas fa-question-circle"></i></div>
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
            <button className="btn btn-secondary" onClick={() => handleChangeDateBy(-1)}>
              <i className="fas fa-chevron-left"></i>
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ textAlign: 'center', fontWeight: 'bold', minWidth: '200px' }}
            />
            <button className="btn btn-secondary" onClick={() => handleChangeDateBy(1)}>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '1.1em', color: '#667eea' }}>
              <i className="fas fa-calendar-day"></i> {formatDate(selectedDate, 'long')}
            </strong>
          </div>
          <button
            className="btn btn-info"
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          >
            <i className="fas fa-calendar-day"></i> <span>Hoy</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterPanel onClearFilters={() => setCursoFilter('')}>
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
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={alumnosConAsistencia.length}>
        <button
          className="btn btn-success"
          onClick={handleExportCSV}
          disabled={alumnosConAsistencia.length === 0}
        >
          <i className="fas fa-download"></i> <span>Exportar CSV</span>
        </button>
      </ActionBar>

      {/* Loading */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando asistencia...</h3>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && alumnosConAsistencia.length === 0 && (
        <EmptyStateCard
          icon="fa-user-graduate"
          title="No hay alumnos"
          description={cursoFilter
            ? "No hay alumnos en este curso. Selecciona otro curso."
            : "No hay alumnos registrados en el sistema. Ve a Gestión de Usuarios para crear alumnos."}
          iconColor="#667eea"
        />
      )}

      {/* Attendance List */}
      {!isLoading && alumnosConAsistencia.length > 0 && (
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

      {/* Modal Observaciones */}
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
            style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>
                <i className="fas fa-comment"></i> Observaciones
              </h2>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} style={{ minWidth: 'auto', padding: '8px 12px' }}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmitObservacion}>
              <div className="form-group">
                <label>Alumno</label>
                <input type="text" value={formatNombre(editingAlumno || {})} disabled style={{ backgroundColor: '#f3f4f6' }} />
              </div>

              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows="4"
                  placeholder="Ingrese observaciones..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  <i className="fas fa-times"></i> <span>Cancelar</span>
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fas fa-save"></i> <span>Guardar</span>
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
