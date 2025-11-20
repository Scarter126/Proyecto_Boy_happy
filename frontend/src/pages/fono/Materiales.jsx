/**
 * Materiales - Therapeutic Materials Management for Speech Therapists
 *
 * Features:
 * - List available therapeutic materials
 * - Filter by category, type, difficulty level
 * - Upload new materials
 * - Edit/delete materials
 * - Material preview/download
 */

import { useState, useMemo } from 'react';
import {
  useMateriales,
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial
} from '../../hooks/useMateriales';
import {
  useTiposArchivo,
  useNivelesDificultad
} from '../../hooks/useConfiguracion';
import { useCategorias } from '../../hooks/useCategorias';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, truncate } from '../../utils/helpers';
import Swal from 'sweetalert2';

function MaterialesFono() {
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
    categorias: [],
    tipo: 'documento',
    nivel: 'basico',
    url: '',
    etiquetas: '',
    instrucciones: '',
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: materiales = [], isLoading, isError, error, refetch } = useMateriales({ area: 'fonoaudiologia' });
  const { categorias: allCategorias = [], isLoading: categoriasLoading } = useCategorias();
  const CATEGORIAS_FONO = useMemo(() =>
    allCategorias.filter(cat => cat.tipoRecurso === 'terapeutico'),
    [allCategorias]
  );
  const { data: TIPOS_MATERIAL = [], isLoading: tiposLoading } = useTiposArchivo();
  const { data: NIVELES_DIFICULTAD = [], isLoading: nivelesLoading } = useNivelesDificultad();

  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const deleteMutation = useDeleteMaterial();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const filteredMateriales = useMemo(() => {
    if (!Array.isArray(materiales)) return [];

    return materiales.filter(material => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        material.titulo?.toLowerCase().includes(searchLower) ||
        material.descripcion?.toLowerCase().includes(searchLower) ||
        material.etiquetas?.toLowerCase().includes(searchLower);

      // Category filter (multi-select: OR logic)
      const matchesCategoria = categoriaFilter.length === 0 ||
        (material.categorias && material.categorias.some(cat => categoriaFilter.includes(cat.id)));
      const matchesTipo = !tipoFilter || material.tipo === tipoFilter;
      const matchesNivel = !nivelFilter || material.nivel === nivelFilter;

      return matchesSearch && matchesCategoria && matchesTipo && matchesNivel;
    });
  }, [materiales, searchTerm, categoriaFilter, tipoFilter, nivelFilter]);

  const stats = useMemo(() => {
    if (!Array.isArray(materiales)) return { total: 0, porTipo: {}, porCategoria: {} };

    const porTipo = materiales.reduce((acc, m) => {
      acc[m.tipo] = (acc[m.tipo] || 0) + 1;
      return acc;
    }, {});

    const porCategoria = materiales.reduce((acc, m) => {
      acc[m.categoria] = (acc[m.categoria] || 0) + 1;
      return acc;
    }, {});

    return {
      total: materiales.length,
      porTipo,
      porCategoria
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
      categorias: [],
      tipo: 'documento',
      nivel: 'basico',
      url: '',
      etiquetas: '',
      instrucciones: '',
    });
    setIsModalOpen(true);
  };

  const handleEditMaterial = (material) => {
    setEditingMaterial(material);
    setSelectedFile(null);
    setFormData({
      titulo: material.titulo || '',
      descripcion: material.descripcion || '',
      categorias: material.categorias ? material.categorias.map(cat => cat.id) : [],
      tipo: material.tipo || 'documento',
      nivel: material.nivel || 'basico',
      url: material.url || material.archivoUrl || '',
      etiquetas: material.etiquetas || '',
      instrucciones: material.instrucciones || '',
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (formData.tipo !== 'link') {
        setFormData(prev => ({ ...prev, url: '' }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.titulo.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'El titulo es obligatorio'
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
      const data = {
        ...formData,
        area: 'fonoaudiologia',
        archivo: selectedFile
      };

      if (editingMaterial) {
        await updateMutation.mutateAsync({
          id: editingMaterial.id,
          ...data
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting material:', error);
    }
  };

  const handleDeleteMaterial = async (material) => {
    const result = await Swal.fire({
      title: 'Eliminar material?',
      html: `<p>Estas seguro de eliminar <strong>${material.titulo}</strong>?</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Si, eliminar',
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
    const tipoInfo = TIPOS_MATERIAL.find(t => t.value === material.tipo);
    const nivelInfo = NIVELES_DIFICULTAD.find(n => n.value === material.nivel);

    Swal.fire({
      title: material.titulo,
      html: `
        <div style="text-align: left;">
          <p><strong>Descripcion:</strong> ${material.descripcion || 'Sin descripcion'}</p>
          <p><strong>Categorías:</strong> ${categorias}</p>
          <p><strong>Tipo:</strong> ${tipoInfo?.label || material.tipo}</p>
          <p><strong>Nivel:</strong> ${nivelInfo?.label || material.nivel}</p>
          ${material.etiquetas ? `<p><strong>Etiquetas:</strong> ${material.etiquetas}</p>` : ''}
          ${material.instrucciones ? `<p><strong>Instrucciones:</strong> ${material.instrucciones}</p>` : ''}
          ${material.archivoUrl ? `<p><strong>Archivo:</strong> <a href="${material.archivoUrl}" target="_blank">Ver/Descargar</a></p>` : ''}
          ${material.url ? `<p><strong>URL:</strong> <a href="${material.url}" target="_blank">${material.url}</a></p>` : ''}
          <p><strong>Fecha:</strong> ${formatDate(material.createdAt || material.fechaSubida)}</p>
        </div>
      `,
      width: 700,
      confirmButtonText: 'Cerrar'
    });
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { searchTerm, categoriaFilter, tipoFilter, nivelFilter });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoriaFilter([]);
    setTipoFilter('');
    setNivelFilter('');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Titulo', 'Descripcion', 'Categoria', 'Tipo', 'Nivel', 'Etiquetas', 'Fecha'].join(','),
      ...filteredMateriales.map(material => [
        `"${material.titulo}"`,
        `"${material.descripcion || ''}"`,
        material.categoria,
        material.tipo,
        material.nivel,
        `"${material.etiquetas || ''}"`,
        formatDate(material.createdAt || material.fechaSubida)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `materiales_fono_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Materiales Terapeuticos"
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
            <i className="fas fa-folder"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Materiales</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-file-pdf"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.documento || 0}</h3>
            <p>Documentos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-image"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.imagen || 0}</h3>
            <p>Imagenes</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-video"></i>
          </div>
          <div className="card-content">
            <h3>{stats.porTipo.video || 0}</h3>
            <p>Videos</p>
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
            placeholder="Buscar por titulo, descripcion o etiquetas..."
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
              {CATEGORIAS_FONO.map(cat => (
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
            {TIPOS_MATERIAL.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="nivelFilter">
            <i className="fas fa-signal"></i> Nivel
          </label>
          <select
            id="nivelFilter"
            value={nivelFilter}
            onChange={(e) => setNivelFilter(e.target.value)}
          >
            <option value="">Todos los niveles</option>
            {NIVELES_DIFICULTAD.map(nivel => (
              <option key={nivel.value} value={nivel.value}>{nivel.label}</option>
            ))}
          </select>
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={filteredMateriales.length}>
        <button
          className="btn btn-success"
          onClick={handleExportCSV}
          disabled={filteredMateriales.length === 0}
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
      {!isLoading && !isError && filteredMateriales.length === 0 && (
        <EmptyStateCard
          icon="fa-folder-open"
          title={searchTerm || categoriaFilter || tipoFilter || nivelFilter
            ? 'No se encontraron materiales'
            : 'No hay materiales disponibles'}
          description={
            searchTerm || categoriaFilter || tipoFilter || nivelFilter
              ? 'Intenta ajustar los filtros de busqueda'
              : 'Comienza subiendo tu primer material terapeutico'
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
      {!isLoading && !isError && filteredMateriales.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}
        >
          {filteredMateriales.map((material) => {
            const tipoInfo = TIPOS_MATERIAL.find(t => t.value === material.tipo);
            const nivelInfo = NIVELES_DIFICULTAD.find(n => n.value === material.nivel);

            return (
              <div key={material.id} className="card" style={{ padding: '20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1em', color: '#1f2937' }}>
                      <i className={`fas ${tipoInfo?.icon || 'fa-file'}`} style={{ color: '#667eea', marginRight: '8px' }}></i>
                      {material.titulo}
                    </h3>
                  </div>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: nivelInfo?.color || '#6b7280',
                      color: 'white'
                    }}
                  >
                    {nivelInfo?.label || material.nivel}
                  </span>
                </div>

                {/* Content */}
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ margin: '0 0 12px', color: '#4b5563', fontSize: '0.9em', lineHeight: '1.5' }}>
                    {truncate(material.descripcion, 120) || 'Sin descripcion'}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {material.categorias && material.categorias.map(cat => (
                      <span key={cat.id} className="badge badge-secondary">
                        <i className={`fas ${cat.icono || 'fa-tag'}`}></i>
                        {' '}
                        {cat.nombre}
                      </span>
                    ))}
                    {material.etiquetas && (
                      <span className="badge badge-info">
                        <i className="fas fa-tags"></i> {material.etiquetas}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85em', color: '#6b7280' }}>
                    <i className="fas fa-calendar"></i> {formatDate(material.createdAt || material.fechaSubida)}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => handleVerDetalle(material)}
                  >
                    <i className="fas fa-eye"></i>
                    <span>Ver</span>
                  </button>
                  {(material.archivoUrl || material.url) && (
                    <a
                      href={material.archivoUrl || material.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success btn-sm"
                      style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <i className="fas fa-download"></i>
                      <span>Abrir</span>
                    </a>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEditMaterial(material)}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
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
                    Titulo <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="titulo"
                    type="text"
                    name="titulo"
                    value={formData.titulo}
                    onChange={handleInputChange}
                    placeholder="Ej: Tarjetas de articulacion - Fonema /r/"
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="descripcion">
                    Descripcion
                  </label>
                  <textarea
                    id="descripcion"
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    placeholder="Describe el material y su uso..."
                    rows={3}
                  />
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
                    {CATEGORIAS_FONO.map(cat => (
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
                    {TIPOS_MATERIAL.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="nivel">
                    Nivel de Dificultad <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="nivel"
                    name="nivel"
                    value={formData.nivel}
                    onChange={handleInputChange}
                    required
                  >
                    {NIVELES_DIFICULTAD.map(nivel => (
                      <option key={nivel.value} value={nivel.value}>{nivel.label}</option>
                    ))}
                  </select>
                </div>

                {formData.tipo === 'link' ? (
                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label htmlFor="url">
                      URL <span style={{ color: '#e53e3e' }}>*</span>
                    </label>
                    <input
                      id="url"
                      type="url"
                      name="url"
                      value={formData.url}
                      onChange={handleInputChange}
                      placeholder="https://ejemplo.com/recurso"
                      required={formData.tipo === 'link'}
                    />
                  </div>
                ) : (
                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label htmlFor="archivo">
                      Archivo {!editingMaterial && <span style={{ color: '#e53e3e' }}>*</span>}
                    </label>
                    <input
                      id="archivo"
                      type="file"
                      name="archivo"
                      onChange={handleFileChange}
                      accept={
                        formData.tipo === 'documento' ? '.pdf,.doc,.docx' :
                        formData.tipo === 'imagen' ? '.jpg,.jpeg,.png,.gif' :
                        formData.tipo === 'audio' ? '.mp3,.wav' :
                        formData.tipo === 'video' ? '.mp4,.avi,.mov' :
                        '*'
                      }
                      required={!editingMaterial && formData.tipo !== 'link'}
                    />
                    {selectedFile && (
                      <p style={{ marginTop: '8px', fontSize: '0.9em', color: '#666' }}>
                        <i className="fas fa-file"></i> {selectedFile.name}
                      </p>
                    )}
                  </div>
                )}

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="etiquetas">
                    Etiquetas
                  </label>
                  <input
                    id="etiquetas"
                    type="text"
                    name="etiquetas"
                    value={formData.etiquetas}
                    onChange={handleInputChange}
                    placeholder="Ej: /r/, rotacismo, praxias"
                  />
                  <small style={{ display: 'block', marginTop: '4px', color: '#6b7280' }}>
                    Separa las etiquetas con comas
                  </small>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="instrucciones">
                    Instrucciones de Uso
                  </label>
                  <textarea
                    id="instrucciones"
                    name="instrucciones"
                    value={formData.instrucciones}
                    onChange={handleInputChange}
                    placeholder="Como utilizar este material en terapia..."
                    rows={3}
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
                    <i className={`fas ${editingMaterial ? 'fa-save' : 'fa-upload'}`}></i>
                  )}
                  <span>{editingMaterial ? 'Guardar Cambios' : 'Subir Material'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaterialesFono;
