/**
 * AvanceAlumnos - Student Progress Tracking for Teachers
 *
 * Features:
 * - View progress of all students in teacher's classes
 * - Filters: class/course, subject, period, student search
 * - Statistics: average performance, students at risk, top performers
 * - Student detail view with progress charts
 * - Timeline of student achievements and difficulties
 * - Export progress reports to CSV
 */

import { useState, useMemo } from 'react';
import { useAlumnosDeProfesor, useCursosDeProfesor } from '../../hooks/useAlumnos';
import { useNotas } from '../../hooks/useNotas';
import { useAsistencia } from '../../hooks/useAsistencia';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre, getIniciales } from '../../utils/helpers';
import { calcularPromedioConceptual, determinarNivelDesempeno, estaEnRiesgo } from '../../utils/evaluacionHelper';
import Swal from 'sweetalert2';

const ASIGNATURAS = [
  { value: 'matematicas', label: 'Matemáticas' },
  { value: 'lenguaje', label: 'Lenguaje y Comunicación' },
  { value: 'ciencias', label: 'Ciencias Naturales' },
  { value: 'historia', label: 'Historia y Geografía' },
  { value: 'arte', label: 'Artes' },
  { value: 'musica', label: 'Música' },
  { value: 'educacion-fisica', label: 'Educación Física' }
];

const PERIODOS = [
  { value: 'semestre-1', label: 'Primer Semestre' },
  { value: 'semestre-2', label: 'Segundo Semestre' },
  { value: 'anual', label: 'Anual' }
];

const NIVELES_DESEMPENO = {
  excelente: { label: 'Excelente', color: '#48bb78', icon: 'fa-star' },
  bueno: { label: 'Bueno', color: '#667eea', icon: 'fa-thumbs-up' },
  regular: { label: 'Regular', color: '#ed8936', icon: 'fa-minus-circle' },
  deficiente: { label: 'Deficiente', color: '#e53e3e', icon: 'fa-exclamation-triangle' }
};

function AvanceAlumnos() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [searchTerm, setSearchTerm] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');
  const [asignaturaFilter, setAsignaturaFilter] = useState('');
  const [periodoFilter, setPeriodoFilter] = useState('semestre-1');
  const [selectedAlumno, setSelectedAlumno] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: alumnos = [], isLoading: isLoadingAlumnos } = useAlumnosDeProfesor();
  const { data: notas = [], isLoading: isLoadingNotas } = useNotas();
  const { data: asistencia = [] } = useAsistencia();
  const { data: misCursos = [], isLoading: loadingCursos } = useCursosDeProfesor();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const filteredAlumnos = useMemo(() => {
    if (!Array.isArray(alumnos)) return [];

    return alumnos.filter(alumno => {
      const searchLower = searchTerm.toLowerCase();
      const nombreCompleto = formatNombre(alumno).toLowerCase();

      const matchesSearch = !searchTerm || nombreCompleto.includes(searchLower) || alumno.rut?.toLowerCase().includes(searchLower);
      // Handle both curso and cursoId fields
      const alumnoCurso = alumno.curso || alumno.cursoId;
      const matchesCurso = !cursoFilter || alumnoCurso === cursoFilter;

      return matchesSearch && matchesCurso;
    });
  }, [alumnos, searchTerm, cursoFilter]);

  // Calculate student progress data
  const alumnosConProgreso = useMemo(() => {
    return filteredAlumnos.map(alumno => {
      const notasAlumno = notas.filter(nota => nota.rutAlumno === alumno.rut);
      const notasFiltradas = asignaturaFilter
        ? notasAlumno.filter(nota => nota.asignatura === asignaturaFilter)
        : notasAlumno;

      // Calcular promedio usando evaluación conceptual (nivelLogro)
      const promedio = calcularPromedioConceptual(notasFiltradas);

      const asistenciaAlumno = asistencia.filter(a => a.rutAlumno === alumno.rut);
      const porcentajeAsistencia = asistenciaAlumno.length > 0
        ? ((asistenciaAlumno.filter(a => a.estado === 'presente').length / asistenciaAlumno.length) * 100).toFixed(0)
        : 0;

      const nivelDesempenoCalculado = determinarNivelDesempeno(promedio);

      const enRiesgoCalculado = estaEnRiesgo(promedio, parseFloat(porcentajeAsistencia));

      return {
        ...alumno,
        promedio: promedio,
        porcentajeAsistencia: parseFloat(porcentajeAsistencia),
        totalNotas: notasFiltradas.length,
        nivelDesempeno: nivelDesempenoCalculado,
        enRiesgo: enRiesgoCalculado
      };
    });
  }, [filteredAlumnos, notas, asistencia, asignaturaFilter]);

  const stats = useMemo(() => {
    const totalAlumnos = alumnosConProgreso.length;
    const promedioGeneral = totalAlumnos > 0
      ? (alumnosConProgreso.reduce((sum, a) => sum + a.promedio, 0) / totalAlumnos).toFixed(1)
      : 0;

    const alumnosEnRiesgo = alumnosConProgreso.filter(a => a.enRiesgo).length;
    const alumnosDestacados = alumnosConProgreso.filter(a => a.nivelDesempeno === 'excelente').length;

    const asistenciaPromedio = totalAlumnos > 0
      ? (alumnosConProgreso.reduce((sum, a) => sum + a.porcentajeAsistencia, 0) / totalAlumnos).toFixed(0)
      : 0;

    return {
      totalAlumnos,
      promedioGeneral,
      alumnosEnRiesgo,
      alumnosDestacados,
      asistenciaPromedio
    };
  }, [alumnosConProgreso]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleVerDetalle = (alumno) => {
    setSelectedAlumno(alumno);
    setIsDetailModalOpen(true);
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { cursoFilter, asignaturaFilter, periodoFilter });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setCursoFilter('');
    setAsignaturaFilter('');
    setPeriodoFilter('semestre-1');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Alumno', 'RUT', 'Curso', 'Promedio', 'Asistencia %', 'Total Notas', 'Nivel Desempeño', 'En Riesgo'].join(','),
      ...alumnosConProgreso.map(alumno => [
        `"${formatNombre(alumno)}"`,
        alumno.rut,
        alumno.curso || alumno.cursoId,
        alumno.promedio,
        alumno.porcentajeAsistencia,
        alumno.totalNotas,
        NIVELES_DESEMPENO[alumno.nivelDesempeno]?.label || alumno.nivelDesempeno,
        alumno.enRiesgo ? 'Sí' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `avance_alumnos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    Swal.fire({
      icon: 'success',
      title: 'Exportado',
      text: 'El reporte ha sido exportado exitosamente',
      timer: 2000
    });
  };

  // ==========================================
  // RENDER
  // ==========================================

  const isLoading = isLoadingAlumnos || isLoadingNotas;

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Avance de Alumnos"
        icon="fa-chart-line"
        subtitle="Seguimiento del progreso académico de los estudiantes"
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="card-content">
            <h3>{stats.totalAlumnos}</h3>
            <p>Total Alumnos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="card-content">
            <h3>{stats.promedioGeneral}</h3>
            <p>Promedio General</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.alumnosEnRiesgo}</h3>
            <p>Alumnos en Riesgo</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-star"></i>
          </div>
          <div className="card-content">
            <h3>{stats.alumnosDestacados}</h3>
            <p>Alumnos Destacados</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="card-content">
            <h3>{stats.asistenciaPromedio}%</h3>
            <p>Asistencia Promedio</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Filter Panel */}
      <FilterPanel
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      >
        <div className="form-group" style={{ flex: '1 1 300px' }}>
          <label htmlFor="search">
            <i className="fas fa-search"></i> Buscar Alumno
          </label>
          <input
            id="search"
            type="text"
            placeholder="Buscar por nombre o RUT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="cursoFilter">
            <i className="fas fa-school"></i> Curso
          </label>
          <select
            id="cursoFilter"
            value={cursoFilter}
            onChange={(e) => setCursoFilter(e.target.value)}
          >
            <option value="">{loadingCursos ? 'Cargando cursos...' : 'Todos mis cursos'}</option>
            {misCursos.map((curso) => (
              <option key={curso.curso} value={curso.curso}>
                {curso.curso} {curso.tipo === 'jefe' ? '(Jefe)' : `(${curso.asignatura})`}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: '1 1 200px' }}>
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

        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="periodoFilter">
            <i className="fas fa-calendar"></i> Período
          </label>
          <select
            id="periodoFilter"
            value={periodoFilter}
            onChange={(e) => setPeriodoFilter(e.target.value)}
          >
            {PERIODOS.map(periodo => (
              <option key={periodo.value} value={periodo.value}>{periodo.label}</option>
            ))}
          </select>
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={alumnosConProgreso.length}>
        <button
          className="btn btn-success"
          onClick={handleExportCSV}
          disabled={alumnosConProgreso.length === 0}
        >
          <i className="fas fa-file-csv"></i>
          <span>Exportar CSV</span>
        </button>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando progreso de alumnos...</h3>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && alumnosConProgreso.length === 0 && (
        <EmptyStateCard
          icon="fa-chart-line"
          title="No hay datos de progreso disponibles"
          description="No se encontraron alumnos con los filtros seleccionados"
          iconColor="#667eea"
        />
      )}

      {/* Students Progress Grid */}
      {!isLoading && alumnosConProgreso.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}
        >
          {alumnosConProgreso.map((alumno) => {
            const nivelConfig = NIVELES_DESEMPENO[alumno.nivelDesempeno];

            return (
              <div
                key={alumno.rut}
                className="card"
                style={{
                  padding: '20px',
                  border: alumno.enRiesgo ? '2px solid #e53e3e' : undefined
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      backgroundColor: nivelConfig.color,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}
                  >
                    {getIniciales(formatNombre(alumno))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1em' }}>
                      {formatNombre(alumno)}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: '#6b7280' }}>
                      {alumno.rut} - {alumno.curso || alumno.cursoId}
                    </p>
                  </div>
                  {alumno.enRiesgo && (
                    <i className="fas fa-exclamation-circle" style={{ color: '#e53e3e', fontSize: '24px' }} title="Alumno en riesgo"></i>
                  )}
                </div>

                {/* Performance Metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '15px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.9em', color: '#4b5563' }}>
                        <i className="fas fa-chart-bar"></i> Promedio
                      </span>
                      <strong style={{ color: nivelConfig.color }}>{alumno.promedio}</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(alumno.promedio / 7) * 100}%`,
                          height: '100%',
                          backgroundColor: nivelConfig.color,
                          transition: 'width 0.3s'
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.9em', color: '#4b5563' }}>
                        <i className="fas fa-calendar-check"></i> Asistencia
                      </span>
                      <strong style={{ color: alumno.porcentajeAsistencia >= 75 ? '#48bb78' : '#e53e3e' }}>
                        {alumno.porcentajeAsistencia}%
                      </strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${alumno.porcentajeAsistencia}%`,
                          height: '100%',
                          backgroundColor: alumno.porcentajeAsistencia >= 75 ? '#48bb78' : '#e53e3e',
                          transition: 'width 0.3s'
                        }}
                      ></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', color: '#4b5563' }}>
                    <span>
                      <i className="fas fa-file-alt"></i> Total Notas: <strong>{alumno.totalNotas}</strong>
                    </span>
                  </div>
                </div>

                {/* Performance Level Badge */}
                <div style={{ marginBottom: '15px' }}>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: nivelConfig.color,
                      color: 'white',
                      fontSize: '0.9em',
                      padding: '6px 12px'
                    }}
                  >
                    <i className={`fas ${nivelConfig.icon}`}></i> {nivelConfig.label}
                  </span>
                </div>

                {/* Actions */}
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => handleVerDetalle(alumno)}
                >
                  <i className="fas fa-chart-line"></i>
                  <span>Ver Progreso Detallado</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Student Detail Modal */}
      {isDetailModalOpen && selectedAlumno && (
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
          onClick={() => setIsDetailModalOpen(false)}
        >
          <div
            className="modal-content card"
            style={{
              maxWidth: '900px',
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
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <h2 style={{ margin: 0 }}>
                <i className="fas fa-chart-line"></i> Progreso Detallado - {formatNombre(selectedAlumno)}
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Student Info */}
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>RUT</label>
                  <p style={{ margin: '4px 0 0', color: '#1f2937' }}>{selectedAlumno.rut}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>Curso</label>
                  <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                    {selectedAlumno.curso || selectedAlumno.cursoId}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>Promedio</label>
                  <p style={{ margin: '4px 0 0', color: '#1f2937', fontWeight: 'bold', fontSize: '1.2em' }}>
                    {selectedAlumno.promedio}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>Asistencia</label>
                  <p style={{ margin: '4px 0 0', color: '#1f2937', fontWeight: 'bold', fontSize: '1.2em' }}>
                    {selectedAlumno.porcentajeAsistencia}%
                  </p>
                </div>
              </div>
            </div>

            {/* Performance by Subject */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>
                <i className="fas fa-book"></i> Desempeño por Asignatura
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ASIGNATURAS.map(asignatura => {
                  const notasAsignatura = notas.filter(
                    nota => nota.rutAlumno === selectedAlumno.rut && nota.asignatura === asignatura.value
                  );
                  const promAsignatura = notasAsignatura.length > 0
                    ? calcularPromedioConceptual(notasAsignatura).toFixed(1)
                    : 'N/A';

                  return (
                    <div key={asignatura.value} style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '500' }}>{asignatura.label}</span>
                        <span style={{ fontWeight: 'bold', color: '#667eea' }}>
                          {promAsignatura} {notasAsignatura.length > 0 && `(${notasAsignatura.length} notas)`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline Summary */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>
                <i className="fas fa-timeline"></i> Resumen de Logros
              </h3>
              <div style={{ padding: '15px', backgroundColor: '#f0fdf4', borderLeft: '4px solid #48bb78', borderRadius: '4px' }}>
                <p style={{ margin: 0, color: '#166534' }}>
                  <i className="fas fa-check-circle"></i> <strong>Puntos Fuertes:</strong> El alumno muestra un desempeño {NIVELES_DESEMPENO[selectedAlumno.nivelDesempeno].label.toLowerCase()} con un promedio de {selectedAlumno.promedio}.
                </p>
              </div>
              {selectedAlumno.enRiesgo && (
                <div style={{ padding: '15px', backgroundColor: '#fef2f2', borderLeft: '4px solid #e53e3e', borderRadius: '4px', marginTop: '10px' }}>
                  <p style={{ margin: 0, color: '#991b1b' }}>
                    <i className="fas fa-exclamation-triangle"></i> <strong>Áreas de Atención:</strong> El alumno requiere apoyo adicional. {selectedAlumno.promedio < 4.0 ? 'Promedio bajo. ' : ''}{selectedAlumno.porcentajeAsistencia < 75 ? 'Asistencia irregular.' : ''}
                  </p>
                </div>
              )}
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
                onClick={() => setIsDetailModalOpen(false)}
              >
                <i className="fas fa-times"></i>
                <span>Cerrar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AvanceAlumnos;
