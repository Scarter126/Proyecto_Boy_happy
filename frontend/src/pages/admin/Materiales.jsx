/**
 * Materiales Management Page - Boy Happy
 *
 * Comprehensive production-ready page for educational materials management.
 * Implements full CRUD operations with React Query, UI components, and best practices.
 *
 * Features:
 * - Search by title and description
 * - Filter by category, type, course, and status
 * - Create, edit, delete materials
 * - Upload files
 * - Approve, reject, and request corrections
 * - Statistics dashboard by type
 * - Grid view with MaterialCard
 * - Loading and error states
 * - Optimistic updates
 * - Responsive design
 * - Accessibility
 */

import { useState, useMemo } from 'react';
import {
  useMateriales,
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial,
  useAprobarMaterial,
  useRechazarMaterial,
  useSolicitarCorreccionMaterial
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
import MaterialCard from '../../components/business/MaterialCard';
import { EstadoBadge, ActivoBadge } from '../../components/ui/Badge';
import { formatDate, truncate } from '../../utils/helpers';
import Swal from 'sweetalert2';

function Materiales() {
  // ==========================================
  // HOOKS DE CONFIGURACIÓN DINÁMICA
  // ==========================================

  const { categorias: allCategorias = [], isLoading: categoriasLoading } = useCategorias();
  const CATEGORIAS = useMemo(() =>
    allCategorias.filter(cat => cat.tipoRecurso === 'academico'),
    [allCategorias]
  );
  const { data: TIPOS = [], isLoading: tiposLoading } = useTiposArchivo();

  // Estados hardcoded (before configurables, now statically defined)
  const ESTADOS = [
    { value: 'pendiente', label: 'Pendiente', color: '#ecc94b' },
    { value: 'aprobado', label: 'Aprobado', color: '#48bb78' },
    { value: 'rechazado', label: 'Rechazado', color: '#f56565' },
    { value: 'en_correccion', label: 'En Corrección', color: '#ed8936' }
  ];

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState([]);
  const [tipoFilter, setTipoFilter] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'documento',
    categorias: [],
    curso: '',
    url: '',
    activo: true
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: materiales = [], isLoading, isError, error, refetch } = useMateriales();
  const { data: cursosConfig = [], isLoading: loadingCursos } = useCursos();
  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const deleteMutation = useDeleteMaterial();
  const aprobarMutation = useAprobarMaterial();
  const rechazarMutation = useRechazarMaterial();
  const solicitarCorreccionMutation = useSolicitarCorreccionMaterial();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Combinar todos los estados de carga
  const isPageLoading = isLoading || loadingCursos || categoriasLoading || tiposLoading;

  // Filter materials based on search and filters
  const filteredMaterials = useMemo(() => {
    if (!Array.isArray(materiales)) return [];

    return materiales.filter(material => {
      // Search filter (title and description)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        material.titulo?.toLowerCase().includes(searchLower) ||
        material.descripcion?.toLowerCase().includes(searchLower);

      // Category filter (multi-select: OR logic)
      const matchesCategoria = categoriaFilter.length === 0 ||
        (material.categorias && material.categorias.some(cat => categoriaFilter.includes(cat.id)));

      // Type filter
      const matchesTipo = !tipoFilter || material.tipo === tipoFilter;

      // Course filter
      const matchesCurso = !cursoFilter || material.curso === cursoFilter;

      // Status filter
      const matchesEstado = !estadoFilter || material.estado === estadoFilter;

      return matchesSearch && matchesCategoria && matchesTipo && matchesCurso && matchesEstado;
    });
  }, [materiales, searchTerm, categoriaFilter, tipoFilter, cursoFilter, estadoFilter]);

  // Calculate statistics by type
  const stats = useMemo(() => {
    if (!Array.isArray(materiales)) return { total: 0, byTipo: {}, byEstado: {} };

    const byTipo = materiales.reduce((acc, material) => {
      acc[material.tipo] = (acc[material.tipo] || 0) + 1;
      return acc;
    }, {});

    const byEstado = materiales.reduce((acc, material) => {
      acc[material.estado || 'pendiente'] = (acc[material.estado || 'pendiente'] || 0) + 1;
      return acc;
    }, {});

    return {
      total: materiales.length,
      byTipo,
      byEstado
    };
  }, [materiales]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  // Open modal for creating a new material
  const handleCreateMaterial = () => {
    setEditingMaterial(null);
    setSelectedFile(null);
    setFormData({
      titulo: '',
      descripcion: '',
      tipo: 'documento',
      categorias: [],
      curso: '',
      url: '',
      activo: true
    });
    setIsModalOpen(true);
  };

  // Open modal for editing an existing material
  const handleEditMaterial = (material) => {
    setEditingMaterial(material);
    setSelectedFile(null);
    setFormData({
      titulo: material.titulo || '',
      descripcion: material.descripcion || '',
      tipo: material.tipo || 'documento',
      categorias: material.categorias ? material.categorias.map(cat => cat.id) : [],
      curso: material.curso || '',
      url: material.url || material.archivoUrl || '',
      activo: material.activo !== false
    });
    setIsModalOpen(true);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // If it's a link type, don't override the URL
      if (formData.tipo !== 'link') {
        setFormData(prev => ({ ...prev, url: '' }));
      }
    }
  };

  // Helper: Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove data:mime;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Submit form (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate
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
      // Prepare data for API (JSON format, not FormData)
      const submitData = {
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        curso: formData.curso,
        categorias: formData.categorias,
        tipo: formData.tipo,
        activo: formData.activo
      };

      // If file selected, convert to base64
      if (selectedFile) {
        submitData.archivoBase64 = await fileToBase64(selectedFile);
        submitData.nombreArchivo = selectedFile.name;
        submitData.tipoArchivo = selectedFile.type;
      }

      // If it's a link type, include URL
      if (formData.tipo === 'link' && formData.url) {
        submitData.urlArchivo = formData.url;
      }

      if (editingMaterial) {
        // Update existing material
        await updateMutation.mutateAsync({
          id: editingMaterial.id,
          ...submitData
        });
      } else {
        // Create new material
        await createMutation.mutateAsync(submitData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting form:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.error || 'No se pudo guardar el material'
      });
    }
  };

  // Delete material with confirmation
  const handleDeleteMaterial = async (material) => {
    const result = await Swal.fire({
      title: '¿Eliminar material?',
      html: `
        <p>¿Estás seguro de eliminar <strong>${material.titulo}</strong>?</p>
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
        await deleteMutation.mutateAsync(material.id);
      } catch (error) {
        console.error('Error deleting material:', error);
      }
    }
  };

  // Approve material
  const handleAprobarMaterial = async (material) => {
    const { value: observaciones } = await Swal.fire({
      title: 'Aprobar Material',
      html: `<p>¿Aprobar el material <strong>${material.titulo}</strong>?</p>`,
      input: 'textarea',
      inputLabel: 'Observaciones (opcional)',
      inputPlaceholder: 'Escribe observaciones sobre el material...',
      showCancelButton: true,
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#48bb78'
    });

    if (observaciones !== undefined) {
      try {
        await aprobarMutation.mutateAsync({
          id: material.id,
          revisadoPor: 'admin', // TODO: Get from auth context
          observaciones: observaciones || ''
        });
      } catch (error) {
        console.error('Error approving material:', error);
      }
    }
  };

  // Reject material
  const handleRechazarMaterial = async (material) => {
    const { value: motivo } = await Swal.fire({
      title: 'Rechazar Material',
      html: `<p>¿Rechazar el material <strong>${material.titulo}</strong>?</p>`,
      input: 'textarea',
      inputLabel: 'Motivo del rechazo',
      inputPlaceholder: 'Explica el motivo del rechazo...',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e53e3e',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes proporcionar un motivo';
        }
      }
    });

    if (motivo) {
      try {
        await rechazarMutation.mutateAsync({
          id: material.id,
          revisadoPor: 'admin', // TODO: Get from auth context
          motivo
        });
      } catch (error) {
        console.error('Error rejecting material:', error);
      }
    }
  };

  // Request correction
  const handleSolicitarCorreccion = async (material) => {
    const { value: observaciones } = await Swal.fire({
      title: 'Solicitar Corrección',
      html: `<p>Solicitar correcciones para <strong>${material.titulo}</strong></p>`,
      input: 'textarea',
      inputLabel: 'Observaciones',
      inputPlaceholder: 'Describe las correcciones necesarias...',
      showCancelButton: true,
      confirmButtonText: 'Solicitar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ed8936',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes proporcionar observaciones';
        }
      }
    });

    if (observaciones) {
      try {
        await solicitarCorreccionMutation.mutateAsync({
          id: material.id,
          revisadoPor: 'admin', // TODO: Get from auth context
          observaciones
        });
      } catch (error) {
        console.error('Error requesting correction:', error);
      }
    }
  };

  // View material details
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
          <p><strong>Curso:</strong> ${cursosConfig.find(c => c.codigo === material.curso)?.nombre || material.curso}</p>
          <p><strong>Estado:</strong> ${ESTADOS.find(e => e.value === material.estado)?.label || material.estado}</p>
          <p><strong>Fecha:</strong> ${formatDate(material.fechaSubida || material.createdAt)}</p>
          ${material.creadoPor ? `<p><strong>Creado por:</strong> ${material.creadoPor}</p>` : ''}
          ${material.archivoUrl ? `<p><strong>Archivo:</strong> <a href="${material.archivoUrl}" target="_blank">Descargar</a></p>` : ''}
        </div>
      `,
      width: 600,
      confirmButtonText: 'Cerrar'
    });
  };

  // Apply filters
  const handleApplyFilters = () => {
    console.log('Filters applied:', {
      searchTerm,
      categoriaFilter,
      tipoFilter,
      cursoFilter,
      estadoFilter
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoriaFilter([]);
    setTipoFilter('');
    setCursoFilter('');
    setEstadoFilter('');
  };

  // Export materials to CSV
  const handleExportMaterials = () => {
    const csv = [
      ['Título', 'Descripción', 'Categoría', 'Tipo', 'Curso', 'Estado', 'Fecha'].join(','),
      ...filteredMaterials.map(material => [
        `"${material.titulo}"`,
        `"${material.descripcion || ''}"`,
        material.categoria,
        material.tipo,
        material.curso,
        material.estado || 'pendiente',
        formatDate(material.fechaSubida || material.createdAt)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `materiales_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Gestión de Materiales"
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
            <i className="fas fa-file-pdf"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byTipo.documento || 0}</h3>
            <p>Documentos</p>
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
            <i className="fas fa-image"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byTipo.imagen || 0}</h3>
            <p>Imágenes</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-link"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byTipo.link || 0}</h3>
            <p>Enlaces</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byEstado.pendiente || 0}</h3>
            <p>Pendientes</p>
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
            {TIPOS.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
        </div>

        {/* Course filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="cursoFilter">
            <i className="fas fa-graduation-cap"></i> Curso
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

        {/* Status filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="estadoFilter">
            <i className="fas fa-toggle-on"></i> Estado
          </label>
          <select
            id="estadoFilter"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map(estado => (
              <option key={estado.value} value={estado.value}>{estado.label}</option>
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
      {isPageLoading && (
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
      {!isPageLoading && !isError && filteredMaterials.length === 0 && (
        <EmptyStateCard
          icon="fa-folder-open"
          title={searchTerm || categoriaFilter || tipoFilter || cursoFilter || estadoFilter
            ? 'No se encontraron materiales'
            : 'No hay materiales registrados'}
          description={
            searchTerm || categoriaFilter || tipoFilter || cursoFilter || estadoFilter
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Comienza agregando tu primer material educativo'
          }
          iconColor="#667eea"
          actionText={!(searchTerm || categoriaFilter || tipoFilter || cursoFilter || estadoFilter)
            ? 'Subir Material'
            : ''}
          onAction={!(searchTerm || categoriaFilter || tipoFilter || cursoFilter || estadoFilter)
            ? handleCreateMaterial
            : null}
        />
      )}

      {/* Materials Grid */}
      {!isPageLoading && !isError && filteredMaterials.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}
        >
          {filteredMaterials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              showActions={true}
              onVerDetalle={handleVerDetalle}
              onEdit={handleEditMaterial}
              onDelete={handleDeleteMaterial}
              onAprobar={handleAprobarMaterial}
              onSolicitarCorreccion={handleSolicitarCorreccion}
              onRechazar={handleRechazarMaterial}
            />
          ))}
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
            {/* Modal Header */}
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
                    placeholder="Ej: Guía de Matemáticas - Números del 1 al 10"
                    required
                  />
                </div>

                {/* Descripción */}
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

                {/* Tipo */}
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

                {/* Categorías */}
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

                {/* Curso */}
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="curso">
                    Curso <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="curso"
                    name="curso"
                    value={formData.curso}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">{loadingCursos ? 'Cargando cursos...' : 'Seleccionar curso...'}</option>
                    {cursosConfig.map((curso) => (
                      <option key={curso.codigo} value={curso.nombre}>
                        {curso.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* URL (for link type) or File Upload */}
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
                        formData.tipo === 'documento' ? '.pdf,.doc,.docx,.ppt,.pptx' :
                        formData.tipo === 'video' ? '.mp4,.avi,.mov,.wmv' :
                        formData.tipo === 'imagen' ? '.jpg,.jpeg,.png,.gif,.svg' :
                        '*'
                      }
                      required={!editingMaterial && formData.tipo !== 'link'}
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
                )}

                {/* Estado */}
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="activo">Estado</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                    <input
                      id="activo"
                      type="checkbox"
                      name="activo"
                      checked={formData.activo}
                      onChange={handleInputChange}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    <label htmlFor="activo" style={{ margin: 0 }}>
                      Material activo
                    </label>
                  </div>
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
