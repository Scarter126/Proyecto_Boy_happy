/**
 * Evaluaciones - Student Evaluations & Grades for Teachers
 *
 * Features:
 * - List all evaluations created by this teacher
 * - Filters: class, subject, date, evaluation type
 * - Statistics: average grade, pass/fail rate, grade distribution
 * - Create new evaluation with rubric
 * - Enter/edit grades for students
 * - Grade visualization (charts)
 * - Export grades to CSV
 */

import { useState, useMemo } from 'react';
import { useNotas, useCreateNota, useUpdateNota, useDeleteNota } from '../../hooks/useNotas';
import { useEvaluaciones, useCreateEvaluacion } from '../../hooks/useEvaluaciones';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import {
  useCursos,
  useAsignaturas,
  useTiposEvaluacionAcademica
} from '../../hooks/useConfiguracion';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre } from '../../utils/helpers';
import Swal from 'sweetalert2';

function Evaluaciones() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [searchTerm, setSearchTerm] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');
  const [asignaturaFilter, setAsignaturaFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGradesModalOpen, setIsGradesModalOpen] = useState(false);
  const [selectedEvaluacion, setSelectedEvaluacion] = useState(null);
  const [studentGrades, setStudentGrades] = useState({});

  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    asignatura: 'matematicas',
    tipo: 'prueba',
    curso: '',
    fecha: new Date().toISOString().split('T')[0],
    ponderacion: 100,
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: notas = [], isLoading: isLoadingNotas, refetch: refetchNotas } = useNotas();
  const { data: alumnos = [] } = useUsuariosPorRol('alumno');
  const { data: cursosConfig = [], isLoading: loadingCursos } = useCursos();
  const { data: ASIGNATURAS = [], isLoading: asignaturasLoading } = useAsignaturas();
  const { data: TIPOS_EVALUACION = [], isLoading: tiposLoading } = useTiposEvaluacionAcademica();
  const createNotaMutation = useCreateNota();
  const updateNotaMutation = useUpdateNota();
  const deleteNotaMutation = useDeleteNota();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Group notes by evaluation
  const evaluaciones = useMemo(() => {
    if (!Array.isArray(notas)) return [];

    const evaluacionesMap = new Map();

    notas.forEach(nota => {
      const key = `${nota.asignatura}-${nota.tipo}-${nota.fecha}`;
      if (!evaluacionesMap.has(key)) {
        evaluacionesMap.set(key, {
          id: key,
          titulo: nota.titulo || `${nota.tipo} - ${nota.asignatura}`,
          asignatura: nota.asignatura,
          tipo: nota.tipo,
          curso: nota.curso,
          fecha: nota.fecha,
          notas: [],
          descripcion: nota.descripcion
        });
      }
      evaluacionesMap.get(key).notas.push(nota);
    });

    return Array.from(evaluacionesMap.values());
  }, [notas]);

  const filteredEvaluaciones = useMemo(() => {
    return evaluaciones.filter(evaluacion => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || evaluacion.titulo?.toLowerCase().includes(searchLower);
      const matchesCurso = !cursoFilter || evaluacion.curso === cursoFilter;
      const matchesAsignatura = !asignaturaFilter || evaluacion.asignatura === asignaturaFilter;
      const matchesTipo = !tipoFilter || evaluacion.tipo === tipoFilter;
      const matchesDateFrom = !dateFrom || evaluacion.fecha >= dateFrom;
      const matchesDateTo = !dateTo || evaluacion.fecha <= dateTo;

      return matchesSearch && matchesCurso && matchesAsignatura && matchesTipo && matchesDateFrom && matchesDateTo;
    });
  }, [evaluaciones, searchTerm, cursoFilter, asignaturaFilter, tipoFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalEvaluaciones = evaluaciones.length;
    const totalNotas = notas.length;

    // Conceptual grade system (L, NL, OD, NT)
    const logrados = notas.filter(nota => nota.nivelLogro === 'L').length;
    const enDesarrollo = notas.filter(nota => nota.nivelLogro === 'OD').length;
    const tasaLogro = notas.length > 0 ? ((logrados / notas.length) * 100).toFixed(0) : 0;

    // Grade distribution for conceptual system
    const distribucion = {
      logrado: logrados,
      enDesarrollo: enDesarrollo,
      noLogrado: notas.filter(n => n.nivelLogro === 'NL').length,
      noTrabajado: notas.filter(n => n.nivelLogro === 'NT').length
    };

    return {
      totalEvaluaciones,
      totalNotas,
      tasaLogro, // Percentage of "Logrado" grades
      distribucion
    };
  }, [evaluaciones, notas]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleCreateEvaluacion = () => {
    setFormData({
      titulo: '',
      descripcion: '',
      asignatura: 'matematicas',
      tipo: 'prueba',
      curso: '',
      fecha: new Date().toISOString().split('T')[0],
      ponderacion: 100,
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.titulo.trim() || !formData.curso) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'El título y el curso son obligatorios'
      });
      return;
    }

    setIsModalOpen(false);

    // Get students from selected course
    const alumnosCurso = alumnos.filter(a => a.curso === formData.curso);

    if (alumnosCurso.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin alumnos',
        text: 'No hay alumnos en el curso seleccionado'
      });
      return;
    }

    // Open grades modal
    setSelectedEvaluacion(formData);
    const initialGrades = {};
    alumnosCurso.forEach(alumno => {
      initialGrades[alumno.rut] = '';
    });
    setStudentGrades(initialGrades);
    setIsGradesModalOpen(true);
  };

  const handleGradeChange = (rut, value) => {
    setStudentGrades(prev => ({
      ...prev,
      [rut]: value
    }));
  };

  const handleSaveGrades = async () => {
    try {
      const gradesToSave = Object.entries(studentGrades).filter(([_, nota]) => nota !== '');

      if (gradesToSave.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Sin notas',
          text: 'Debes ingresar al menos una nota'
        });
        return;
      }

      // Save all grades
      for (const [rut, nivelLogro] of gradesToSave) {
        await createNotaMutation.mutateAsync({
          rutAlumno: rut,
          asignatura: selectedEvaluacion.asignatura,
          nombreEvaluacion: selectedEvaluacion.titulo || `${selectedEvaluacion.tipo} - ${selectedEvaluacion.asignatura}`,
          nivelLogro: nivelLogro, // L, NL, OD, NT
          fecha: selectedEvaluacion.fecha,
          curso: selectedEvaluacion.curso,
          observaciones: selectedEvaluacion.descripcion || ''
        });
      }

      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: `${gradesToSave.length} notas guardadas correctamente`,
        timer: 2000
      });

      setIsGradesModalOpen(false);
      refetchNotas();
    } catch (error) {
      console.error('Error saving grades:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron guardar las notas'
      });
    }
  };

  const handleVerNotas = (evaluacion) => {
    setSelectedEvaluacion(evaluacion);
    const grades = {};
    evaluacion.notas.forEach(nota => {
      grades[nota.rutAlumno] = nota.nivelLogro;
    });
    setStudentGrades(grades);
    setIsGradesModalOpen(true);
  };

  const handleDeleteEvaluacion = async (evaluacion) => {
    const result = await Swal.fire({
      title: '¿Eliminar evaluación?',
      html: `<p>¿Estás seguro de eliminar <strong>${evaluacion.titulo}</strong> y todas sus notas?</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        // Delete all notes from this evaluation
        for (const nota of evaluacion.notas) {
          await deleteNotaMutation.mutateAsync(nota.id);
        }

        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'Evaluación eliminada correctamente',
          timer: 2000
        });

        refetchNotas();
      } catch (error) {
        console.error('Error deleting evaluation:', error);
      }
    }
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { cursoFilter, asignaturaFilter, tipoFilter, dateFrom, dateTo });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setCursoFilter('');
    setAsignaturaFilter('');
    setTipoFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Fecha', 'Evaluación', 'Asignatura', 'Tipo', 'Curso', 'Alumno', 'RUT', 'Nota'].join(','),
      ...filteredEvaluaciones.flatMap(evaluacion =>
        evaluacion.notas.map(nota => {
          const alumno = alumnos.find(a => a.rut === nota.alumno_id) || {};
          return [
            evaluacion.fecha,
            `"${evaluacion.titulo}"`,
            evaluacion.asignatura,
            evaluacion.tipo,
            evaluacion.curso,
            `"${formatNombre(alumno)}"`,
            nota.alumno_id,
            nota.nota
          ].join(',');
        })
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `evaluaciones_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    Swal.fire({
      icon: 'success',
      title: 'Exportado',
      text: 'Las calificaciones han sido exportadas exitosamente',
      timer: 2000
    });
  };

  // ==========================================
  // RENDER
  // ==========================================

  const isLoading = isLoadingNotas;

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Evaluaciones y Calificaciones"
        icon="fa-clipboard-check"
        buttonText="Nueva Evaluación"
        buttonIcon="fa-plus"
        buttonColor="primary"
        onButtonClick={handleCreateEvaluacion}
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clipboard-list"></i>
          </div>
          <div className="card-content">
            <h3>{stats.totalEvaluaciones}</h3>
            <p>Total Evaluaciones</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-chart-bar"></i>
          </div>
          <div className="card-content">
            <h3>{stats.tasaLogro}%</h3>
            <p>Tasa de Logro</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.distribucion.logrado}</h3>
            <p>Objetivos Logrados</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="card-content">
            <h3>{stats.totalNotas}</h3>
            <p>Total Notas Ingresadas</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Grade Distribution */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>
          <i className="fas fa-chart-pie"></i> Distribución de Evaluaciones Conceptuales
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div style={{ padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #48bb78' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#166534', fontWeight: '600' }}>
                <i className="fas fa-check-circle"></i> Logrado (L)
              </span>
              <strong style={{ color: '#48bb78', fontSize: '1.5em' }}>{stats.distribucion.logrado}</strong>
            </div>
          </div>
          <div style={{ padding: '15px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #667eea' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#1e40af', fontWeight: '600' }}>
                <i className="fas fa-spinner"></i> En Desarrollo (OD)
              </span>
              <strong style={{ color: '#667eea', fontSize: '1.5em' }}>{stats.distribucion.enDesarrollo}</strong>
            </div>
          </div>
          <div style={{ padding: '15px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #ecc94b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#92400e', fontWeight: '600' }}>
                <i className="fas fa-times-circle"></i> No Logrado (NL)
              </span>
              <strong style={{ color: '#ecc94b', fontSize: '1.5em' }}>{stats.distribucion.noLogrado}</strong>
            </div>
          </div>
          <div style={{ padding: '15px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #e53e3e' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#991b1b', fontWeight: '600' }}>
                <i className="fas fa-minus-circle"></i> No Trabajado (NT)
              </span>
              <strong style={{ color: '#e53e3e', fontSize: '1.5em' }}>{stats.distribucion.noTrabajado}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      >
        <div className="form-group" style={{ flex: '1 1 300px' }}>
          <label htmlFor="search">
            <i className="fas fa-search"></i> Buscar
          </label>
          <input
            id="search"
            type="text"
            placeholder="Buscar por título..."
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
            <option value="">{loadingCursos ? 'Cargando cursos...' : 'Todos los cursos'}</option>
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

        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="tipoFilter">
            <i className="fas fa-tag"></i> Tipo
          </label>
          <select
            id="tipoFilter"
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {TIPOS_EVALUACION.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
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
      <ActionBar count={filteredEvaluaciones.length}>
        <button
          className="btn btn-success"
          onClick={handleExportCSV}
          disabled={filteredEvaluaciones.length === 0}
        >
          <i className="fas fa-file-csv"></i>
          <span>Exportar CSV</span>
        </button>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando evaluaciones...</h3>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredEvaluaciones.length === 0 && (
        <EmptyStateCard
          icon="fa-clipboard-check"
          title="No hay evaluaciones registradas"
          description="Comienza creando tu primera evaluación"
          iconColor="#667eea"
          actionText="Nueva Evaluación"
          onAction={handleCreateEvaluacion}
        />
      )}

      {/* Evaluations List */}
      {!isLoading && filteredEvaluaciones.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '20px'
          }}
        >
          {filteredEvaluaciones.map((evaluacion) => {
            const tipoConfig = TIPOS_EVALUACION.find(t => t.value === evaluacion.tipo);

            // Calculate conceptual grade distribution for this evaluation
            const logrados = evaluacion.notas.filter(n => n.nivelLogro === 'L').length;
            const tasaLogro = evaluacion.notas.length > 0
              ? `${logrados}/${evaluacion.notas.length} (${((logrados / evaluacion.notas.length) * 100).toFixed(0)}%)`
              : 'N/A';

            return (
              <div key={evaluacion.id} className="card" style={{ padding: '20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1em' }}>
                      {evaluacion.titulo}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85em', color: '#6b7280' }}>
                      {ASIGNATURAS.find(a => a.value === evaluacion.asignatura)?.label || evaluacion.asignatura}
                    </p>
                  </div>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: '#667eea',
                      color: 'white'
                    }}
                  >
                    <i className={`fas ${tipoConfig?.icon || 'fa-file'}`}></i> {tipoConfig?.label || evaluacion.tipo}
                  </span>
                </div>

                {/* Content */}
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-calendar" style={{ width: '20px' }}></i>
                      <strong>Fecha:</strong> {formatDate(evaluacion.fecha)}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-school" style={{ width: '20px' }}></i>
                      <strong>Curso:</strong> {cursosConfig.find(c => c.codigo === evaluacion.curso)?.nombre || evaluacion.curso}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-users" style={{ width: '20px' }}></i>
                      <strong>Notas:</strong> {evaluacion.notas.length} alumno(s)
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-check-circle" style={{ width: '20px' }}></i>
                      <strong>Logrados:</strong>{' '}
                      <span style={{
                        fontWeight: 'bold',
                        color: '#48bb78'
                      }}>
                        {tasaLogro}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => handleVerNotas(evaluacion)}
                  >
                    <i className="fas fa-edit"></i>
                    <span>Ver/Editar Notas</span>
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteEvaluacion(evaluacion)}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Evaluation Modal */}
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
                <i className="fas fa-plus"></i> Nueva Evaluación
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
                  <label htmlFor="titulo">
                    Título <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="titulo"
                    type="text"
                    name="titulo"
                    value={formData.titulo}
                    onChange={handleInputChange}
                    placeholder="Ej: Prueba Unidad 1 - Números"
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="descripcion">
                    Descripción
                  </label>
                  <textarea
                    id="descripcion"
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    placeholder="Describe el contenido de la evaluación..."
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="asignatura">
                    Asignatura <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="asignatura"
                    name="asignatura"
                    value={formData.asignatura}
                    onChange={handleInputChange}
                    required
                  >
                    {ASIGNATURAS.map(asignatura => (
                      <option key={asignatura.value} value={asignatura.value}>{asignatura.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="tipo">
                    Tipo <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="tipo"
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleInputChange}
                    required
                  >
                    {TIPOS_EVALUACION.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="curso">
                    Curso <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="curso"
                    name="curso"
                    value={formData.curso}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">{loadingCursos ? 'Cargando cursos...' : 'Seleccionar curso'}</option>
                    {cursosConfig.map((curso) => (
                      <option key={curso.codigo} value={curso.nombre}>
                        {curso.nombre}
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
                >
                  <i className="fas fa-times"></i>
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  <i className="fas fa-arrow-right"></i>
                  <span>Siguiente: Ingresar Notas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grades Entry Modal */}
      {isGradesModalOpen && selectedEvaluacion && (
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
          onClick={() => setIsGradesModalOpen(false)}
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
                  <i className="fas fa-edit"></i> Ingresar Calificaciones
                </h2>
                <p style={{ margin: '5px 0 0', color: '#6b7280', fontSize: '0.9em' }}>
                  {selectedEvaluacion.titulo}
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setIsGradesModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {alumnos
                  .filter(a => a.curso === selectedEvaluacion.curso)
                  .map(alumno => (
                    <div
                      key={alumno.rut}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong>{formatNombre(alumno)}</strong>
                        <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: '#6b7280' }}>
                          {alumno.rut}
                        </p>
                      </div>
                      <div style={{ width: '150px' }}>
                        <select
                          value={studentGrades[alumno.rut] || ''}
                          onChange={(e) => handleGradeChange(alumno.rut, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="">Seleccionar...</option>
                          <option value="L">L - Logrado</option>
                          <option value="NL">NL - No Logrado</option>
                          <option value="OD">OD - En Desarrollo</option>
                          <option value="NT">NT - No Trabajado</option>
                        </select>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsGradesModalOpen(false)}
              >
                <i className="fas fa-times"></i>
                <span>Cancelar</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveGrades}
                disabled={createNotaMutation.isPending}
              >
                {createNotaMutation.isPending ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-save"></i>
                )}
                <span>Guardar Notas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Evaluaciones;
