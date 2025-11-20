/**
 * Materiales Page - Boy Happy (Apoderado)
 *
 * READ ONLY page for parents to access educational materials
 *
 * Features:
 * - Show list of materials
 * - Filter by category, type, curso
 * - Card view with download links
 * - Search functionality
 * - Loading and error states
 */

import { useState, useMemo } from 'react';
import { useMateriales } from '../../hooks/useMateriales';
import { useHijos } from '../../hooks/useHijos';
import { useCategorias } from '../../hooks/useCategorias';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre } from '../../utils/helpers';

function Materiales() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState([]);
  const [tipoFilter, setTipoFilter] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: materiales = [], isLoading, isError, error, refetch } = useMateriales();
  const { data: hijos = [] } = useHijos();
  const { categorias: allCategorias = [] } = useCategorias();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Filter academic categories for materials
  const CATEGORIAS = useMemo(() =>
    allCategorias.filter(cat => cat.tipoRecurso === 'academico'),
    [allCategorias]
  );

  // Get cursos from hijos
  const cursosHijos = useMemo(() => {
    return [...new Set(hijos.map(h => h.curso).filter(Boolean))];
  }, [hijos]);

  // Get unique categorias and tipos
  const categoriasDisponibles = useMemo(() => {
    if (!Array.isArray(materiales)) return [];
    const categorias = [...new Set(materiales.map(m => m.categoria).filter(Boolean))];
    return categorias.sort();
  }, [materiales]);

  const tiposDisponibles = useMemo(() => {
    if (!Array.isArray(materiales)) return [];
    const tipos = [...new Set(materiales.map(m => m.tipo).filter(Boolean))];
    return tipos.sort();
  }, [materiales]);

  const cursosDisponibles = useMemo(() => {
    if (!Array.isArray(materiales)) return [];
    const cursos = [...new Set(materiales.map(m => m.curso).filter(Boolean))];
    return cursos.sort();
  }, [materiales]);

  // Filter materiales
  const filteredMateriales = useMemo(() => {
    if (!Array.isArray(materiales)) return [];

    return materiales.filter(material => {
      // Only show approved materials
      if (material.estado !== 'aprobado' && material.aprobado !== true) return false;

      // Search filter (title, description)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        material.titulo?.toLowerCase().includes(searchLower) ||
        material.nombre?.toLowerCase().includes(searchLower) ||
        material.descripcion?.toLowerCase().includes(searchLower);

      // Category filter (multi-select: OR logic)
      const matchesCategoria = categoriaFilter.length === 0 ||
        (material.categorias && material.categorias.some(cat => categoriaFilter.includes(cat.id)));

      // Type filter
      const matchesTipo = !tipoFilter || material.tipo === tipoFilter;

      // Curso filter
      const matchesCurso = !cursoFilter || material.curso === cursoFilter;

      return matchesSearch && matchesCategoria && matchesTipo && matchesCurso;
    });
  }, [materiales, searchTerm, categoriaFilter, tipoFilter, cursoFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!Array.isArray(materiales)) return { total: 0, documentos: 0, videos: 0, imagenes: 0 };

    const aprobados = materiales.filter(m => m.estado === 'aprobado' || m.aprobado === true);

    return {
      total: aprobados.length,
      documentos: aprobados.filter(m => m.tipo === 'documento' || m.tipo === 'pdf').length,
      videos: aprobados.filter(m => m.tipo === 'video').length,
      imagenes: aprobados.filter(m => m.tipo === 'imagen').length,
    };
  }, [materiales]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoriaFilter([]);
    setTipoFilter('');
    setCursoFilter('');
  };

  // Get tipo icon
  const getTipoIcon = (tipo) => {
    const icons = {
      'documento': 'fa-file-alt',
      'pdf': 'fa-file-pdf',
      'video': 'fa-video',
      'imagen': 'fa-image',
      'audio': 'fa-file-audio',
      'presentacion': 'fa-file-powerpoint',
      'hoja de calculo': 'fa-file-excel'
    };
    return icons[tipo?.toLowerCase()] || 'fa-file';
  };

  const getTipoColor = (tipo) => {
    const colors = {
      'documento': '#667eea',
      'pdf': '#e53e3e',
      'video': '#ed8936',
      'imagen': '#48bb78',
      'audio': '#9f7aea',
      'presentacion': '#3182ce',
      'hoja de calculo': '#38b2ac'
    };
    return colors[tipo?.toLowerCase()] || '#718096';
  };

  // Handle download
  const handleDownload = (material) => {
    if (material.url) {
      window.open(material.url, '_blank');
    } else if (material.archivo) {
      window.open(material.archivo, '_blank');
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Materiales Educativos"
        icon="fa-folder-open"
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-folder-open"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Materiales</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="card-content">
            <h3>{stats.documentos}</h3>
            <p>Documentos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-video"></i>
          </div>
          <div className="card-content">
            <h3>{stats.videos}</h3>
            <p>Videos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-image"></i>
          </div>
          <div className="card-content">
            <h3>{stats.imagenes}</h3>
            <p>Imágenes</p>
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

        {/* Category filter - Multi-select */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label>
            <i className="fas fa-tag"></i> Categorías
            {categoriaFilter.length > 0 && (
              <span className="badge" style={{
                marginLeft: '8px',
                backgroundColor: '#667eea',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                {categoriaFilter.length}
              </span>
            )}
          </label>
          <details style={{ position: 'relative' }}>
            <summary style={{
              cursor: 'pointer',
              padding: '8px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              backgroundColor: 'white',
              listStyle: 'none',
              userSelect: 'none'
            }}>
              {categoriaFilter.length === 0
                ? 'Todas las categorías'
                : `${categoriaFilter.length} seleccionada${categoriaFilter.length > 1 ? 's' : ''}`}
            </summary>
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              maxHeight: '250px',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '8px',
              backgroundColor: 'white',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              zIndex: 10,
              marginTop: '4px'
            }}>
              {CATEGORIAS.map(cat => (
                <label key={cat.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={categoriaFilter.includes(cat.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCategoriaFilter([...categoriaFilter, cat.id]);
                      } else {
                        setCategoriaFilter(categoriaFilter.filter(id => id !== cat.id));
                      }
                    }}
                    style={{ cursor: 'pointer', marginRight: '8px' }}
                  />
                  <i className={`fas ${cat.icono || 'fa-tag'}`} style={{ marginRight: '8px', color: cat.color }}></i>
                  <span>{cat.nombre}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        {/* Type filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="tipoFilter">
            <i className="fas fa-file"></i> Tipo
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

        {/* Curso filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
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
              <option key={curso} value={curso}>{curso}</option>
            ))}
          </select>
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={filteredMateriales.length}>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando materiales...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar materiales</h3>
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
      {!isLoading && !isError && filteredMateriales.length === 0 && (
        <EmptyStateCard
          icon="fa-folder-open"
          title={searchTerm || categoriaFilter || tipoFilter || cursoFilter ? 'No se encontraron materiales' : 'No hay materiales'}
          description={
            searchTerm || categoriaFilter || tipoFilter || cursoFilter
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'No hay materiales disponibles en este momento'
          }
          iconColor="#667eea"
        />
      )}

      {/* Materials Grid */}
      {!isLoading && !isError && filteredMateriales.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredMateriales.map((material) => (
            <div
              key={material.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onClick={() => setSelectedMaterial(material)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              }}
            >
              {/* Icon and Type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    backgroundColor: getTipoColor(material.tipo),
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8em'
                  }}
                >
                  <i className={`fas ${getTipoIcon(material.tipo)}`}></i>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1em' }}>
                    {material.titulo || material.nombre}
                  </h3>
                  {material.categoria && (
                    <span className="badge badge-info">
                      <i className="fas fa-tag"></i> {material.categoria}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {material.descripcion && (
                <p style={{
                  color: '#666',
                  fontSize: '0.95em',
                  lineHeight: '1.6',
                  margin: '10px 0',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {material.descripcion}
                </p>
              )}

              {/* Metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px', fontSize: '0.9em', color: '#666' }}>
                {material.curso && (
                  <div>
                    <i className="fas fa-school"></i> Curso: <strong>{material.curso}</strong>
                  </div>
                )}
                {material.asignatura && (
                  <div>
                    <i className="fas fa-book"></i> Asignatura: <strong>{material.asignatura}</strong>
                  </div>
                )}
                {material.autor && (
                  <div>
                    <i className="fas fa-user"></i> Autor: <strong>{material.autor}</strong>
                  </div>
                )}
                <div>
                  <i className="fas fa-calendar"></i> {formatDate(material.fecha || material.createdAt)}
                </div>
              </div>

              {/* Download Button */}
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(material);
                  }}
                >
                  <i className="fas fa-download"></i>
                  <span>Descargar / Ver</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Material Detail Modal */}
      {selectedMaterial && (
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
          onClick={() => setSelectedMaterial(null)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '10px',
                      backgroundColor: getTipoColor(selectedMaterial.tipo),
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5em'
                    }}
                  >
                    <i className={`fas ${getTipoIcon(selectedMaterial.tipo)}`}></i>
                  </div>
                  <h2 style={{ margin: 0 }}>
                    {selectedMaterial.titulo || selectedMaterial.nombre}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedMaterial.categoria && (
                    <span className="badge badge-info">
                      <i className="fas fa-tag"></i> {selectedMaterial.categoria}
                    </span>
                  )}
                  {selectedMaterial.tipo && (
                    <span className="badge badge-default">
                      <i className={`fas ${getTipoIcon(selectedMaterial.tipo)}`}></i> {selectedMaterial.tipo}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedMaterial(null)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {/* Description */}
              {selectedMaterial.descripcion && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Descripción
                  </label>
                  <p style={{ margin: 0, lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {selectedMaterial.descripcion}
                  </p>
                </div>
              )}

              {/* Curso */}
              {selectedMaterial.curso && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Curso
                  </label>
                  <strong>
                    <i className="fas fa-school"></i> {selectedMaterial.curso}
                  </strong>
                </div>
              )}

              {/* Asignatura */}
              {selectedMaterial.asignatura && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Asignatura
                  </label>
                  <strong>
                    <i className="fas fa-book"></i> {selectedMaterial.asignatura}
                  </strong>
                </div>
              )}

              {/* Autor */}
              {selectedMaterial.autor && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Autor
                  </label>
                  <strong>
                    <i className="fas fa-user"></i> {selectedMaterial.autor}
                  </strong>
                </div>
              )}

              {/* Fecha */}
              <div>
                <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                  Fecha de Publicación
                </label>
                <strong>
                  <i className="fas fa-calendar"></i> {formatDate(selectedMaterial.fecha || selectedMaterial.createdAt, 'long')}
                </strong>
              </div>
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
                onClick={() => setSelectedMaterial(null)}
              >
                <i className="fas fa-times"></i>
                <span>Cerrar</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleDownload(selectedMaterial)}
              >
                <i className="fas fa-download"></i>
                <span>Descargar / Ver</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Materiales;
