/**
 * Anuncios Management Page - Boy Happy
 *
 * Comprehensive production-ready page for managing system announcements.
 * Implements full CRUD operations with React Query, UI components, and best practices.
 *
 * Features:
 * - Search and filter by title, content, priority, visibility
 * - Create, edit, delete announcements
 * - Priority badges (alta, media, baja)
 * - Visibility badges (todos, admin, profesor, fono, apoderado)
 * - Statistics dashboard
 * - Loading and error states
 * - Optimistic updates
 * - Responsive design
 * - Accessibility
 */

import { useState, useMemo } from 'react';
import {
  useAnuncios,
  useCreateAnuncio,
  useUpdateAnuncio,
  useDeleteAnuncio
} from '../../hooks/useAnuncios';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, truncate } from '../../utils/helpers';
import Swal from 'sweetalert2';

/**
 * PriorityBadge - Badge for announcement priority
 */
function PriorityBadge({ prioridad }) {
  const variantMap = {
    'alta': { color: '#e53e3e', text: 'Alta', icon: 'fa-exclamation-circle' },
    'media': { color: '#ed8936', text: 'Media', icon: 'fa-info-circle' },
    'baja': { color: '#48bb78', text: 'Baja', icon: 'fa-check-circle' }
  };

  const config = variantMap[prioridad] || variantMap['baja'];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: `${config.color}20`,
        color: config.color,
      }}
    >
      <i className={`fas ${config.icon}`}></i>
      {config.text}
    </span>
  );
}

/**
 * VisibilityBadge - Badge for announcement target audience
 */
function VisibilityBadge({ visibilidad }) {
  const variantMap = {
    'todos': { color: '#667eea', text: 'Todos', icon: 'fa-users' },
    'admin': { color: '#9f7aea', text: 'Administradores', icon: 'fa-user-shield' },
    'profesor': { color: '#48bb78', text: 'Profesores', icon: 'fa-chalkboard-teacher' },
    'fono': { color: '#4299e1', text: 'Fonoaudiólogos', icon: 'fa-user-md' },
    'apoderado': { color: '#ed8936', text: 'Apoderados', icon: 'fa-user-friends' }
  };

  const config = variantMap[visibilidad] || variantMap['todos'];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: `${config.color}20`,
        color: config.color,
      }}
    >
      <i className={`fas ${config.icon}`}></i>
      {config.text}
    </span>
  );
}

function Anuncios() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnuncio, setEditingAnuncio] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    contenido: '',
    prioridad: 'media',
    visibilidad: 'todos',
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: anuncios = [], isLoading, isError, error, refetch } = useAnuncios();
  const createMutation = useCreateAnuncio();
  const updateMutation = useUpdateAnuncio();
  const deleteMutation = useDeleteAnuncio();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Filter announcements based on search and filters
  const filteredAnuncios = useMemo(() => {
    if (!Array.isArray(anuncios)) return [];

    return anuncios.filter(anuncio => {
      // Search filter (title and content)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        anuncio.titulo?.toLowerCase().includes(searchLower) ||
        anuncio.contenido?.toLowerCase().includes(searchLower);

      // Priority filter
      const matchesPriority = !priorityFilter || anuncio.prioridad === priorityFilter;

      // Visibility filter
      const matchesVisibility = !visibilityFilter || anuncio.visibilidad === visibilityFilter;

      return matchesSearch && matchesPriority && matchesVisibility;
    });
  }, [anuncios, searchTerm, priorityFilter, visibilityFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!Array.isArray(anuncios)) return { total: 0, byPriority: {}, byVisibility: {} };

    const byPriority = anuncios.reduce((acc, anuncio) => {
      acc[anuncio.prioridad] = (acc[anuncio.prioridad] || 0) + 1;
      return acc;
    }, {});

    const byVisibility = anuncios.reduce((acc, anuncio) => {
      acc[anuncio.visibilidad] = (acc[anuncio.visibilidad] || 0) + 1;
      return acc;
    }, {});

    return {
      total: anuncios.length,
      byPriority,
      byVisibility
    };
  }, [anuncios]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  // Open modal for creating a new announcement
  const handleCreateAnuncio = () => {
    setEditingAnuncio(null);
    setFormData({
      titulo: '',
      contenido: '',
      prioridad: 'media',
      visibilidad: 'todos',
    });
    setIsModalOpen(true);
  };

  // Open modal for editing an existing announcement
  const handleEditAnuncio = async (anuncio) => {
    try {
      // Traer anuncio desde el backend (opcional si quieres datos frescos)
      const data = await apiClient.get(`/anuncios/${anuncio.id}`);

      // Abrir modal con datos actualizados
      setEditingAnuncio(data);
      setFormData({
        titulo: data.titulo,
        contenido: data.contenido,
        prioridad: data.prioridad || 'media',
        visibilidad: data.visibilidad || 'todos',
      });
      setIsModalOpen(true);

    } catch (error) {
      console.error('Error al traer anuncio:', error);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Submit form (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!formData.titulo.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El título es obligatorio'
      });
      return;
    }

    if (!formData.contenido.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El contenido es obligatorio'
      });
      return;
    }

    try {
      if (editingAnuncio) {
        // Update existing announcement
        await updateMutation.mutateAsync({
          id: editingAnuncio.id,
          ...formData
        });
      } else {
        // Create new announcement
        await createMutation.mutateAsync(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Error submitting form:', error);
    }
  };

  // Delete announcement with confirmation
  const handleDeleteAnuncio = async (anuncio) => {
    const result = await Swal.fire({
      title: '¿Eliminar anuncio?',
      html: `
        <p>¿Estás seguro de eliminar el anuncio <strong>"${anuncio.titulo}"</strong>?</p>
        <p class="text-muted">Esta acción no se puede deshacer.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await deleteMutation.mutateAsync(anuncio.id);
      } catch (error) {
        console.error('Error deleting announcement:', error);
      }
    }
  };

  // Apply filters
  const handleApplyFilters = () => {
    // Filters are automatically applied via useMemo
    console.log('Filters applied:', { searchTerm, priorityFilter, visibilityFilter });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setPriorityFilter('');
    setVisibilityFilter('');
  };

  // Export announcements to CSV
  const handleExportAnuncios = () => {
    const csv = [
      ['Título', 'Contenido', 'Prioridad', 'Visibilidad', 'Fecha'].join(','),
      ...filteredAnuncios.map(anuncio => [
        `"${anuncio.titulo}"`,
        `"${anuncio.contenido}"`,
        anuncio.prioridad,
        anuncio.visibilidad,
        formatDate(anuncio.createdAt || anuncio.fecha)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `anuncios_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Gestión de Anuncios"
        icon="fa-bullhorn"
        buttonText="Crear Anuncio"
        buttonIcon="fa-plus"
        buttonColor="primary"
        onButtonClick={handleCreateAnuncio}
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
            <h3>{stats.byPriority.alta || 0}</h3>
            <p>Prioridad Alta</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-info-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byPriority.media || 0}</h3>
            <p>Prioridad Media</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byPriority.baja || 0}</h3>
            <p>Prioridad Baja</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Filter Panel */}
      <FilterPanel
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      >
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
          <label htmlFor="priorityFilter">
            <i className="fas fa-flag"></i> Prioridad
          </label>
          <select
            id="priorityFilter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">Todas las prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>

        {/* Visibility filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="visibilityFilter">
            <i className="fas fa-eye"></i> Visibilidad
          </label>
          <select
            id="visibilityFilter"
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
          >
            <option value="">Todas las audiencias</option>
            <option value="todos">Todos</option>
            <option value="admin">Administradores</option>
            <option value="profesor">Profesores</option>
            <option value="fono">Fonoaudiólogos</option>
            <option value="apoderado">Apoderados</option>
          </select>
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={filteredAnuncios.length}>
        <button
          className="btn btn-success"
          onClick={handleExportAnuncios}
          disabled={filteredAnuncios.length === 0}
        >
          <i className="fas fa-download"></i>
          <span>Exportar</span>
        </button>
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
          title={searchTerm || priorityFilter || visibilityFilter ? 'No se encontraron anuncios' : 'No hay anuncios registrados'}
          description={
            searchTerm || priorityFilter || visibilityFilter
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Comienza agregando tu primer anuncio al sistema'
          }
          iconColor="#667eea"
          actionText={!(searchTerm || priorityFilter || visibilityFilter) ? 'Crear Anuncio' : ''}
          onAction={!(searchTerm || priorityFilter || visibilityFilter) ? handleCreateAnuncio : null}
        />
      )}

      {/* Announcements Grid */}
      {!isLoading && !isError && filteredAnuncios.length > 0 && (
        <div className="anuncios-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {filteredAnuncios.map((anuncio) => (
            <div
              key={anuncio.id}
              className="card"
              style={{
                borderLeft: `4px solid ${anuncio.prioridad === 'alta' ? '#e53e3e' :
                    anuncio.prioridad === 'media' ? '#ed8936' : '#48bb78'
                  }`,
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Card Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#2d3748',
                  flex: 1
                }}>
                  {anuncio.titulo}
                </h3>
                <PriorityBadge prioridad={anuncio.prioridad} />
              </div>

              {/* Card Content */}
              <p style={{
                color: '#4a5568',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '16px',
                minHeight: '60px'
              }}>
                {truncate(anuncio.contenido, 120)}
              </p>

              {/* Card Metadata */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <VisibilityBadge visibilidad={anuncio.visibilidad} />
                <span style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-calendar"></i>
                  {formatDate(anuncio.createdAt || anuncio.fecha)}
                </span>
              </div>

              {/* Card Actions */}
              <div style={{
                display: 'flex',
                gap: '8px',
                paddingTop: '12px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleEditAnuncio(anuncio)}
                  style={{ flex: 1 }}
                  title="Editar anuncio"
                >
                  <i className="fas fa-edit"></i>
                  <span>Editar</span>
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteAnuncio(anuncio)}
                  title="Eliminar anuncio"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Announcement Modal */}
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
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0 }}>
                <i className={`fas ${editingAnuncio ? 'fa-edit' : 'fa-plus'}`}></i>
                {' '}
                {editingAnuncio ? 'Editar Anuncio' : 'Crear Anuncio'}
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
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                {/* Título */}
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
                    placeholder="Título del anuncio"
                    required
                    maxLength={100}
                  />
                  <small style={{ color: '#9ca3af', fontSize: '12px' }}>
                    {formData.titulo.length}/100 caracteres
                  </small>
                </div>

                {/* Contenido */}
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="contenido">
                    Contenido <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <textarea
                    id="contenido"
                    name="contenido"
                    value={formData.contenido}
                    onChange={handleInputChange}
                    placeholder="Contenido del anuncio"
                    required
                    rows={6}
                    maxLength={500}
                    style={{ resize: 'vertical' }}
                  />
                  <small style={{ color: '#9ca3af', fontSize: '12px' }}>
                    {formData.contenido.length}/500 caracteres
                  </small>
                </div>

                {/* Prioridad */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="prioridad">
                    Prioridad <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="prioridad"
                    name="prioridad"
                    value={formData.prioridad}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                  <small style={{ color: '#9ca3af', fontSize: '12px' }}>
                    La prioridad determina el orden de visualización
                  </small>
                </div>

                {/* Visibilidad */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="visibilidad">
                    Audiencia <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="visibilidad"
                    name="visibilidad"
                    value={formData.visibilidad}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="todos">Todos</option>
                    <option value="admin">Administradores</option>
                    <option value="profesor">Profesores</option>
                    <option value="fono">Fonoaudiólogos</option>
                    <option value="apoderado">Apoderados</option>
                  </select>
                  <small style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Define quién puede ver este anuncio
                  </small>
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
                    <i className={`fas ${editingAnuncio ? 'fa-save' : 'fa-plus'}`}></i>
                  )}
                  <span>
                    {editingAnuncio ? 'Guardar Cambios' : 'Crear Anuncio'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Anuncios;
