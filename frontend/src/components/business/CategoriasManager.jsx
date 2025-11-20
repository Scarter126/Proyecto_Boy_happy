import { useState } from 'react';
import useCategorias, { getCategoriaPath } from '../../hooks/useCategorias';
import Swal from 'sweetalert2';

/**
 * Componente para gestionar categorías dentro de Configuración
 *
 * Características:
 * - Vista tabla y árbol jerárquico
 * - CRUD completo de categorías
 * - Soporte para jerarquías parent-child
 * - Colores e iconos personalizables
 */

export default function CategoriasManager() {
  const {
    categorias,
    arbol,
    isLoading,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    isCreating,
    isUpdating,
    isDeleting
  } = useCategorias();

  const [vista, setVista] = useState('tabla');
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Toggle expansión de nodo en árbol
  const toggleNode = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Handler: Crear categoría
  const handleCrear = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Nueva Categoría de Materiales',
      html: `
        <div style="text-align: left;">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nombre *</label>
            <input id="nombre" class="swal2-input" style="width: 90%;" placeholder="Ej: Matemáticas">
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descripción</label>
            <textarea id="descripcion" class="swal2-textarea" style="width: 90%;" placeholder="Descripción opcional"></textarea>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Color</label>
            <input id="color" type="color" class="swal2-input" style="width: 90%;" value="#667eea">
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Icono (FontAwesome)</label>
            <input id="icono" class="swal2-input" style="width: 90%;" placeholder="fa-folder" value="fa-folder">
            <small style="color: #666;">
              Ej: fa-calculator, fa-book, fa-flask
              <br>
              <a href="https://fontawesome.com/search?o=r&m=free" target="_blank" rel="noopener noreferrer"
                 style="color: #667eea; text-decoration: underline;">
                🔍 Ver iconos disponibles
              </a>
            </small>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Categoría Padre</label>
            <select id="parentId" class="swal2-select" style="width: 90%;">
              <option value="">Sin categoría padre (raíz)</option>
              ${categorias.map(cat => `
                <option value="${cat.id}">${getCategoriaPath(categorias, cat.id)}</option>
              `).join('')}
            </select>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tipo de Recurso</label>
            <select id="tipoRecurso" class="swal2-select" style="width: 90%;">
              <option value="general">General</option>
              <option value="academico">Académico</option>
              <option value="terapeutico">Terapéutico</option>
            </select>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Crear Categoría',
      cancelButtonText: 'Cancelar',
      width: 600,
      preConfirm: () => {
        const nombre = document.getElementById('nombre').value.trim();
        if (!nombre) {
          Swal.showValidationMessage('El nombre es requerido');
          return false;
        }
        return {
          nombre,
          descripcion: document.getElementById('descripcion').value.trim(),
          color: document.getElementById('color').value,
          icono: document.getElementById('icono').value.trim(),
          parentId: document.getElementById('parentId').value || null,
          tipoRecurso: document.getElementById('tipoRecurso').value
        };
      }
    });

    if (formValues) {
      try {
        await createCategoria(formValues);
        Swal.fire({
          icon: 'success',
          title: '✓ Categoría creada',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'No se pudo crear la categoría'
        });
      }
    }
  };

  // Handler: Editar categoría
  const handleEditar = async (categoria) => {
    const { value: formValues } = await Swal.fire({
      title: 'Editar Categoría',
      html: `
        <div style="text-align: left;">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nombre *</label>
            <input id="nombre" class="swal2-input" style="width: 90%;" value="${categoria.nombre}">
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descripción</label>
            <textarea id="descripcion" class="swal2-textarea" style="width: 90%;">${categoria.descripcion || ''}</textarea>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Color</label>
            <input id="color" type="color" class="swal2-input" style="width: 90%;" value="${categoria.color || '#667eea'}">
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Icono (FontAwesome)</label>
            <input id="icono" class="swal2-input" style="width: 90%;" value="${categoria.icono || 'fa-folder'}">
            <small style="color: #666;">
              Ej: fa-calculator, fa-book, fa-flask
              <br>
              <a href="https://fontawesome.com/search?o=r&m=free" target="_blank" rel="noopener noreferrer"
                 style="color: #667eea; text-decoration: underline;">
                🔍 Ver iconos disponibles
              </a>
            </small>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Categoría Padre</label>
            <select id="parentId" class="swal2-select" style="width: 90%;">
              <option value="">Sin categoría padre (raíz)</option>
              ${categorias
                .filter(cat => cat.id !== categoria.id)
                .map(cat => `
                  <option value="${cat.id}" ${cat.id === categoria.parentId ? 'selected' : ''}>
                    ${getCategoriaPath(categorias, cat.id)}
                  </option>
                `).join('')}
            </select>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Contexto</label>
            <select id="tipoRecurso" class="swal2-select" style="width: 90%;">
              <option value="general" ${categoria.tipoRecurso === 'general' ? 'selected' : ''}>General</option>
              <option value="academico" ${categoria.tipoRecurso === 'academico' ? 'selected' : ''}>Académico</option>
              <option value="terapeutico" ${categoria.tipoRecurso === 'terapeutico' ? 'selected' : ''}>Terapéutico</option>
            </select>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Estado</label>
            <select id="activa" class="swal2-select" style="width: 90%;">
              <option value="true" ${categoria.activa !== false ? 'selected' : ''}>Activa</option>
              <option value="false" ${categoria.activa === false ? 'selected' : ''}>Inactiva</option>
            </select>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar Cambios',
      cancelButtonText: 'Cancelar',
      width: 600,
      preConfirm: () => {
        const nombre = document.getElementById('nombre').value.trim();
        if (!nombre) {
          Swal.showValidationMessage('El nombre es requerido');
          return false;
        }
        return {
          id: categoria.id,
          nombre,
          descripcion: document.getElementById('descripcion').value.trim(),
          color: document.getElementById('color').value,
          icono: document.getElementById('icono').value.trim(),
          parentId: document.getElementById('parentId').value || null,
          tipoRecurso: document.getElementById('tipoRecurso').value,
          activa: document.getElementById('activa').value === 'true'
        };
      }
    });

    if (formValues) {
      try {
        await updateCategoria(formValues);
        Swal.fire({
          icon: 'success',
          title: '✓ Categoría actualizada',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'No se pudo actualizar la categoría'
        });
      }
    }
  };

  // Handler: Eliminar categoría
  const handleEliminar = async (categoria) => {
    const result = await Swal.fire({
      title: '¿Eliminar categoría?',
      html: `
        <p>Se eliminará: <strong>${categoria.nombre}</strong></p>
        <p style="color: #f56565; margin-top: 10px;">
          <i class="fas fa-exclamation-triangle"></i>
          No se puede eliminar si tiene materiales asignados.
        </p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f56565'
    });

    if (result.isConfirmed) {
      try {
        await deleteCategoria(categoria.id);
        Swal.fire({
          icon: 'success',
          title: '✓ Categoría eliminada',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'No se puede eliminar',
          text: error.message || 'La categoría tiene materiales asignados'
        });
      }
    }
  };

  // Renderizar árbol recursivo
  const renderArbol = (nodos, nivel = 0) => {
    if (!nodos || nodos.length === 0) return null;

    return (
      <ul style={{
        listStyle: 'none',
        paddingLeft: nivel === 0 ? '0' : '25px',
        marginTop: nivel === 0 ? '0' : '5px'
      }}>
        {nodos.map(nodo => {
          const hasChildren = nodo.children && nodo.children.length > 0;
          const isExpanded = expandedNodes.has(nodo.id);

          return (
            <li key={nodo.id} style={{ marginBottom: '5px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px',
                backgroundColor: '#f7fafc',
                borderRadius: '4px',
                border: '1px solid #e2e8f0'
              }}>
                {hasChildren && (
                  <button
                    onClick={() => toggleNode(nodo.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginRight: '8px',
                      color: '#4a5568'
                    }}
                  >
                    <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
                  </button>
                )}
                {!hasChildren && <span style={{ width: '24px' }}></span>}

                <i className={`fas ${nodo.icono || 'fa-folder'}`}
                   style={{ color: nodo.color || '#667eea', marginRight: '8px' }}></i>

                <span style={{ flex: 1, fontWeight: '500' }}>{nodo.nombre}</span>

                {nodo.descripcion && (
                  <span style={{
                    fontSize: '0.875rem',
                    color: '#718096',
                    marginRight: '10px'
                  }}>
                    {nodo.descripcion}
                  </span>
                )}

                <button
                  onClick={() => handleEditar(nodo)}
                  disabled={isUpdating}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#4299e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginRight: '5px'
                  }}
                >
                  <i className="fas fa-edit"></i>
                </button>

                <button
                  onClick={() => handleEliminar(nodo)}
                  disabled={isDeleting}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#f56565',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>

              {hasChildren && isExpanded && renderArbol(nodo.children, nivel + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  if (isLoading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#f7fafc',
        borderRadius: '8px'
      }}>
        <div className="spinner" style={{ margin: '0 auto 15px' }}></div>
        <p style={{ color: '#718096' }}>Cargando categorías...</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '20px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fas fa-tags" style={{ fontSize: '24px', color: '#667eea' }}></i>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#2d3748' }}>
              Categorías de Materiales
            </h3>
            <p style={{ margin: '5px 0 0', fontSize: '0.875rem', color: '#718096' }}>
              Sistema jerárquico de categorías con relaciones many-to-many
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{
            backgroundColor: '#667eea',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}>
            {categorias.length} categorías
          </span>

          <button
            onClick={handleCrear}
            disabled={isCreating}
            style={{
              padding: '8px 16px',
              backgroundColor: '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fas fa-plus"></i>
            {isCreating ? 'Creando...' : 'Nueva Categoría'}
          </button>
        </div>
      </div>

      {/* Vista Toggle */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        backgroundColor: '#f7fafc',
        padding: '5px',
        borderRadius: '6px',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setVista('tabla')}
          style={{
            padding: '8px 16px',
            backgroundColor: vista === 'tabla' ? '#667eea' : 'transparent',
            color: vista === 'tabla' ? 'white' : '#4a5568',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          <i className="fas fa-table"></i> Tabla
        </button>
        <button
          onClick={() => setVista('arbol')}
          style={{
            padding: '8px 16px',
            backgroundColor: vista === 'arbol' ? '#667eea' : 'transparent',
            color: vista === 'arbol' ? 'white' : '#4a5568',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          <i className="fas fa-sitemap"></i> Árbol
        </button>
      </div>

      {/* Contenido */}
      {vista === 'tabla' ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Categoría</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Descripción</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Contexto</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Parent</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#a0aec0'
                  }}>
                    <i className="fas fa-inbox fa-3x" style={{ marginBottom: '15px' }}></i>
                    <p>No hay categorías. Crea la primera categoría.</p>
                  </td>
                </tr>
              ) : (
                categorias.map(cat => (
                  <tr key={cat.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className={`fas ${cat.icono || 'fa-folder'}`}
                           style={{ color: cat.color || '#667eea' }}></i>
                        <strong>{cat.nombre}</strong>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#718096' }}>
                      {cat.descripcion || '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        backgroundColor: '#e6fffa',
                        color: '#234e52',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}>
                        {cat.tipoRecurso || 'general'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#718096' }}>
                      {cat.parentId ?
                        categorias.find(c => c.id === cat.parentId)?.nombre || 'N/A'
                        : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        backgroundColor: cat.activa !== false ? '#c6f6d5' : '#e2e8f0',
                        color: cat.activa !== false ? '#22543d' : '#718096',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {cat.activa !== false ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleEditar(cat)}
                        disabled={isUpdating}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#4299e1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '5px'
                        }}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={() => handleEliminar(cat)}
                        disabled={isDeleting}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f56565',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {arbol.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#f7fafc',
              borderRadius: '8px'
            }}>
              <i className="fas fa-sitemap fa-3x" style={{ color: '#cbd5e0', marginBottom: '15px' }}></i>
              <p style={{ color: '#a0aec0' }}>No hay categorías para mostrar en árbol</p>
            </div>
          ) : (
            renderArbol(arbol)
          )}
        </div>
      )}
    </div>
  );
}
