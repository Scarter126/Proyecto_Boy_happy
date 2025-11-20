/**
 * Configuracion Page - Boy Happy
 *
 * Complete production-ready configuration management page.
 * Manages system-wide settings including courses, subjects, and general parameters.
 *
 * Features:
 * - Course management (add/remove courses with code and name)
 * - Subject management (add/remove subjects)
 * - General system settings
 * - Form validation
 * - Loading states
 * - Success/error notifications
 * - Delete confirmations with SweetAlert2
 * - Responsive design
 */

import { useState, useEffect } from 'react';
import {
  useCursos,
  useAsignaturas,
  useUpdateConfiguracion,
  useEvaluaciones
} from '../../hooks/useConfiguracion';
import { SectionHeader } from '../../components/ui';
import { ConfigListManager, CategoriasManager } from '../../components/business';
import Swal from 'sweetalert2';

function Configuracion() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  // Form state for courses
  const [cursoForm, setCursoForm] = useState({
    codigo: '',
    nombre: ''
  });

  // Form state for subjects
  const [asignaturaForm, setAsignaturaForm] = useState('');

  // Edit state for courses
  const [editingCurso, setEditingCurso] = useState(null); // Stores the codigo being edited
  const [editCursoNombre, setEditCursoNombre] = useState('');

  // Edit state for subjects
  const [editingAsignatura, setEditingAsignatura] = useState(null); // Stores the asignatura being edited
  const [editAsignaturaNombre, setEditAsignaturaNombre] = useState('');

  // Configuration data state
  const [configData, setConfigData] = useState({
    cursos: [],
    cursosNombres: [],
    asignaturas: []
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: cursosNombres = [], isLoading: cursosLoading, refetch: refetchCursos } = useCursos();
  const { data: asignaturas = [], isLoading: asignaturasLoading, refetch: refetchAsignaturas } = useAsignaturas();
  const updateMutation = useUpdateConfiguracion();

  // ==========================================
  // EFFECTS
  // ==========================================

  // Update local state when data is fetched
  useEffect(() => {
    setConfigData(prev => ({
      ...prev,
      cursosNombres,
      cursos: cursosNombres.map(c => c.codigo)
    }));
  }, [cursosNombres]);

  useEffect(() => {
    setConfigData(prev => ({
      ...prev,
      asignaturas
    }));
  }, [asignaturas]);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const isLoading = cursosLoading || asignaturasLoading;
  const isSaving = updateMutation.isPending;

  // ==========================================
  // EVENT HANDLERS - CURSOS
  // ==========================================

  const handleCursoInputChange = (e) => {
    const { name, value } = e.target;
    setCursoForm(prev => ({
      ...prev,
      [name]: value.trim()
    }));
  };

  const handleAddCurso = async (e) => {
    e.preventDefault();

    if (!cursoForm.codigo || !cursoForm.nombre) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos incompletos',
        text: 'Debes completar el código y nombre del curso'
      });
      return;
    }

    // Validate curso code format (e.g., "1A", "2B")
    if (!/^[0-9][A-Z]$/.test(cursoForm.codigo)) {
      Swal.fire({
        icon: 'warning',
        title: 'Código inválido',
        text: 'El código debe tener el formato: número + letra (ej: 1A, 2B)'
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        key: 'cursos',
        action: 'add',
        curso: {
          codigo: cursoForm.codigo,
          nombre: cursoForm.nombre
        }
      });

      // Clear form
      setCursoForm({ codigo: '', nombre: '' });

      // Refetch data
      refetchCursos();

      Swal.fire({
        icon: 'success',
        title: 'Curso agregado',
        text: `El curso ${cursoForm.codigo} - ${cursoForm.nombre} ha sido agregado correctamente`,
        timer: 2000
      });
    } catch (error) {
      console.error('Error adding curso:', error);
    }
  };

  const handleEditCurso = (codigo, nombreActual) => {
    setEditingCurso(codigo);
    setEditCursoNombre(nombreActual);
  };

  const handleCancelEditCurso = () => {
    setEditingCurso(null);
    setEditCursoNombre('');
  };

  const handleSaveEditCurso = async (codigo) => {
    if (!editCursoNombre || editCursoNombre.trim() === '') {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre requerido',
        text: 'El nombre del curso no puede estar vacío'
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        key: 'cursos',
        action: 'update',
        codigo: codigo,
        nuevoNombre: editCursoNombre.trim()
      });

      // Clear edit state
      setEditingCurso(null);
      setEditCursoNombre('');

      // Refetch data
      refetchCursos();

      Swal.fire({
        icon: 'success',
        title: 'Curso actualizado',
        text: `El nombre del curso ha sido actualizado correctamente`,
        timer: 2000
      });
    } catch (error) {
      console.error('Error updating curso:', error);
    }
  };

  const handleRemoveCurso = async (codigo, nombre) => {
    const result = await Swal.fire({
      title: '¿Eliminar curso?',
      html: `
        <p>¿Estás seguro de eliminar el curso <strong>${codigo} - ${nombre}</strong>?</p>
        <p class="text-muted">Esta acción puede ser bloqueada si existen datos asociados.</p>
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
        await updateMutation.mutateAsync({
          key: 'cursos',
          action: 'remove',
          codigo: codigo
        });

        // Refetch data
        refetchCursos();
      } catch (error) {
        // Error handling is done in the mutation hook
        console.error('Error removing curso:', error);
      }
    }
  };

  // ==========================================
  // EVENT HANDLERS - ASIGNATURAS
  // ==========================================

  const handleAsignaturaInputChange = (e) => {
    setAsignaturaForm(e.target.value.trim());
  };

  const handleAddAsignatura = async (e) => {
    e.preventDefault();

    if (!asignaturaForm) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos incompletos',
        text: 'Debes ingresar el nombre de la asignatura'
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        key: 'asignaturas',
        action: 'add',
        asignatura: asignaturaForm
      });

      // Clear form
      setAsignaturaForm('');

      // Refetch data
      refetchAsignaturas();

      Swal.fire({
        icon: 'success',
        title: 'Asignatura agregada',
        text: `La asignatura "${asignaturaForm}" ha sido agregada correctamente`,
        timer: 2000
      });
    } catch (error) {
      console.error('Error adding asignatura:', error);
    }
  };

  const handleEditAsignatura = (asignatura) => {
    setEditingAsignatura(asignatura);
    setEditAsignaturaNombre(asignatura);
  };

  const handleCancelEditAsignatura = () => {
    setEditingAsignatura(null);
    setEditAsignaturaNombre('');
  };

  const handleSaveEditAsignatura = async (asignaturaActual) => {
    if (!editAsignaturaNombre || editAsignaturaNombre.trim() === '') {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre requerido',
        text: 'El nombre de la asignatura no puede estar vacío'
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        key: 'asignaturas',
        action: 'update',
        asignatura: asignaturaActual,
        nuevoNombre: editAsignaturaNombre.trim()
      });

      // Clear edit state
      setEditingAsignatura(null);
      setEditAsignaturaNombre('');

      // Refetch data
      refetchAsignaturas();

      Swal.fire({
        icon: 'success',
        title: 'Asignatura actualizada',
        text: 'El nombre de la asignatura ha sido actualizado correctamente',
        timer: 2000
      });
    } catch (error) {
      console.error('Error updating asignatura:', error);
    }
  };

  const handleRemoveAsignatura = async (asignatura) => {
    const result = await Swal.fire({
      title: '¿Eliminar asignatura?',
      html: `<p>¿Estás seguro de eliminar la asignatura <strong>${asignatura}</strong>?</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await updateMutation.mutateAsync({
          key: 'asignaturas',
          action: 'remove',
          asignatura: asignatura
        });

        // Refetch data
        refetchAsignaturas();
      } catch (error) {
        console.error('Error removing asignatura:', error);
      }
    }
  };

  // ==========================================
  // EVENT HANDLERS - GENERAL
  // ==========================================

  const handleRefresh = () => {
    refetchCursos();
    refetchAsignaturas();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Configuración del Sistema"
        icon="fa-cog"
      />

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando configuración...</h3>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Cursos Section */}
          <div className="card">
            <div style={{ borderBottom: '2px solid #667eea', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-school" style={{ color: '#667eea' }}></i>
                Gestión de Cursos
              </h2>
              <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
                Administra los cursos disponibles en el sistema
              </p>
            </div>

            {/* Add Curso Form */}
            <form onSubmit={handleAddCurso} style={{ marginBottom: '30px' }}>
              <div className="form-row">
                <div className="form-group" style={{ flex: '1 1 150px' }}>
                  <label htmlFor="cursoCodigo">
                    <i className="fas fa-hashtag"></i> Código
                  </label>
                  <input
                    id="cursoCodigo"
                    type="text"
                    name="codigo"
                    value={cursoForm.codigo}
                    onChange={handleCursoInputChange}
                    placeholder="1A"
                    maxLength={2}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                    Formato: número + letra (ej: 1A, 2B)
                  </small>
                </div>

                <div className="form-group" style={{ flex: '1 1 300px' }}>
                  <label htmlFor="cursoNombre">
                    <i className="fas fa-tag"></i> Nombre
                  </label>
                  <input
                    id="cursoNombre"
                    type="text"
                    name="nombre"
                    value={cursoForm.nombre}
                    onChange={handleCursoInputChange}
                    placeholder="Primero Básico A"
                  />
                </div>

                <div className="form-group" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving || !cursoForm.codigo || !cursoForm.nombre}
                  >
                    {isSaving ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fas fa-plus"></i>
                    )}
                    <span>Agregar Curso</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Cursos List */}
            <div>
              <h3 style={{ marginBottom: '15px', color: '#555', fontSize: '16px' }}>
                <i className="fas fa-list"></i> Cursos Registrados ({configData.cursosNombres.length})
              </h3>

              {configData.cursosNombres.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  backgroundColor: '#f7fafc',
                  borderRadius: '8px',
                  border: '2px dashed #cbd5e0'
                }}>
                  <i className="fas fa-school fa-3x" style={{ color: '#cbd5e0', marginBottom: '15px' }}></i>
                  <p style={{ color: '#718096', margin: 0 }}>No hay cursos registrados</p>
                  <p style={{ color: '#a0aec0', fontSize: '14px', margin: '5px 0 0 0' }}>
                    Agrega el primer curso usando el formulario de arriba
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: '15px'
                }}>
                  {configData.cursosNombres.map((curso) => (
                    <div
                      key={curso.codigo}
                      style={{
                        padding: '15px',
                        backgroundColor: editingCurso === curso.codigo ? '#edf2f7' : '#f7fafc',
                        borderRadius: '8px',
                        border: editingCurso === curso.codigo ? '2px solid #667eea' : '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (editingCurso !== curso.codigo) {
                          e.currentTarget.style.borderColor = '#667eea';
                          e.currentTarget.style.backgroundColor = '#edf2f7';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (editingCurso !== curso.codigo) {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.backgroundColor = '#f7fafc';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', color: '#667eea', fontSize: '16px', marginBottom: '4px' }}>
                            {curso.codigo}
                          </div>
                          {editingCurso === curso.codigo ? (
                            <input
                              type="text"
                              value={editCursoNombre}
                              onChange={(e) => setEditCursoNombre(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '14px',
                                border: '1px solid #cbd5e0',
                                borderRadius: '4px',
                                outline: 'none'
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#667eea'}
                              onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
                              autoFocus
                            />
                          ) : (
                            <div style={{ color: '#4a5568', fontSize: '14px' }}>
                              {curso.nombre}
                            </div>
                          )}
                        </div>
                        {editingCurso !== curso.codigo && (
                          <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                            <button
                              className="btn btn-sm btn-info"
                              onClick={() => handleEditCurso(curso.codigo, curso.nombre)}
                              disabled={isSaving || editingCurso !== null}
                              title="Editar curso"
                              style={{ padding: '4px 8px' }}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveCurso(curso.codigo, curso.nombre)}
                              disabled={isSaving || editingCurso !== null}
                              title="Eliminar curso"
                              style={{ padding: '4px 8px' }}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        )}
                      </div>
                      {editingCurso === curso.codigo && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={handleCancelEditCurso}
                            disabled={isSaving}
                            style={{ padding: '4px 12px' }}
                          >
                            <i className="fas fa-times"></i>
                            <span style={{ marginLeft: '4px' }}>Cancelar</span>
                          </button>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleSaveEditCurso(curso.codigo)}
                            disabled={isSaving || !editCursoNombre.trim()}
                            style={{ padding: '4px 12px' }}
                          >
                            {isSaving ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                              <i className="fas fa-check"></i>
                            )}
                            <span style={{ marginLeft: '4px' }}>Guardar</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Asignaturas Section */}
          <div className="card">
            <div style={{ borderBottom: '2px solid #48bb78', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-book" style={{ color: '#48bb78' }}></i>
                Gestión de Asignaturas
              </h2>
              <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
                Administra las asignaturas disponibles en el sistema
              </p>
            </div>

            {/* Add Asignatura Form */}
            <form onSubmit={handleAddAsignatura} style={{ marginBottom: '30px' }}>
              <div className="form-row">
                <div className="form-group" style={{ flex: '1 1 400px' }}>
                  <label htmlFor="asignatura">
                    <i className="fas fa-tag"></i> Nombre de la Asignatura
                  </label>
                  <input
                    id="asignatura"
                    type="text"
                    value={asignaturaForm}
                    onChange={handleAsignaturaInputChange}
                    placeholder="Matemáticas"
                  />
                </div>

                <div className="form-group" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={isSaving || !asignaturaForm}
                  >
                    {isSaving ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fas fa-plus"></i>
                    )}
                    <span>Agregar Asignatura</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Asignaturas List */}
            <div>
              <h3 style={{ marginBottom: '15px', color: '#555', fontSize: '16px' }}>
                <i className="fas fa-list"></i> Asignaturas Registradas ({configData.asignaturas.length})
              </h3>

              {configData.asignaturas.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  backgroundColor: '#f0fff4',
                  borderRadius: '8px',
                  border: '2px dashed #9ae6b4'
                }}>
                  <i className="fas fa-book fa-3x" style={{ color: '#9ae6b4', marginBottom: '15px' }}></i>
                  <p style={{ color: '#2f855a', margin: 0 }}>No hay asignaturas registradas</p>
                  <p style={{ color: '#48bb78', fontSize: '14px', margin: '5px 0 0 0' }}>
                    Agrega la primera asignatura usando el formulario de arriba
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '12px'
                }}>
                  {configData.asignaturas.map((asignatura, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '15px',
                        backgroundColor: editingAsignatura === asignatura ? '#edf7ed' : '#f0fff4',
                        borderRadius: '8px',
                        border: editingAsignatura === asignatura ? '2px solid #48bb78' : '1px solid #c6f6d5',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (editingAsignatura !== asignatura) {
                          e.currentTarget.style.borderColor = '#48bb78';
                          e.currentTarget.style.backgroundColor = '#e6fffa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (editingAsignatura !== asignatura) {
                          e.currentTarget.style.borderColor = '#c6f6d5';
                          e.currentTarget.style.backgroundColor = '#f0fff4';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          {editingAsignatura === asignatura ? (
                            <input
                              type="text"
                              value={editAsignaturaNombre}
                              onChange={(e) => setEditAsignaturaNombre(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '14px',
                                border: '1px solid #cbd5e0',
                                borderRadius: '4px',
                                outline: 'none'
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#48bb78'}
                              onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
                              autoFocus
                            />
                          ) : (
                            <div style={{ color: '#2f855a', fontWeight: '500', fontSize: '14px' }}>
                              {asignatura}
                            </div>
                          )}
                        </div>
                        {editingAsignatura !== asignatura && (
                          <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                            <button
                              className="btn btn-sm btn-info"
                              onClick={() => handleEditAsignatura(asignatura)}
                              disabled={isSaving || editingAsignatura !== null}
                              title="Editar asignatura"
                              style={{ padding: '4px 8px' }}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveAsignatura(asignatura)}
                              disabled={isSaving || editingAsignatura !== null}
                              title="Eliminar asignatura"
                              style={{ padding: '4px 8px' }}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        )}
                      </div>
                      {editingAsignatura === asignatura && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={handleCancelEditAsignatura}
                            disabled={isSaving}
                            style={{ padding: '4px 12px' }}
                          >
                            <i className="fas fa-times"></i>
                            <span style={{ marginLeft: '4px' }}>Cancelar</span>
                          </button>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleSaveEditAsignatura(asignatura)}
                            disabled={isSaving || !editAsignaturaNombre.trim()}
                            style={{ padding: '4px 12px' }}
                          >
                            {isSaving ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                              <i className="fas fa-check"></i>
                            )}
                            <span style={{ marginLeft: '4px' }}>Guardar</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* System Info Card */}
          <div className="card">
            <div style={{ borderBottom: '2px solid #9f7aea', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-info-circle" style={{ color: '#9f7aea' }}></i>
                Información del Sistema
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div style={{ padding: '15px', backgroundColor: '#faf5ff', borderRadius: '8px', border: '1px solid #e9d8fd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <i className="fas fa-school" style={{ color: '#9f7aea', fontSize: '20px' }}></i>
                  <strong style={{ color: '#553c9a' }}>Total de Cursos</strong>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#9f7aea' }}>
                  {configData.cursosNombres.length}
                </div>
              </div>

              <div style={{ padding: '15px', backgroundColor: '#f0fff4', borderRadius: '8px', border: '1px solid #c6f6d5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <i className="fas fa-book" style={{ color: '#48bb78', fontSize: '20px' }}></i>
                  <strong style={{ color: '#2f855a' }}>Total de Asignaturas</strong>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#48bb78' }}>
                  {configData.asignaturas.length}
                </div>
              </div>

              <div style={{ padding: '15px', backgroundColor: '#ebf8ff', borderRadius: '8px', border: '1px solid #bee3f8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <i className="fas fa-calendar" style={{ color: '#4299e1', fontSize: '20px' }}></i>
                  <strong style={{ color: '#2c5282' }}>Año Escolar</strong>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4299e1' }}>
                  {new Date().getFullYear()}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* GESTIÓN DE CATEGORÍAS DE MATERIALES */}
          {/* ========================================== */}

          <CategoriasManager />

          {/* ========================================== */}
          {/* CONFIGURACIONES DE LISTAS (1 - Evaluaciones) */}
          {/* Tipos de archivo y niveles de dificultad ahora son hardcoded */}
          {/* ========================================== */}

          {/* 1. Evaluaciones (Académico + Fonoaudiológico UNIFICADO) */}
          <ConfigListManager
            configKey="evaluaciones"
            title="Evaluaciones"
            icon="fa-clipboard-check"
            color="#805ad5"
            useHook={useEvaluaciones}
            description="Tipos y áreas de evaluación unificados (usa 'contexto' y 'tipo' para filtrar)"
            formFields={[
              { name: 'value', label: 'Código', type: 'text', required: true, help: 'ej: prueba, inicial, articulacion-eval' },
              { name: 'label', label: 'Nombre', type: 'text', required: true, placeholder: 'Prueba / Evaluación Inicial' },
              {
                name: 'contexto',
                label: 'Contexto',
                type: 'select',
                required: true,
                options: [
                  { value: 'academico', label: 'Académico' },
                  { value: 'fono', label: 'Fonoaudiológico' }
                ],
                help: 'Define si es académico o fonoaudiológico'
              },
              {
                name: 'tipo',
                label: 'Tipo',
                type: 'select',
                required: true,
                options: [
                  { value: 'tipo', label: 'Tipo de Evaluación' },
                  { value: 'area', label: 'Área de Evaluación' }
                ],
                help: 'Para fono: distingue entre tipo de evaluación (inicial, seguimiento) o área (articulación, voz)'
              },
              { name: 'icon', label: 'Ícono FontAwesome', type: 'text', placeholder: 'fa-file-alt', help: 'Opcional, solo para académicos' },
              { name: 'color', label: 'Color (hex)', type: 'text', placeholder: '#667eea', help: 'Opcional, solo para tipos fono' }
            ]}
          />
        </div>
      )}
    </div>
  );
}

export default Configuracion;
