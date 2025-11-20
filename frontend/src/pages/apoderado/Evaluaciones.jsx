/**
 * Evaluaciones Page - Boy Happy (Apoderado)
 *
 * READ ONLY page for parents to view their children's grades/evaluations
 *
 * Features:
 * - Select child dropdown
 * - Show evaluations in table
 * - Filter by subject and period
 * - Statistics and charts
 * - Loading and error states
 */

import { useState, useMemo } from 'react';
import { useHijos } from '../../hooks/useHijos';
import { useEvaluacionesAlumno } from '../../hooks/useEvaluaciones';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre } from '../../utils/helpers';

function Evaluaciones() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [selectedHijo, setSelectedHijo] = useState('');
  const [asignaturaFilter, setAsignaturaFilter] = useState('');
  const [periodoFilter, setPeriodoFilter] = useState('');

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: hijos = [] } = useHijos();
  const { data: evaluaciones = [], isLoading, isError, error, refetch } = useEvaluacionesAlumno(selectedHijo);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Get unique asignaturas and periodos
  const asignaturasDisponibles = useMemo(() => {
    if (!Array.isArray(evaluaciones)) return [];
    const asignaturas = [...new Set(evaluaciones.map(e => e.asignatura).filter(Boolean))];
    return asignaturas.sort();
  }, [evaluaciones]);

  const periodosDisponibles = useMemo(() => {
    if (!Array.isArray(evaluaciones)) return [];
    const periodos = [...new Set(evaluaciones.map(e => e.periodo).filter(Boolean))];
    return periodos.sort();
  }, [evaluaciones]);

  // Filter evaluaciones
  const filteredEvaluaciones = useMemo(() => {
    if (!Array.isArray(evaluaciones)) return [];

    return evaluaciones.filter(evaluacion => {
      const matchesAsignatura = !asignaturaFilter || evaluacion.asignatura === asignaturaFilter;
      const matchesPeriodo = !periodoFilter || evaluacion.periodo === periodoFilter;
      return matchesAsignatura && matchesPeriodo;
    });
  }, [evaluaciones, asignaturaFilter, periodoFilter]);

  // Calculate statistics using conceptual grading (L, NL, OD, NT)
  const stats = useMemo(() => {
    if (!Array.isArray(filteredEvaluaciones) || filteredEvaluaciones.length === 0) {
      return { total: 0, logrados: 0, noLogrados: 0, enDesarrollo: 0, noTrabajados: 0, tasaLogro: 0 };
    }

    const total = filteredEvaluaciones.length;
    const logrados = filteredEvaluaciones.filter(e => e.nivelLogro === 'L').length;
    const noLogrados = filteredEvaluaciones.filter(e => e.nivelLogro === 'NL').length;
    const enDesarrollo = filteredEvaluaciones.filter(e => e.nivelLogro === 'OD').length;
    const noTrabajados = filteredEvaluaciones.filter(e => e.nivelLogro === 'NT').length;
    const tasaLogro = total > 0 ? Math.round((logrados / total) * 100) : 0;

    return { total, logrados, noLogrados, enDesarrollo, noTrabajados, tasaLogro };
  }, [filteredEvaluaciones]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleClearFilters = () => {
    setAsignaturaFilter('');
    setPeriodoFilter('');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Fecha', 'Asignatura', 'Evaluación', 'Nivel de Logro', 'Tipo', 'Observaciones'].join(','),
      ...filteredEvaluaciones.map(evaluacion => [
        evaluacion.fecha || '',
        evaluacion.asignatura || '',
        evaluacion.titulo || evaluacion.nombre || '',
        evaluacion.nivelLogro || '',
        evaluacion.tipo || '',
        (evaluacion.observaciones || '').replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `evaluaciones_${selectedHijo}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Get nivel logro badge color for conceptual grading
  const getNivelLogroColor = (nivelLogro) => {
    switch (nivelLogro) {
      case 'L': return 'success'; // Logrado - Green
      case 'OD': return 'info'; // En Desarrollo - Blue
      case 'NL': return 'warning'; // No Logrado - Orange
      case 'NT': return 'default'; // No Trabajado - Gray
      default: return 'default';
    }
  };

  const getNivelLogroLabel = (nivelLogro) => {
    switch (nivelLogro) {
      case 'L': return 'Logrado';
      case 'OD': return 'En Desarrollo';
      case 'NL': return 'No Logrado';
      case 'NT': return 'No Trabajado';
      default: return '-';
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Evaluaciones de mis Hijos"
        icon="fa-chart-line"
      />

      {/* Child Selection */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="hijoSelect">
            <i className="fas fa-child"></i> Seleccionar Hijo
          </label>
          <select
            id="hijoSelect"
            value={selectedHijo}
            onChange={(e) => setSelectedHijo(e.target.value)}
            style={{ fontSize: '1.1em', padding: '12px' }}
          >
            <option value="">-- Seleccione un hijo --</option>
            {hijos.map(hijo => (
              <option key={hijo.alumnoRut} value={hijo.alumnoRut}>
                {hijo.nombreAlumno || hijo.alumnoRut} - {hijo.curso || 'Sin curso'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Show content only if a child is selected */}
      {selectedHijo && (
        <>
          {/* Statistics Cards - Conceptual Grading */}
          <StatCardGrid>
            <div className="indicator-card">
              <div className="card-icon">
                <i className="fas fa-file-alt"></i>
              </div>
              <div className="card-content">
                <h3>{stats.total}</h3>
                <p>Total Evaluaciones</p>
              </div>
            </div>

            <div className="indicator-card">
              <div className="card-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <div className="card-content">
                <h3>{stats.tasaLogro}%</h3>
                <p>Tasa de Logro</p>
              </div>
            </div>

            <div className="indicator-card" style={{ backgroundColor: '#d1fae5' }}>
              <div className="card-icon">
                <i className="fas fa-check-circle"></i>
              </div>
              <div className="card-content">
                <h3>{stats.logrados}</h3>
                <p>Logrados (L)</p>
              </div>
            </div>

            <div className="indicator-card" style={{ backgroundColor: '#dbeafe' }}>
              <div className="card-icon">
                <i className="fas fa-sync-alt"></i>
              </div>
              <div className="card-content">
                <h3>{stats.enDesarrollo}</h3>
                <p>En Desarrollo (OD)</p>
              </div>
            </div>

            <div className="indicator-card" style={{ backgroundColor: '#fed7aa' }}>
              <div className="card-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div className="card-content">
                <h3>{stats.noLogrados}</h3>
                <p>No Logrados (NL)</p>
              </div>
            </div>

            <div className="indicator-card" style={{ backgroundColor: '#e5e7eb' }}>
              <div className="card-icon">
                <i className="fas fa-minus-circle"></i>
              </div>
              <div className="card-content">
                <h3>{stats.noTrabajados}</h3>
                <p>No Trabajados (NT)</p>
              </div>
            </div>
          </StatCardGrid>

          {/* Filter Panel */}
          <FilterPanel onClearFilters={handleClearFilters}>
            {/* Asignatura filter */}
            <div className="form-group" style={{ flex: '1 1 250px' }}>
              <label htmlFor="asignaturaFilter">
                <i className="fas fa-book"></i> Asignatura
              </label>
              <select
                id="asignaturaFilter"
                value={asignaturaFilter}
                onChange={(e) => setAsignaturaFilter(e.target.value)}
              >
                <option value="">Todas las asignaturas</option>
                {asignaturasDisponibles.map(asignatura => (
                  <option key={asignatura} value={asignatura}>{asignatura}</option>
                ))}
              </select>
            </div>

            {/* Periodo filter */}
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label htmlFor="periodoFilter">
                <i className="fas fa-calendar"></i> Periodo
              </label>
              <select
                id="periodoFilter"
                value={periodoFilter}
                onChange={(e) => setPeriodoFilter(e.target.value)}
              >
                <option value="">Todos los periodos</option>
                {periodosDisponibles.map(periodo => (
                  <option key={periodo} value={periodo}>{periodo}</option>
                ))}
              </select>
            </div>
          </FilterPanel>

          {/* Action Bar */}
          <ActionBar count={filteredEvaluaciones.length}>
            <button
              className="btn btn-success"
              onClick={handleExportCSV}
              disabled={filteredEvaluaciones.length === 0}
            >
              <i className="fas fa-download"></i>
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

          {/* Error State */}
          {isError && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
              <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar evaluaciones</h3>
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
          {!isLoading && !isError && filteredEvaluaciones.length === 0 && (
            <EmptyStateCard
              icon="fa-file-alt"
              title="No hay evaluaciones"
              description={
                asignaturaFilter || periodoFilter
                  ? 'Intenta ajustar los filtros'
                  : 'No hay evaluaciones registradas para este alumno'
              }
              iconColor="#667eea"
            />
          )}

          {/* Evaluations Table */}
          {!isLoading && !isError && filteredEvaluaciones.length > 0 && (
            <div className="card">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Asignatura</th>
                      <th>Evaluación</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'center' }}>Nivel de Logro</th>
                      <th>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvaluaciones.map((evaluacion) => (
                      <tr key={evaluacion.id}>
                        {/* Fecha */}
                        <td>
                          <i className="fas fa-calendar"></i>
                          {' '}
                          {formatDate(evaluacion.fecha)}
                        </td>

                        {/* Asignatura */}
                        <td>
                          <strong>{evaluacion.asignatura}</strong>
                        </td>

                        {/* Titulo/Nombre */}
                        <td>{evaluacion.titulo || evaluacion.nombre || '-'}</td>

                        {/* Tipo */}
                        <td>
                          <span className="badge badge-default">{evaluacion.tipo || '-'}</span>
                        </td>

                        {/* Nivel Logro Badge */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge badge-${getNivelLogroColor(evaluacion.nivelLogro)}`}
                            style={{ fontSize: '1.1em', padding: '6px 12px' }}
                          >
                            {evaluacion.nivelLogro || '-'} {evaluacion.nivelLogro && `- ${getNivelLogroLabel(evaluacion.nivelLogro)}`}
                          </span>
                        </td>

                        {/* Observaciones */}
                        <td>
                          {evaluacion.observaciones ? (
                            <span>{evaluacion.observaciones}</span>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress by Subject - Conceptual Grading */}
          {!isLoading && !isError && filteredEvaluaciones.length > 0 && !asignaturaFilter && (
            <div className="card" style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '20px' }}>
                <i className="fas fa-chart-bar"></i> Tasa de Logro por Asignatura
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                {asignaturasDisponibles.map(asignatura => {
                  const evaluacionesAsignatura = filteredEvaluaciones.filter(e => e.asignatura === asignatura);

                  if (evaluacionesAsignatura.length === 0) return null;

                  const logrados = evaluacionesAsignatura.filter(e => e.nivelLogro === 'L').length;
                  const tasaLogro = Math.round((logrados / evaluacionesAsignatura.length) * 100);
                  const color = tasaLogro >= 70 ? '#48bb78' : tasaLogro >= 50 ? '#f59e0b' : '#e53e3e';

                  // Distribución de niveles
                  const distribucion = {
                    L: evaluacionesAsignatura.filter(e => e.nivelLogro === 'L').length,
                    OD: evaluacionesAsignatura.filter(e => e.nivelLogro === 'OD').length,
                    NL: evaluacionesAsignatura.filter(e => e.nivelLogro === 'NL').length,
                    NT: evaluacionesAsignatura.filter(e => e.nivelLogro === 'NT').length
                  };

                  return (
                    <div
                      key={asignatura}
                      style={{
                        padding: '15px',
                        backgroundColor: '#f7fafc',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${color}`
                      }}
                    >
                      <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '5px' }}>
                        {asignatura}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '2em', fontWeight: 'bold', color }}>
                          {tasaLogro}%
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9em' }}>
                          ({evaluacionesAsignatura.length} evaluaciones)
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.85em', flexWrap: 'wrap' }}>
                        <span style={{ color: '#48bb78' }}>L: {distribucion.L}</span>
                        <span style={{ color: '#3b82f6' }}>OD: {distribucion.OD}</span>
                        <span style={{ color: '#f59e0b' }}>NL: {distribucion.NL}</span>
                        <span style={{ color: '#9ca3af' }}>NT: {distribucion.NT}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* No child selected message */}
      {!selectedHijo && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-child fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Seleccione un hijo</h3>
          <p style={{ color: '#999', marginTop: '10px' }}>
            Por favor seleccione un hijo para ver sus evaluaciones
          </p>
        </div>
      )}
    </div>
  );
}

export default Evaluaciones;
