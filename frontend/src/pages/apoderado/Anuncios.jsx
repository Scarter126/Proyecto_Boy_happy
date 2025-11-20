/**
 * Anuncios Page - Boy Happy (Apoderado)
 *
 * READ ONLY page for parents to view announcements
 *
 * Features:
 * - View list of announcements
 * - Filter by date and priority
 * - Card view with badges
 * - Loading and error states
 * - Responsive design
 */

import { useState, useMemo } from 'react';
import { useAnuncios } from '../../hooks/useAnuncios';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate } from '../../utils/helpers';

function Anuncios() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [searchTerm, setSearchTerm] = useState('');
  const [prioridadFilter, setPrioridadFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAnuncio, setSelectedAnuncio] = useState(null);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: anuncios = [], isLoading, isError, error, refetch } = useAnuncios();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Filter anuncios
  const filteredAnuncios = useMemo(() => {
    if (!Array.isArray(anuncios)) return [];

    return anuncios.filter(anuncio => {
      // Search filter (title, content)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        anuncio.titulo?.toLowerCase().includes(searchLower) ||
        anuncio.contenido?.toLowerCase().includes(searchLower);

      // Priority filter
      const matchesPrioridad = !prioridadFilter || anuncio.prioridad === prioridadFilter;

      // Date range filter
      const anuncioDate = new Date(anuncio.fecha || anuncio.createdAt);
      const matchesDateFrom = !dateFrom || anuncioDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || anuncioDate <= new Date(dateTo);

      return matchesSearch && matchesPrioridad && matchesDateFrom && matchesDateTo;
    });
  }, [anuncios, searchTerm, prioridadFilter, dateFrom, dateTo]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!Array.isArray(anuncios)) return { total: 0, alta: 0, media: 0, baja: 0 };

    return {
      total: anuncios.length,
      alta: anuncios.filter(a => a.prioridad === 'alta').length,
      media: anuncios.filter(a => a.prioridad === 'media').length,
      baja: anuncios.filter(a => a.prioridad === 'baja').length,
    };
  }, [anuncios]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleClearFilters = () => {
    setSearchTerm('');
    setPrioridadFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // Get priority badge color
  const getPrioridadColor = (prioridad) => {
    switch (prioridad) {
      case 'alta': return 'danger';
      case 'media': return 'warning';
      case 'baja': return 'info';
      default: return 'default';
    }
  };

  const getPrioridadIcon = (prioridad) => {
    switch (prioridad) {
      case 'alta': return 'fa-exclamation-circle';
      case 'media': return 'fa-info-circle';
      case 'baja': return 'fa-check-circle';
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
        title="Anuncios"
        icon="fa-bullhorn"
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-bullhorn"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Anuncios</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.alta}</h3>
            <p>Prioridad Alta</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-info-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.media}</h3>
            <p>Prioridad Media</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.baja}</h3>
            <p>Prioridad Baja</p>
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
            placeholder="Buscar por título o contenido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Priority filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="prioridadFilter">
            <i className="fas fa-flag"></i> Prioridad
          </label>
          <select
            id="prioridadFilter"
            value={prioridadFilter}
            onChange={(e) => setPrioridadFilter(e.target.value)}
          >
            <option value="">Todas las prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
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
      <ActionBar count={filteredAnuncios.length}>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando anuncios...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar anuncios</h3>
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
      {!isLoading && !isError && filteredAnuncios.length === 0 && (
        <EmptyStateCard
          icon="fa-bullhorn"
          title={searchTerm || prioridadFilter || dateFrom || dateTo ? 'No se encontraron anuncios' : 'No hay anuncios'}
          description={
            searchTerm || prioridadFilter || dateFrom || dateTo
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'No hay anuncios disponibles en este momento'
          }
          iconColor="#667eea"
        />
      )}

      {/* Announcements List */}
      {!isLoading && !isError && filteredAnuncios.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {filteredAnuncios.map((anuncio) => (
            <div
              key={anuncio.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onClick={() => setSelectedAnuncio(anuncio)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2em' }}>
                    {anuncio.titulo}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9em', color: '#666' }}>
                    <i className="fas fa-calendar"></i>
                    <span>{formatDate(anuncio.fecha || anuncio.createdAt)}</span>
                  </div>
                </div>
                <span className={`badge badge-${getPrioridadColor(anuncio.prioridad)}`}>
                  <i className={`fas ${getPrioridadIcon(anuncio.prioridad)}`}></i>
                  {' '}
                  {anuncio.prioridad?.charAt(0).toUpperCase() + anuncio.prioridad?.slice(1)}
                </span>
              </div>

              {/* Content Preview */}
              <p style={{
                color: '#666',
                lineHeight: '1.6',
                margin: '0',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {anuncio.contenido}
              </p>

              {/* Author */}
              {anuncio.autor && (
                <div style={{
                  marginTop: '15px',
                  paddingTop: '15px',
                  borderTop: '1px solid #e5e7eb',
                  fontSize: '0.9em',
                  color: '#666'
                }}>
                  <i className="fas fa-user"></i>
                  {' '}
                  Publicado por: <strong>{anuncio.autor}</strong>
                </div>
              )}

              {/* Read more indicator */}
              <div style={{ marginTop: '10px', color: '#667eea', fontSize: '0.9em', fontWeight: '500' }}>
                <i className="fas fa-arrow-right"></i> Click para leer más
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Announcement Detail Modal */}
      {selectedAnuncio && (
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
          onClick={() => setSelectedAnuncio(null)}
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
                  <i className="fas fa-bullhorn"></i>
                  {' '}
                  {selectedAnuncio.titulo}
                </h2>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', color: '#666' }}>
                  <span>
                    <i className="fas fa-calendar"></i>
                    {' '}
                    {formatDate(selectedAnuncio.fecha || selectedAnuncio.createdAt, 'long')}
                  </span>
                  <span className={`badge badge-${getPrioridadColor(selectedAnuncio.prioridad)}`}>
                    <i className={`fas ${getPrioridadIcon(selectedAnuncio.prioridad)}`}></i>
                    {' '}
                    {selectedAnuncio.prioridad?.charAt(0).toUpperCase() + selectedAnuncio.prioridad?.slice(1)}
                  </span>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedAnuncio(null)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              fontSize: '1.05em',
              lineHeight: '1.8',
              color: '#333',
              whiteSpace: 'pre-wrap'
            }}>
              {selectedAnuncio.contenido}
            </div>

            {/* Author and date */}
            {selectedAnuncio.autor && (
              <div style={{
                marginTop: '20px',
                paddingTop: '20px',
                borderTop: '1px solid #e5e7eb',
                color: '#666'
              }}>
                <i className="fas fa-user"></i>
                {' '}
                Publicado por: <strong>{selectedAnuncio.autor}</strong>
              </div>
            )}

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
                onClick={() => setSelectedAnuncio(null)}
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

export default Anuncios;
