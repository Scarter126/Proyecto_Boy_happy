/**
 * Materiales - Educational Materials Library for Teachers
 *
 * Features:
 * - Library of educational materials for classes
 * - Filters: subject, grade level, material type, topic
 * - Categories: presentations, worksheets, readings, videos, activities
 * - Upload new materials
 * - Edit/delete materials
 * - Share materials with students
 * - Material preview/download
 * - Export materials list
 */

import { useState, useMemo } from 'react';
import {
  useMateriales,
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial
} from '../../hooks/useMateriales';
import {
  useCursos,
  useTiposArchivo
} from '../../hooks/useConfiguracion';
import { useCategorias } from '../../hooks/useCategorias';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import Swal from 'sweetalert2';

function Materiales() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState([]);
  const [tipoFilter, setTipoFilter] = useState('');
  const [nivelFilter, setNivelFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'guia',
    categorias: [],
    nivel: '',
    url: '',
    activo: true
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: materiales = [], isLoading, isError, error, refetch } = useMateriales();
  const { data: cursosConfig = [], isLoading: loadingCursos } = useCursos();
  const { categorias: allCategorias = [], isLoading: categoriasLoading } = useCategorias();
  const CATEGORIAS = useMemo(() =>
    allCategorias.filter(cat => cat.tipoRecurso === 'academico'),
    [allCategorias]
  );
  const { data: TIPOS = [], isLoading: tiposLoading } = useTiposArchivo();
  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const deleteMutation = useDeleteMaterial();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const filteredMaterials = useMemo(() => {
    if (!Array.isArray(materiales)) return [];

    return materiales.filter(material => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        material.titulo?.toLowerCase().includes(searchLower) ||
        material.descripcion?.toLowerCase().includes(searchLower);

      // Category filter (multi-select: OR logic)
      const matchesCategoria = categoriaFilter.length === 0 ||
        (material.categorias && material.categorias.some(cat => categoriaFilter.includes(cat.id)));
      const matchesTipo = !tipoFilter || material.tipo === tipoFilter;
      const matchesNivel = !nivelFilter || material.nivel === nivelFilter;

      return matchesSearch && matchesCategoria && matchesTipo && matchesNivel;
    });
  }, [materiales, searchTerm, categoriaFilter, tipoFilter, nivelFilter]);

  const stats = useMemo(() => {
    if (!Array.isArray(materiales)) return { total: 0, byTipo: {} };

    const byTipo = materiales.reduce((acc, material) => {
      acc[material.tipo] = (acc[material.tipo] || 0) + 1;
      return acc;
    }, {});

    return {
      total: materiales.length,
      byTipo
    };
  }, [materiales]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleCreateMaterial = () => {
    setEditingMaterial(null);
    setSelectedFile(null);
    setFormData({
      titulo: '',
      descripcion: '',
      tipo: 'guia',
      categorias: [],
      nivel: '',
      url: '',
      activo: true
    });
    setIsModalOpen(true);
  };

  const handleEditMaterial = (material) => {
    setEditingMaterial(material);
    setSelectedFile(null);
    setFormData({
      titulo: material.titulo || '',
      descripcion: material.descripcion || '',
      tipo: material.tipo || 'guia',
      categorias: material.categorias ? material.categorias.map(cat => cat.id) : [],
      nivel: material.nivel || '',
      url: material.url || material.archivoUrl || '',
      activo: material.activo !== false
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
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

    if (!formData.categorias || formData.categorias.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Selecciona al menos una categoría'
      });
      return;
    }

    try {
      if (editingMaterial) {
        await updateMutation.mutateAsync({
          id: editingMaterial.id,
          ...formData,
          archivo: selectedFile
        });
      } else {
        const submitData = {
          ...formData,
          archivo: selectedFile
        };
        await createMutation.mutateAsync(submitData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleDeleteMaterial = async (material) => {
    const result = await Swal.fire({
      title: '¿Eliminar material?',
      html: `<p>¿Estás seguro de eliminar <strong>${material.titulo}</strong>?</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await deleteMutation.mutateAsync(material.id);
      } catch (error) {
        console.error('Error deleting material:', error);
      }
    }
  };

  const handleVerDetalle = (material) => {
    const categorias = material.categorias && material.categorias.length > 0
      ? material.categorias.map(cat => cat.nombre).join(', ')
      : 'Sin categorías';

    Swal.fire({
      title: material.titulo,
      html: `
        <div style="text-align: left;">
          <p><strong>Descripción:</strong> ${material.descripcion || 'Sin descripción'}</p>
          <p><strong>Categorías:</strong> ${categorias}</p>
          <p><strong>Tipo:</strong> ${TIPOS.find(t => t.value === material.tipo)?.label || material.tipo}</p>
          <p><strong>Nivel:</strong> ${cursosConfig.find(c => c.codigo === material.nivel)?.nombre || material.nivel}</p>
          <p><strong>Fecha:</strong> ${formatDate(material.fechaSubida || material.createdAt)}</p>
          ${material.archivoUrl ? `<p><strong>Archivo:</strong> <a href="${material.archivoUrl}" target="_blank">Descargar</a></p>` : ''}
        </div>
      `,
      width: 600,
      confirmButtonText: 'Cerrar'
    });
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { categoriaFilter, tipoFilter, nivelFilter });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoriaFilter([]);
    setTipoFilter('');
    setNivelFilter('');
  };

  const handleExportMaterials = () => {
    const csv = [
      ['Título', 'Descripción', 'Categoría', 'Tipo', 'Nivel', 'Fecha'].join(','),
      ...filteredMaterials.map(material => [
        `"${material.titulo}"`,
        `"${material.descripcion || ''}"`,
        material.categoria,
        material.tipo,
        material.nivel,
        formatDate(material.fechaSubida || material.createdAt)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `materiales_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    Swal.fire({
      icon: 'success',
      title: 'Exportado',
      text: 'La lista de materiales ha sido exportada exitosamente',
      timer: 2000
    });
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
        buttonText="Subir Material"
        buttonIcon="fa-plus"
        buttonColor="primary"
        onButtonClick={handleCreateMaterial}
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
            <i className="fas fa-file-powerpoint"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byTipo.presentacion || 0}</h3>
            <p>Presentaciones</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byTipo.guia || 0}</h3>
            <p>Guías</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-video"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byTipo.video || 0}</h3>
            <p>Videos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-puzzle-piece"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byTipo.actividad || 0}</h3>
            <p>Actividades</p>
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
            placeholder="Buscar por título o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category filter - Multi-select */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label>
            <i className="fas fa-folder"></i> Categorías
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
                  <i className={`fas ${cat.icono || 'fa-folder'}`} style={{ marginRight: '8px', color: cat.color }}></i>
                  <span>{cat.nombre}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

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
            {TIPOS.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="nivelFilter">
            <i className="fas fa-layer-group"></i> Nivel
          </label>
          <select
            id="nivelFilter"
            value={nivelFilter}
            onChange={(e) => setNivelFilter(e.target.value)}
          >
            <option value="">{loadingCursos ? 'Cargando niveles...' : 'Todos los niveles'}</option>
            {cursosConfig.map((curso) => (
              <option key={curso.codigo} value={curso.nombre}>
                {curso.nombre}
              </option>
            ))}
          </select>
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={filteredMaterials.length}>
        <button
          className="btn btn-success"
          onClick={handleExportMaterials}
          disabled={filteredMaterials.length === 0}
        >
          <i className="fas fa-download"></i>
          <span>Exportar</span>
        </button>
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
      {!isLoading && !isError && filteredMaterials.length === 0 && (
        <EmptyStateCard
          icon="fa-folder-open"
          title={searchTerm || categoriaFilter || tipoFilter || nivelFilter
            ? 'No se encontraron materiales'
            : 'No hay materiales registrados'}
          description={
            searchTerm || categoriaFilter || tipoFilter || nivelFilter
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Comienza agregando tu primer material educativo'
          }
          iconColor="#667eea"
          actionText={!(searchTerm || categoriaFilter || tipoFilter || nivelFilter)
            ? 'Subir Material'
            : ''}
          onAction={!(searchTerm || categoriaFilter || tipoFilter || nivelFilter)
            ? handleCreateMaterial
            : null}
        />
      )}

      {/* Materials Grid */}
      {!isLoading && !isError && filteredMaterials.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}
        >
          {filteredMaterials.map((material) => {
            const tipoConfig = TIPOS.find(t => t.value === material.tipo);

            return (
              <div key={material.id} className="card" style={{ padding: '20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '8px',
                      backgroundColor: tipoConfig?.color || '#667eea',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      flexShrink: 0
                    }}
                  >
                    <i className={`fas ${tipoConfig?.icon || 'fa-file'}`}></i>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1em' }}>
                      {material.titulo}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85em', color: '#6b7280' }}>
                      {tipoConfig?.label || material.tipo}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div style={{ marginBottom: '15px' }}>
                  {material.descripcion && (
                    <p style={{
                      margin: '0 0 10px',
                      fontSize: '0.9em',
                      color: '#4b5563',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {material.descripcion}
                    </p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                    {material.categorias && material.categorias.map(cat => (
                      <span key={cat.id} style={{
                        backgroundColor: cat.color || '#667eea',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}>
                        <i className={`fas ${cat.icono || 'fa-folder'}`}></i> {cat.nombre}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85em', color: '#6b7280' }}>
                    <div>
                      <i className="fas fa-layer-group" style={{ width: '20px' }}></i>
                      {cursosConfig.find(c => c.codigo === material.nivel)?.nombre || material.nivel}
                    </div>
                    <div>
                      <i className="fas fa-calendar" style={{ width: '20px' }}></i>
                      {formatDate(material.fechaSubida || material.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => handleVerDetalle(material)}
                  >
                    <i className="fas fa-eye"></i>
                    <span>Ver</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleEditMaterial(material)}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteMaterial(material)}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Material Modal */}
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
                <i className={`fas ${editingMaterial ? 'fa-edit' : 'fa-plus'}`}></i>
                {' '}
                {editingMaterial ? 'Editar Material' : 'Subir Material'}
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
                    placeholder="Ej: Guía de Matemáticas - Números del 1 al 10"
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
                    placeholder="Describe el contenido del material..."
                    rows={3}
                    style={{ resize: 'vertical' }}
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
                    {TIPOS.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label>Categorías <span style={{ color: '#e53e3e' }}>*</span></label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '10px',
                    padding: '10px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {CATEGORIAS.map(cat => (
                      <label key={cat.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        padding: '8px',
                        backgroundColor: formData.categorias.includes(cat.id) ? '#f0f9ff' : 'transparent',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s'
                      }}>
                        <input
                          type="checkbox"
                          checked={formData.categorias.includes(cat.id)}
                          onChange={(e) => {
                            const newCategorias = e.target.checked
                              ? [...formData.categorias, cat.id]
                              : formData.categorias.filter(id => id !== cat.id);
                            setFormData({ ...formData, categorias: newCategorias });
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <i className={`fas ${cat.icono || 'fa-folder'}`} style={{ color: cat.color || '#667eea' }}></i>
                        <span>{cat.nombre}</span>
                      </label>
                    ))}
                  </div>
                  {formData.categorias.length === 0 && (
                    <small style={{ color: '#e53e3e', marginTop: '5px', display: 'block' }}>
                      Selecciona al menos una categoría
                    </small>
                  )}
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="nivel">
                    Nivel <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="nivel"
                    name="nivel"
                    value={formData.nivel}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">{loadingCursos ? 'Cargando niveles...' : 'Seleccionar nivel...'}</option>
                    {cursosConfig.map((curso) => (
                      <option key={curso.codigo} value={curso.nombre}>
                        {curso.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="archivo">
                    Archivo {!editingMaterial && <span style={{ color: '#e53e3e' }}>*</span>}
                  </label>
                  <input
                    id="archivo"
                    type="file"
                    name="archivo"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp4"
                    required={!editingMaterial}
                  />
                  {selectedFile && (
                    <p style={{ marginTop: '8px', fontSize: '0.9em', color: '#666' }}>
                      <i className="fas fa-file"></i> {selectedFile.name}
                    </p>
                  )}
                  {editingMaterial && editingMaterial.archivoNombre && !selectedFile && (
                    <p style={{ marginTop: '8px', fontSize: '0.9em', color: '#666' }}>
                      <i className="fas fa-file"></i> Actual: {editingMaterial.archivoNombre}
                    </p>
                  )}
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
                    <i className={`fas ${editingMaterial ? 'fa-save' : 'fa-upload'}`}></i>
                  )}
                  <span>
                    {editingMaterial ? 'Guardar Cambios' : 'Subir Material'}
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

export default Materiales;
