/**
 * Evaluaciones - Speech Evaluations Management
 *
 * Features:
 * - List evaluations performed
 * - Filter by student, date, evaluation type
 * - Create new evaluation
 * - Edit/view evaluation details
 * - Evaluation results visualization
 */

import { useState, useMemo } from 'react';
import { useEvaluaciones } from '../../hooks/useEvaluaciones';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import {
  useTiposEvaluacionFono,
  useAreasEvaluacionFono
} from '../../hooks/useConfiguracion';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre, getIniciales } from '../../utils/helpers';
import Swal from 'sweetalert2';

function Evaluaciones() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [searchTerm, setSearchTerm] = useState('');
  const [alumnoFilter, setAlumnoFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvaluacion, setEditingEvaluacion] = useState(null);
  const [selectedEvaluacion, setSelectedEvaluacion] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    alumno_id: '',
    tipo: 'inicial',
    area: 'articulacion',
    fecha: new Date().toISOString().split('T')[0],
    puntuacion: '',
    nivel: 'intermedio',
    observaciones: '',
    recomendaciones: '',
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const evaluacionesFilters = useMemo(() => {
    const filters = {};

    if (alumnoFilter) filters.alumno_id = alumnoFilter;
    if (tipoFilter) filters.tipo = tipoFilter;
    if (areaFilter) filters.area = areaFilter;
    if (dateFrom) filters.fechaDesde = dateFrom;
    if (dateTo) filters.fechaHasta = dateTo;

    return filters;
  }, [alumnoFilter, tipoFilter, areaFilter, dateFrom, dateTo]);

  const { data: evaluaciones = [], isLoading, isError, error, refetch } = useEvaluaciones(evaluacionesFilters);
  const { data: alumnos = [] } = useUsuariosPorRol('alumno');
  const { data: TIPOS_EVALUACION = [], isLoading: tiposLoading } = useTiposEvaluacionFono();
  const { data: AREAS_EVALUACION = [], isLoading: areasLoading } = useAreasEvaluacionFono();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const filteredEvaluaciones = useMemo(() => {
    if (!Array.isArray(evaluaciones)) return [];

    return evaluaciones.filter(evaluacion => {
      const searchLower = searchTerm.toLowerCase();
      const alumno = alumnos.find(a => a.rut === evaluacion.alumno_id) || {};
      const nombreCompleto = formatNombre(alumno).toLowerCase();

      const matchesSearch = !searchTerm ||
        nombreCompleto.includes(searchLower) ||
        evaluacion.tipo?.toLowerCase().includes(searchLower) ||
        evaluacion.area?.toLowerCase().includes(searchLower);

      return matchesSearch;
    });
  }, [evaluaciones, searchTerm, alumnos]);

  const stats = useMemo(() => {
    if (!Array.isArray(evaluaciones)) return { total: 0, porTipo: {}, porNivel: {} };

    const porTipo = evaluaciones.reduce((acc, ev) => {
      acc[ev.tipo] = (acc[ev.tipo] || 0) + 1;
      return acc;
    }, {});

    const porNivel = evaluaciones.reduce((acc, ev) => {
      acc[ev.nivel] = (acc[ev.nivel] || 0) + 1;
      return acc;
    }, {});

    const promedioPuntuacion = evaluaciones.length > 0
      ? (evaluaciones.reduce((sum, ev) => sum + (parseFloat(ev.puntuacion) || 0), 0) / evaluaciones.length).toFixed(1)
      : 0;

    return {
      total: evaluaciones.length,
      porTipo,
      porNivel,
      promedioPuntuacion
    };
  }, [evaluaciones]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleCreateEvaluacion = () => {
    setEditingEvaluacion(null);
    setFormData({
      alumno_id: '',
      tipo: 'inicial',
      area: 'articulacion',
      fecha: new Date().toISOString().split('T')[0],
      puntuacion: '',
      nivel: 'intermedio',
      observaciones: '',
      recomendaciones: '',
    });
    setIsModalOpen(true);
  };

  const handleEditEvaluacion = (evaluacion) => {
    setEditingEvaluacion(evaluacion);
    setFormData({
      alumno_id: evaluacion.alumno_id || '',
      tipo: evaluacion.tipo || 'inicial',
      area: evaluacion.area || 'articulacion',
      fecha: evaluacion.fecha || new Date().toISOString().split('T')[0],
      puntuacion: evaluacion.puntuacion || '',
      nivel: evaluacion.nivel || 'intermedio',
      observaciones: evaluacion.observaciones || '',
      recomendaciones: evaluacion.recomendaciones || '',
    });
    setIsModalOpen(true);
  };

  const handleVerDetalle = (evaluacion) => {
    setSelectedEvaluacion(evaluacion);
    setIsDetailModalOpen(true);
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      Swal.fire({
        icon: 'success',
        title: 'Exito',
        text: `Evaluacion ${editingEvaluacion ? 'actualizada' : 'registrada'} correctamente`,
        timer: 2000
      });

      setIsModalOpen(false);
      refetch();
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar la evaluacion'
      });
    }
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { alumnoFilter, tipoFilter, areaFilter, dateFrom, dateTo });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setAlumnoFilter('');
    setTipoFilter('');
    setAreaFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Fecha', 'Alumno', 'RUT', 'Tipo', 'Area', 'Puntuacion', 'Nivel', 'Observaciones'].join(','),
      ...filteredEvaluaciones.map(ev => {
        const alumno = alumnos.find(a => a.rut === ev.alumno_id) || {};
        return [
          ev.fecha,
          `"${formatNombre(alumno)}"`,
          ev.alumno_id,
          ev.tipo,
          ev.area,
          ev.puntuacion || '-',
          ev.nivel,
          `"${(ev.observaciones || '').replace(/,/g, ';')}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `evaluaciones_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Evaluaciones Fonoaudiologicas"
        icon="fa-clipboard-check"
        buttonText="Nueva Evaluacion"
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
            <h3>{stats.total}</h3>
            <p>Total Evaluaciones</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-file-medical"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.inicial || 0}</h3>
            <p>Evaluaciones Iniciales</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.seguimiento || 0}</h3>
            <p>Seguimientos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-star"></i>
          </div>
          <div className="card-content">
            <h3>{stats.promedioPuntuacion}</h3>
            <p>Puntuacion Promedio</p>
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
            <i className="fas fa-search"></i> Buscar
          </label>
          <input
            id="search"
            type="text"
            placeholder="Buscar por alumno, tipo, area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
          <label htmlFor="areaFilter">
            <i className="fas fa-brain"></i> Area
          </label>
          <select
            id="areaFilter"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          >
            <option value="">Todas las areas</option>
            {AREAS_EVALUACION.map(area => (
              <option key={area.value} value={area.value}>{area.label}</option>
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
          icon="fa-clipboard-check"
          title="No hay evaluaciones registradas"
          description="Comienza registrando tu primera evaluacion fonoaudiologica"
          iconColor="#667eea"
          actionText="Nueva Evaluacion"
          onAction={handleCreateEvaluacion}
        />
      )}

      {/* Evaluations Grid */}
      {!isLoading && !isError && filteredEvaluaciones.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '20px'
          }}
        >
          {filteredEvaluaciones.map((evaluacion) => {
            const alumno = alumnos.find(a => a.rut === evaluacion.alumno_id) || {};
            const tipoConfig = TIPOS_EVALUACION.find(t => t.value === evaluacion.tipo);

            return (
              <div key={evaluacion.id} className="card" style={{ padding: '20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: '#667eea',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          fontWeight: 'bold'
                        }}
                      >
                        {getIniciales(formatNombre(alumno))}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1em' }}>
                          {formatNombre(alumno)}
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '0.85em', color: '#6b7280' }}>
                          {evaluacion.alumno_id}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: tipoConfig?.color || '#667eea',
                      color: 'white'
                    }}
                  >
                    {tipoConfig?.label || evaluacion.tipo}
                  </span>
                </div>

                {/* Content */}
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-brain" style={{ width: '20px' }}></i>
                      <strong>Area:</strong> {AREAS_EVALUACION.find(a => a.value === evaluacion.area)?.label || evaluacion.area}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-calendar" style={{ width: '20px' }}></i>
                      <strong>Fecha:</strong> {formatDate(evaluacion.fecha)}
                    </div>
                    {evaluacion.puntuacion && (
                      <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                        <i className="fas fa-star" style={{ width: '20px' }}></i>
                        <strong>Puntuacion:</strong> {evaluacion.puntuacion}
                      </div>
                    )}
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-signal" style={{ width: '20px' }}></i>
                      <strong>Nivel:</strong>{' '}
                      <span
                        className={`badge badge-${
                          evaluacion.nivel === 'avanzado' ? 'success' :
                          evaluacion.nivel === 'intermedio' ? 'warning' :
                          'danger'
                        }`}
                      >
                        {evaluacion.nivel}
                      </span>
                    </div>
                  </div>

                  {evaluacion.observaciones && (
                    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                      <p style={{ margin: 0, fontSize: '0.85em', color: '#4b5563', fontStyle: 'italic' }}>
                        {evaluacion.observaciones.length > 100
                          ? evaluacion.observaciones.substring(0, 100) + '...'
                          : evaluacion.observaciones}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => handleVerDetalle(evaluacion)}
                  >
                    <i className="fas fa-eye"></i>
                    <span>Ver Detalle</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleEditEvaluacion(evaluacion)}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Evaluation Modal */}
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
                <i className={`fas ${editingEvaluacion ? 'fa-edit' : 'fa-plus'}`}></i>
                {' '}
                {editingEvaluacion ? 'Editar Evaluacion' : 'Nueva Evaluacion'}
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
                  <label htmlFor="tipo">
                    Tipo de Evaluacion <span style={{ color: '#e53e3e' }}>*</span>
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
                  <label htmlFor="area">
                    Area <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="area"
                    name="area"
                    value={formData.area}
                    onChange={handleInputChange}
                    required
                  >
                    {AREAS_EVALUACION.map(area => (
                      <option key={area.value} value={area.value}>{area.label}</option>
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
                  <label htmlFor="puntuacion">
                    Puntuacion
                  </label>
                  <input
                    id="puntuacion"
                    type="number"
                    name="puntuacion"
                    value={formData.puntuacion}
                    onChange={handleInputChange}
                    placeholder="Ej: 85"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="nivel">
                    Nivel Alcanzado <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="nivel"
                    name="nivel"
                    value={formData.nivel}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="inicial">Inicial</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="avanzado">Avanzado</option>
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
                    placeholder="Describe los hallazgos de la evaluacion..."
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="recomendaciones">
                    Recomendaciones
                  </label>
                  <textarea
                    id="recomendaciones"
                    name="recomendaciones"
                    value={formData.recomendaciones}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Recomendaciones y plan de trabajo..."
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
                  <i className="fas fa-save"></i>
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evaluation Detail Modal */}
      {isDetailModalOpen && selectedEvaluacion && (
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
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <h2 style={{ margin: 0 }}>
                <i className="fas fa-clipboard-check"></i> Detalle de Evaluacion
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Student Info */}
              <div>
                <h3 style={{ marginBottom: '10px', color: '#1f2937', fontSize: '1.1em' }}>
                  <i className="fas fa-user"></i> Alumno
                </h3>
                <p style={{ margin: 0, color: '#1f2937', fontSize: '1.1em' }}>
                  {formatNombre(alumnos.find(a => a.rut === selectedEvaluacion.alumno_id) || {})}
                </p>
                <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
                  RUT: {selectedEvaluacion.alumno_id}
                </p>
              </div>

              {/* Evaluation Info */}
              <div>
                <h3 style={{ marginBottom: '10px', color: '#1f2937', fontSize: '1.1em' }}>
                  <i className="fas fa-info-circle"></i> Informacion de la Evaluacion
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Tipo
                    </label>
                    <p style={{ margin: '4px 0 0' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: TIPOS_EVALUACION.find(t => t.value === selectedEvaluacion.tipo)?.color || '#667eea',
                          color: 'white'
                        }}
                      >
                        {TIPOS_EVALUACION.find(t => t.value === selectedEvaluacion.tipo)?.label || selectedEvaluacion.tipo}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Area
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {AREAS_EVALUACION.find(a => a.value === selectedEvaluacion.area)?.label || selectedEvaluacion.area}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Fecha
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {formatDate(selectedEvaluacion.fecha)}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Puntuacion
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {selectedEvaluacion.puntuacion || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Nivel
                    </label>
                    <p style={{ margin: '4px 0 0' }}>
                      <span
                        className={`badge badge-${
                          selectedEvaluacion.nivel === 'avanzado' ? 'success' :
                          selectedEvaluacion.nivel === 'intermedio' ? 'warning' :
                          'danger'
                        }`}
                      >
                        {selectedEvaluacion.nivel}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Observations */}
              {selectedEvaluacion.observaciones && (
                <div>
                  <h3 style={{ marginBottom: '10px', color: '#1f2937', fontSize: '1.1em' }}>
                    <i className="fas fa-comment"></i> Observaciones
                  </h3>
                  <p style={{ margin: 0, color: '#4b5563', lineHeight: '1.6' }}>
                    {selectedEvaluacion.observaciones}
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {selectedEvaluacion.recomendaciones && (
                <div>
                  <h3 style={{ marginBottom: '10px', color: '#1f2937', fontSize: '1.1em' }}>
                    <i className="fas fa-lightbulb"></i> Recomendaciones
                  </h3>
                  <p style={{ margin: 0, color: '#4b5563', lineHeight: '1.6' }}>
                    {selectedEvaluacion.recomendaciones}
                  </p>
                </div>
              )}
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
                className="btn btn-primary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleEditEvaluacion(selectedEvaluacion);
                }}
              >
                <i className="fas fa-edit"></i>
                <span>Editar</span>
              </button>
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

export default Evaluaciones;
