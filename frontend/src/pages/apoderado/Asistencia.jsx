/**
 * Asistencia Page - Boy Happy (Apoderado)
 *
 * READ ONLY page for parents to view their children's attendance
 *
 * Features:
 * - Select child dropdown
 * - View attendance records in table
 * - Filter by date range
 * - Statistics (present, absent, late, justified)
 * - Loading and error states
 */

import { useState, useMemo } from 'react';
import { useHijos } from '../../hooks/useHijos';
import { useAsistenciaAlumno } from '../../hooks/useAsistencia';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre } from '../../utils/helpers';

function Asistencia() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [selectedHijo, setSelectedHijo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: hijos = [] } = useHijos();
  const { data: asistencia = [], isLoading, isError, error, refetch } = useAsistenciaAlumno(selectedHijo);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Filter asistencia by date range
  const filteredAsistencia = useMemo(() => {
    if (!Array.isArray(asistencia)) return [];

    return asistencia.filter(registro => {
      const registroDate = new Date(registro.fecha);
      const matchesDateFrom = !dateFrom || registroDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || registroDate <= new Date(dateTo);
      return matchesDateFrom && matchesDateTo;
    });
  }, [asistencia, dateFrom, dateTo]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!Array.isArray(filteredAsistencia)) {
      return { total: 0, presente: 0, ausente: 0, tarde: 0, justificado: 0, porcentaje: 0 };
    }

    const total = filteredAsistencia.length;
    const presente = filteredAsistencia.filter(a => a.estado === 'presente').length;
    const ausente = filteredAsistencia.filter(a => a.estado === 'ausente').length;
    const tarde = filteredAsistencia.filter(a => a.estado === 'tarde').length;
    const justificado = filteredAsistencia.filter(a => a.estado === 'justificado').length;
    const porcentaje = total > 0 ? Math.round((presente / total) * 100) : 0;

    return { total, presente, ausente, tarde, justificado, porcentaje };
  }, [filteredAsistencia]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Fecha', 'Estado', 'Observaciones'].join(','),
      ...filteredAsistencia.map(registro => [
        registro.fecha,
        registro.estado,
        (registro.observaciones || '').replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `asistencia_${selectedHijo}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Get estado badge color
  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'presente': return 'success';
      case 'ausente': return 'danger';
      case 'tarde': return 'warning';
      case 'justificado': return 'info';
      default: return 'default';
    }
  };

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'presente': return 'fa-check-circle';
      case 'ausente': return 'fa-times-circle';
      case 'tarde': return 'fa-clock';
      case 'justificado': return 'fa-file-medical';
      default: return 'fa-circle';
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Asistencia de mis Hijos"
        icon="fa-calendar-check"
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
              <option key={hijo.rut} value={hijo.rut}>
                {formatNombre(hijo)} - {hijo.curso || 'Sin curso'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Show content only if a child is selected */}
      {selectedHijo && (
        <>
          {/* Statistics Cards */}
          <StatCardGrid>
            <div className="indicator-card">
              <div className="card-icon">
                <i className="fas fa-calendar-check"></i>
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
                <i className="fas fa-percentage"></i>
              </div>
              <div className="card-content">
                <h3>{stats.porcentaje}%</h3>
                <p>Asistencia</p>
              </div>
            </div>
          </StatCardGrid>

          {/* Filter Panel */}
          <FilterPanel onClearFilters={handleClearFilters}>
            {/* Date from */}
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

            {/* Date to */}
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
          <ActionBar count={filteredAsistencia.length}>
            <button
              className="btn btn-success"
              onClick={handleExportCSV}
              disabled={filteredAsistencia.length === 0}
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

          {/* Empty State */}
          {!isLoading && !isError && filteredAsistencia.length === 0 && (
            <EmptyStateCard
              icon="fa-calendar-check"
              title="No hay registros de asistencia"
              description={
                dateFrom || dateTo
                  ? 'Intenta ajustar el rango de fechas'
                  : 'No hay registros de asistencia para este alumno'
              }
              iconColor="#667eea"
            />
          )}

          {/* Attendance Table */}
          {!isLoading && !isError && filteredAsistencia.length > 0 && (
            <div className="card">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAsistencia.map((registro) => (
                      <tr key={registro.id}>
                        {/* Fecha */}
                        <td>
                          <i className="fas fa-calendar"></i>
                          {' '}
                          {formatDate(registro.fecha, 'long')}
                        </td>

                        {/* Estado Badge */}
                        <td>
                          <span className={`badge badge-${getEstadoColor(registro.estado)}`}>
                            <i className={`fas ${getEstadoIcon(registro.estado)}`}></i>
                            {' '}
                            {registro.estado.charAt(0).toUpperCase() + registro.estado.slice(1)}
                          </span>
                        </td>

                        {/* Observaciones */}
                        <td>
                          {registro.observaciones ? (
                            <span>{registro.observaciones}</span>
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
        </>
      )}

      {/* No child selected message */}
      {!selectedHijo && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-child fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Seleccione un hijo</h3>
          <p style={{ color: '#999', marginTop: '10px' }}>
            Por favor seleccione un hijo para ver su asistencia
          </p>
        </div>
      )}
    </div>
  );
}

export default Asistencia;
