/**
 * Calendario Page - Boy Happy (Apoderado)
 *
 * READ ONLY page for parents to view calendar of activities and events
 *
 * Features:
 * - Show events list
 * - Filter by date range and type
 * - Calendar view with cards
 * - Loading and error states
 * - Responsive design
 */

import { useState, useMemo } from 'react';
import { useEventos } from '../../hooks/useEventos';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate } from '../../utils/helpers';

function Calendario() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEvento, setSelectedEvento] = useState(null);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: eventos = [], isLoading, isError, error, refetch } = useEventos();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Get unique tipos from eventos
  const tiposDisponibles = useMemo(() => {
    if (!Array.isArray(eventos)) return [];
    const tipos = [...new Set(eventos.map(e => e.tipo).filter(Boolean))];
    return tipos.sort();
  }, [eventos]);

  // Filter eventos
  const filteredEventos = useMemo(() => {
    if (!Array.isArray(eventos)) return [];

    return eventos.filter(evento => {
      // Search filter (title, description)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        evento.titulo?.toLowerCase().includes(searchLower) ||
        evento.descripcion?.toLowerCase().includes(searchLower);

      // Type filter
      const matchesTipo = !tipoFilter || evento.tipo === tipoFilter;

      // Date range filter
      const eventoDate = new Date(evento.fecha);
      const matchesDateFrom = !dateFrom || eventoDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || eventoDate <= new Date(dateTo);

      return matchesSearch && matchesTipo && matchesDateFrom && matchesDateTo;
    });
  }, [eventos, searchTerm, tipoFilter, dateFrom, dateTo]);

  // Sort events by date (upcoming first)
  const sortedEventos = useMemo(() => {
    return [...filteredEventos].sort((a, b) => {
      return new Date(a.fecha) - new Date(b.fecha);
    });
  }, [filteredEventos]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!Array.isArray(eventos)) return { total: 0, proximos: 0, pasados: 0, hoy: 0 };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const total = eventos.length;
    const proximos = eventos.filter(e => new Date(e.fecha) > hoy).length;
    const pasados = eventos.filter(e => new Date(e.fecha) < hoy).length;
    const eventoHoy = eventos.filter(e => {
      const eventoDate = new Date(e.fecha);
      eventoDate.setHours(0, 0, 0, 0);
      return eventoDate.getTime() === hoy.getTime();
    }).length;

    return { total, proximos, pasados, hoy: eventoHoy };
  }, [eventos]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleClearFilters = () => {
    setSearchTerm('');
    setTipoFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // Get tipo badge color
  const getTipoColor = (tipo) => {
    const colors = {
      'academico': 'primary',
      'reunion': 'info',
      'actividad': 'success',
      'evaluacion': 'warning',
      'festivo': 'danger',
      'suspension': 'secondary'
    };
    return colors[tipo?.toLowerCase()] || 'default';
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      'academico': 'fa-book',
      'reunion': 'fa-users',
      'actividad': 'fa-running',
      'evaluacion': 'fa-file-alt',
      'festivo': 'fa-star',
      'suspension': 'fa-ban'
    };
    return icons[tipo?.toLowerCase()] || 'fa-calendar';
  };

  // Check if event is upcoming, today, or past
  const getEventoStatus = (fecha) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const eventoDate = new Date(fecha);
    eventoDate.setHours(0, 0, 0, 0);

    if (eventoDate.getTime() === hoy.getTime()) return 'hoy';
    if (eventoDate > hoy) return 'proximo';
    return 'pasado';
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Calendario de Actividades"
        icon="fa-calendar-alt"
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-calendar-alt"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Eventos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="card-content">
            <h3>{stats.proximos}</h3>
            <p>Próximos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-star"></i>
          </div>
          <div className="card-content">
            <h3>{stats.hoy}</h3>
            <p>Hoy</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-calendar-times"></i>
          </div>
          <div className="card-content">
            <h3>{stats.pasados}</h3>
            <p>Pasados</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Filter Panel */}
      <FilterPanel onClearFilters={handleClearFilters}>
        {/* Search input */}
        <div className="form-group" style={{ flex: '1 1 300px' }}>
          <label htmlFor="search">
            <i className="fas fa-search"></i> Buscar
          </label>
          <input
            id="search"
            type="text"
            placeholder="Buscar por título o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Type filter */}
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
            {tiposDisponibles.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>

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
      <ActionBar count={filteredEventos.length}>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando eventos...</h3>
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

      {/* Empty State */}
      {!isLoading && !isError && filteredEventos.length === 0 && (
        <EmptyStateCard
          icon="fa-calendar-alt"
          title={searchTerm || tipoFilter || dateFrom || dateTo ? 'No se encontraron eventos' : 'No hay eventos'}
          description={
            searchTerm || tipoFilter || dateFrom || dateTo
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'No hay eventos programados en este momento'
          }
          iconColor="#667eea"
        />
      )}

      {/* Events List */}
      {!isLoading && !isError && sortedEventos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {sortedEventos.map((evento) => {
            const status = getEventoStatus(evento.fecha);
            return (
              <div
                key={evento.id}
                className="card"
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  borderLeft: status === 'hoy' ? '4px solid #ed8936' : status === 'proximo' ? '4px solid #48bb78' : '4px solid #cbd5e0'
                }}
                onClick={() => setSelectedEvento(evento)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  {/* Date Badge */}
                  <div style={{
                    minWidth: '70px',
                    textAlign: 'center',
                    padding: '10px',
                    backgroundColor: '#f7fafc',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '0.8em', color: '#666', textTransform: 'uppercase' }}>
                      {new Date(evento.fecha).toLocaleDateString('es-CL', { month: 'short' })}
                    </div>
                    <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#667eea', lineHeight: '1' }}>
                      {new Date(evento.fecha).getDate()}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>
                      {new Date(evento.fecha).getFullYear()}
                    </div>
                  </div>

                  {/* Event Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2em' }}>
                        {evento.titulo}
                      </h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {status === 'hoy' && (
                          <span className="badge badge-warning">
                            <i className="fas fa-star"></i> HOY
                          </span>
                        )}
                        {evento.tipo && (
                          <span className={`badge badge-${getTipoColor(evento.tipo)}`}>
                            <i className={`fas ${getTipoIcon(evento.tipo)}`}></i>
                            {' '}
                            {evento.tipo}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {evento.descripcion && (
                      <p style={{
                        color: '#666',
                        margin: '8px 0',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {evento.descripcion}
                      </p>
                    )}

                    {/* Time and Location */}
                    <div style={{ display: 'flex', gap: '15px', fontSize: '0.9em', color: '#666', marginTop: '10px' }}>
                      {evento.hora && (
                        <span>
                          <i className="fas fa-clock"></i> {evento.hora}
                        </span>
                      )}
                      {evento.ubicacion && (
                        <span>
                          <i className="fas fa-map-marker-alt"></i> {evento.ubicacion}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvento && (
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
          onClick={() => setSelectedEvento(null)}
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
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '20px'
            }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 10px 0' }}>
                  <i className="fas fa-calendar-alt"></i>
                  {' '}
                  {selectedEvento.titulo}
                </h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#666' }}>
                    <i className="fas fa-calendar"></i>
                    {' '}
                    {formatDate(selectedEvento.fecha, 'long')}
                  </span>
                  {selectedEvento.tipo && (
                    <span className={`badge badge-${getTipoColor(selectedEvento.tipo)}`}>
                      <i className={`fas ${getTipoIcon(selectedEvento.tipo)}`}></i>
                      {' '}
                      {selectedEvento.tipo}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedEvento(null)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {/* Description */}
              {selectedEvento.descripcion && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Descripción
                  </label>
                  <p style={{ margin: 0, lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {selectedEvento.descripcion}
                  </p>
                </div>
              )}

              {/* Time */}
              {selectedEvento.hora && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Hora
                  </label>
                  <strong>
                    <i className="fas fa-clock"></i> {selectedEvento.hora}
                  </strong>
                </div>
              )}

              {/* Location */}
              {selectedEvento.ubicacion && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Ubicación
                  </label>
                  <strong>
                    <i className="fas fa-map-marker-alt"></i> {selectedEvento.ubicacion}
                  </strong>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedEvento(null)}
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
