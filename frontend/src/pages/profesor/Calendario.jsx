/**
 * Calendario - Class Schedule & Activities for Teachers
 *
 * Features:
 * - Calendar view of classes, evaluations, and activities
 * - Filters: month, week, event type (class, evaluation, meeting)
 * - Create/edit/delete class sessions
 * - Schedule evaluations and activities
 * - Event details modal
 * - Color-coded event types
 */

import { useState, useMemo } from 'react';
import {
  useEventos,
  useCreateEvento,
  useUpdateEvento,
  useDeleteEvento
} from '../../hooks/useEventos';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import { useCursos } from '../../hooks/useConfiguracion';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  StatCardGrid
} from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import Swal from 'sweetalert2';

const TIPOS_EVENTO = [
  { value: 'clase', label: 'Clase', color: '#667eea', icon: 'fa-chalkboard-teacher' },
  { value: 'evaluacion', label: 'Evaluación', color: '#e53e3e', icon: 'fa-clipboard-check' },
  { value: 'actividad', label: 'Actividad', color: '#48bb78', icon: 'fa-puzzle-piece' },
  { value: 'reunion', label: 'Reunión', color: '#ed8936', icon: 'fa-users' },
  { value: 'evento-especial', label: 'Evento Especial', color: '#9f7aea', icon: 'fa-star' }
];

function Calendario() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [tipoFilter, setTipoFilter] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState(null);
  const [selectedEvento, setSelectedEvento] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    hora_inicio: '09:00',
    hora_fin: '10:00',
    tipo: 'clase',
    curso: '',
    ubicacion: '',
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const eventosFilters = useMemo(() => {
    const filters = { categoria: 'educacion' };

    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      filters.mes = month;
      filters.ano = year;
    }

    if (tipoFilter) filters.tipo = tipoFilter;
    if (cursoFilter) filters.curso = cursoFilter;

    return filters;
  }, [selectedMonth, tipoFilter, cursoFilter]);

  const { data: eventos = [], isLoading, isError, error, refetch } = useEventos(eventosFilters);
  const { data: cursosConfig = [], isLoading: loadingCursos } = useCursos();
  const createMutation = useCreateEvento();
  const updateMutation = useUpdateEvento();
  const deleteMutation = useDeleteEvento();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const stats = useMemo(() => {
    if (!Array.isArray(eventos)) return { total: 0, porTipo: {} };

    const porTipo = eventos.reduce((acc, evento) => {
      acc[evento.tipo] = (acc[evento.tipo] || 0) + 1;
      return acc;
    }, {});

    const hoy = new Date().toISOString().split('T')[0];
    const proximamente = eventos.filter(e => e.fecha >= hoy).length;

    return {
      total: eventos.length,
      porTipo,
      proximamente,
      completados: eventos.filter(e => e.fecha < hoy).length
    };
  }, [eventos]);

  // Group events by date for calendar view
  const eventosPorFecha = useMemo(() => {
    if (!Array.isArray(eventos)) return {};

    return eventos.reduce((acc, evento) => {
      if (!acc[evento.fecha]) {
        acc[evento.fecha] = [];
      }
      acc[evento.fecha].push(evento);
      return acc;
    }, {});
  }, [eventos]);

  // Generate calendar days for selected month
  const calendarDays = useMemo(() => {
    if (!selectedMonth) return [];

    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty days for alignment
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        date: dateStr,
        eventos: eventosPorFecha[dateStr] || []
      });
    }

    return days;
  }, [selectedMonth, eventosPorFecha]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleCreateEvento = () => {
    setEditingEvento(null);
    setFormData({
      titulo: '',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
      hora_inicio: '09:00',
      hora_fin: '10:00',
      tipo: 'clase',
      curso: '',
      ubicacion: '',
    });
    setIsModalOpen(true);
  };

  const handleEditEvento = (evento) => {
    setEditingEvento(evento);
    setFormData({
      titulo: evento.titulo || '',
      descripcion: evento.descripcion || '',
      fecha: evento.fecha || '',
      hora_inicio: evento.hora_inicio || '09:00',
      hora_fin: evento.hora_fin || '10:00',
      tipo: evento.tipo || 'clase',
      curso: evento.curso || '',
      ubicacion: evento.ubicacion || '',
    });
    setIsModalOpen(true);
  };

  const handleVerDetalle = (evento) => {
    setSelectedEvento(evento);
    setIsDetailModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.titulo.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'El título es obligatorio'
      });
      return;
    }

    try {
      const data = {
        ...formData,
        categoria: 'educacion'
      };

      if (editingEvento) {
        await updateMutation.mutateAsync({
          id: editingEvento.id,
          ...data
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting event:', error);
    }
  };

  const handleDeleteEvento = async (evento) => {
    const result = await Swal.fire({
      title: '¿Eliminar evento?',
      html: `<p>¿Estás seguro de eliminar <strong>${evento.titulo}</strong>?</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await deleteMutation.mutateAsync(evento.id);
        setIsDetailModalOpen(false);
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const handleChangeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { tipoFilter, cursoFilter });
  };

  const handleClearFilters = () => {
    setTipoFilter('');
    setCursoFilter('');
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Calendario de Clases"
        icon="fa-calendar-alt"
        buttonText="Nuevo Evento"
        buttonIcon="fa-plus"
        buttonColor="primary"
        onButtonClick={handleCreateEvento}
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-calendar"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Eventos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="card-content">
            <h3>{stats.proximamente}</h3>
            <p>Próximamente</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-chalkboard-teacher"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.clase || 0}</h3>
            <p>Clases</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clipboard-check"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.evaluacion || 0}</h3>
            <p>Evaluaciones</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-puzzle-piece"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.actividad || 0}</h3>
            <p>Actividades</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Month Navigation */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleChangeMonth(-1)}
          >
            <i className="fas fa-chevron-left"></i>
            <span>Mes Anterior</span>
          </button>

          <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ textAlign: 'center', fontWeight: 'bold' }}
            />
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => handleChangeMonth(1)}
          >
            <span>Mes Siguiente</span>
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      >
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="tipoFilter">
            <i className="fas fa-filter"></i> Tipo de Evento
          </label>
          <select
            id="tipoFilter"
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {TIPOS_EVENTO.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
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
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={eventos.length}>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando calendario...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar eventos</h3>
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

      {/* Calendar Grid */}
      {!isLoading && !isError && (
        <div className="card">
          {/* Calendar Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            backgroundColor: '#e5e7eb',
            marginBottom: '1px'
          }}>
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
              <div
                key={day}
                style={{
                  backgroundColor: '#f9fafb',
                  padding: '10px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#4b5563'
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            backgroundColor: '#e5e7eb'
          }}>
            {calendarDays.map((dayData, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: dayData ? '#ffffff' : '#f9fafb',
                  minHeight: '120px',
                  padding: '8px',
                  position: 'relative'
                }}
              >
                {dayData && (
                  <>
                    <div style={{
                      fontWeight: 'bold',
                      color: dayData.date === new Date().toISOString().split('T')[0] ? '#667eea' : '#1f2937',
                      marginBottom: '8px',
                      fontSize: '1.1em'
                    }}>
                      {dayData.day}
                    </div>

                    {dayData.eventos.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {dayData.eventos.slice(0, 3).map(evento => {
                          const tipoConfig = TIPOS_EVENTO.find(t => t.value === evento.tipo);
                          return (
                            <div
                              key={evento.id}
                              onClick={() => handleVerDetalle(evento)}
                              style={{
                                backgroundColor: tipoConfig?.color || '#667eea',
                                color: 'white',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                fontSize: '0.75em',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={`${evento.hora_inicio} - ${evento.titulo}`}
                            >
                              <i className={`fas ${tipoConfig?.icon || 'fa-calendar'}`}></i> {evento.hora_inicio} {evento.titulo}
                            </div>
                          );
                        })}
                        {dayData.eventos.length > 3 && (
                          <div style={{
                            fontSize: '0.75em',
                            color: '#6b7280',
                            fontStyle: 'italic'
                          }}>
                            +{dayData.eventos.length - 3} más
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Empty State for Calendar */}
          {eventos.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
              <i className="fas fa-calendar-times fa-3x" style={{ marginBottom: '15px' }}></i>
              <p>No hay eventos programados para este mes</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Event Modal */}
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
                <i className={`fas ${editingEvento ? 'fa-edit' : 'fa-plus'}`}></i>
                {' '}
                {editingEvento ? 'Editar Evento' : 'Nuevo Evento'}
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
                    placeholder="Ej: Clase de Matemáticas - Números"
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
                    placeholder="Describe el evento..."
                    rows={3}
                  />
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
                    {TIPOS_EVENTO.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="hora_inicio">
                    Hora Inicio <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="hora_inicio"
                    type="time"
                    name="hora_inicio"
                    value={formData.hora_inicio}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="hora_fin">
                    Hora Fin <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="hora_fin"
                    type="time"
                    name="hora_fin"
                    value={formData.hora_fin}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="curso">
                    Curso
                  </label>
                  <select
                    id="curso"
                    name="curso"
                    value={formData.curso}
                    onChange={handleInputChange}
                  >
                    <option value="">{loadingCursos ? 'Cargando cursos...' : 'Seleccionar curso (opcional)'}</option>
                    {cursosConfig.map((curso) => (
                      <option key={curso.codigo} value={curso.nombre}>
                        {curso.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="ubicacion">
                    Ubicación
                  </label>
                  <input
                    id="ubicacion"
                    type="text"
                    name="ubicacion"
                    value={formData.ubicacion}
                    onChange={handleInputChange}
                    placeholder="Ej: Sala 101"
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <i className="fas fa-times"></i>
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <i className="fas fa-spinner fa-spin"></i>
                  )}
                  {!(createMutation.isPending || updateMutation.isPending) && (
                    <i className="fas fa-save"></i>
                  )}
                  <span>{editingEvento ? 'Guardar Cambios' : 'Crear Evento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {isDetailModalOpen && selectedEvento && (
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
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <h2 style={{ margin: 0 }}>
                <i className="fas fa-calendar-day"></i> {selectedEvento.titulo}
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                  Fecha y Hora
                </label>
                <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                  <i className="fas fa-calendar"></i> {formatDate(selectedEvento.fecha)}
                  {' - '}
                  <i className="fas fa-clock"></i> {selectedEvento.hora_inicio} - {selectedEvento.hora_fin}
                </p>
              </div>

              {selectedEvento.tipo && (
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                    Tipo
                  </label>
                  <p style={{ margin: '4px 0 0' }}>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: TIPOS_EVENTO.find(t => t.value === selectedEvento.tipo)?.color || '#667eea',
                        color: 'white'
                      }}
                    >
                      <i className={`fas ${TIPOS_EVENTO.find(t => t.value === selectedEvento.tipo)?.icon || 'fa-calendar'}`}></i>
                      {' '}
                      {TIPOS_EVENTO.find(t => t.value === selectedEvento.tipo)?.label || selectedEvento.tipo}
                    </span>
                  </p>
                </div>
              )}

              {selectedEvento.curso && (
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                    Curso
                  </label>
                  <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                    {cursosConfig.find(c => c.codigo === selectedEvento.curso)?.nombre || selectedEvento.curso}
                  </p>
                </div>
              )}

              {selectedEvento.ubicacion && (
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                    Ubicación
                  </label>
                  <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                    <i className="fas fa-map-marker-alt"></i> {selectedEvento.ubicacion}
                  </p>
                </div>
              )}

              {selectedEvento.descripcion && (
                <div>
                  <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                    Descripción
                  </label>
                  <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                    {selectedEvento.descripcion}
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
                className="btn btn-danger"
                onClick={() => handleDeleteEvento(selectedEvento)}
              >
                <i className="fas fa-trash"></i>
                <span>Eliminar</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleEditEvento(selectedEvento);
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

export default Calendario;
