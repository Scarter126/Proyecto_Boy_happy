/**
 * Matriculas Management Page - Boy Happy
 *
 * Comprehensive production-ready page for managing enrollments (matrículas).
 * Implements full CRUD operations with React Query, UI components, and best practices.
 *
 * Features:
 * - Search and filter by student name, RUT, estado, curso, año
 * - Create, edit, approve, reject enrollments
 * - Convert approved enrollments to users
 * - Statistics dashboard
 * - Quick actions for pending enrollments
 * - Loading and error states
 * - Optimistic updates
 * - Responsive design
 * - Accessibility
 * - Export to CSV
 */

import { useState, useMemo } from 'react';
import {
  useMatriculas,
  useCreateMatricula,
  useUpdateEstadoMatricula,
  useConvertirMatriculaAUsuario,
  useDeleteMatricula
} from '../../hooks/useMatriculas';
import { useCursos } from '../../hooks/useConfiguracion';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { EstadoBadge } from '../../components/ui/Badge';
import { formatRut, formatDate, formatNombre, getIniciales } from '../../utils/helpers';
import Swal from 'sweetalert2';

function Matriculas() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');
  const [añoFilter, setAñoFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMatricula, setEditingMatricula] = useState(null);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertingMatricula, setConvertingMatricula] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    nombreAlumno: '',
    rutAlumno: '',
    nombreApoderado: '',
    correoApoderado: '',
    telefonoApoderado: '',
    curso: '',
    añoEscolar: new Date().getFullYear().toString(),
    estado: 'pendiente',
    observaciones: ''
  });

  // Convert form state
  const [convertCurso, setConvertCurso] = useState('');

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: matriculasResponse, isLoading, isError, error, refetch } = useMatriculas();
  const matriculas = matriculasResponse?.matriculas || [];
  const { data: cursosConfig = [], isLoading: loadingCursos } = useCursos();
  const createMutation = useCreateMatricula();
  const updateMutation = useUpdateEstadoMatricula();
  const convertMutation = useConvertirMatriculaAUsuario();
  const deleteMutation = useDeleteMatricula();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Filter matriculas based on search and filters
  const filteredMatriculas = useMemo(() => {
    if (!Array.isArray(matriculas)) return [];

    return matriculas.filter(matricula => {
      // Search filter (student name, RUT, apoderado name)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        matricula.nombreAlumno?.toLowerCase().includes(searchLower) ||
        matricula.rutAlumno?.toLowerCase().includes(searchLower) ||
        matricula.nombreApoderado?.toLowerCase().includes(searchLower);

      // Estado filter
      const matchesEstado = !estadoFilter || matricula.estado === estadoFilter;

      // Curso filter
      const matchesCurso = !cursoFilter || matricula.curso === cursoFilter;

      // Año filter
      const matchesAño = !añoFilter || matricula.añoEscolar === añoFilter;

      return matchesSearch && matchesEstado && matchesCurso && matchesAño;
    });
  }, [matriculas, searchTerm, estadoFilter, cursoFilter, añoFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!Array.isArray(matriculas)) return {
      total: 0,
      pendientes: 0,
      aprobadas: 0,
      rechazadas: 0
    };

    return {
      total: matriculas.length,
      pendientes: matriculas.filter(m => m.estado === 'pendiente').length,
      aprobadas: matriculas.filter(m => m.estado === 'aprobada' || m.estado === 'aprobado').length,
      rechazadas: matriculas.filter(m => m.estado === 'rechazada' || m.estado === 'rechazado').length
    };
  }, [matriculas]);

  // Get unique cursos and años for filters
  const cursos = useMemo(() => {
    const cursosSet = new Set(matriculas.map(m => m.curso).filter(Boolean));
    return Array.from(cursosSet).sort();
  }, [matriculas]);

  const años = useMemo(() => {
    const añosSet = new Set(matriculas.map(m => m.añoEscolar).filter(Boolean));
    return Array.from(añosSet).sort().reverse();
  }, [matriculas]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  // Open modal for creating a new matricula
  const handleCreateMatricula = () => {
    setEditingMatricula(null);
    setFormData({
      nombreAlumno: '',
      rutAlumno: '',
      nombreApoderado: '',
      correoApoderado: '',
      telefonoApoderado: '',
      curso: '',
      añoEscolar: new Date().getFullYear().toString(),
      estado: 'pendiente',
      observaciones: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing an existing matricula
  const handleEditMatricula = (matricula) => {
    setEditingMatricula(matricula);
    setFormData({
      nombreAlumno: matricula.nombreAlumno || '',
      rutAlumno: matricula.rutAlumno || '',
      nombreApoderado: matricula.nombreApoderado || '',
      correoApoderado: matricula.correoApoderado || '',
      telefonoApoderado: matricula.telefonoApoderado || '',
      curso: matricula.curso || '',
      añoEscolar: matricula.añoEscolar || new Date().getFullYear().toString(),
      estado: matricula.estado || 'pendiente',
      observaciones: matricula.observaciones || ''
    });
    setIsModalOpen(true);
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

    try {
      if (editingMatricula) {
        // Update existing matricula
        await updateMutation.mutateAsync({
          id: editingMatricula.id,
          ...formData
        });
      } else {
        // Create new matricula
        await createMutation.mutateAsync(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  // Approve matricula (quick action)
  const handleAprobar = async (matricula) => {
    const result = await Swal.fire({
      title: '¿Aprobar matrícula?',
      html: `
        <p>¿Deseas aprobar la matrícula de <strong>${matricula.nombreAlumno}</strong>?</p>
        <p class="text-muted">Curso: ${matricula.curso}</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#48bb78',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await updateMutation.mutateAsync({
          id: matricula.id,
          estado: 'aprobada'
        });
      } catch (error) {
        console.error('Error approving matricula:', error);
      }
    }
  };

  // Reject matricula (quick action)
  const handleRechazar = async (matricula) => {
    const { value: motivo } = await Swal.fire({
      title: '¿Rechazar matrícula?',
      html: `
        <p>¿Deseas rechazar la matrícula de <strong>${matricula.nombreAlumno}</strong>?</p>
        <p class="text-muted">Curso: ${matricula.curso}</p>
      `,
      input: 'textarea',
      inputLabel: 'Motivo del rechazo (opcional)',
      inputPlaceholder: 'Ingresa el motivo del rechazo...',
      showCancelButton: true,
      confirmButtonColor: '#e53e3e',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, rechazar',
      cancelButtonText: 'Cancelar'
    });

    if (motivo !== undefined) {
      try {
        await updateMutation.mutateAsync({
          id: matricula.id,
          estado: 'rechazada',
          observaciones: motivo || undefined
        });
      } catch (error) {
        console.error('Error rejecting matricula:', error);
      }
    }
  };

  // Convert matricula to user
  const handleConvertir = (matricula) => {
    setConvertingMatricula(matricula);
    setConvertCurso(matricula.curso || '');
    setIsConvertModalOpen(true);
  };

  // Submit convert to user
  const handleConvertSubmit = async (e) => {
    e.preventDefault();

    if (!convertCurso) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Debes seleccionar un curso'
      });
      return;
    }

    try {
      await convertMutation.mutateAsync({
        id: convertingMatricula.id,
        curso: convertCurso
      });
      setIsConvertModalOpen(false);
      setConvertingMatricula(null);
      setConvertCurso('');
    } catch (error) {
      console.error('Error converting matricula:', error);
    }
  };

  // Delete matricula with confirmation
  const handleDeleteMatricula = async (matricula) => {
    // Mensaje especial si la matrícula ya fue convertida a usuario
    const esMatriculaActiva = matricula.estado === 'activa' || matricula.usuarioCreado === true;

    const mensaje = esMatriculaActiva
      ? `
          <p><strong>⚠️ ADVERTENCIA:</strong> Esta matrícula ya fue convertida a usuario activo.</p>
          <p>No se puede eliminar porque el usuario y sus relaciones permanecerán en el sistema.</p>
          <p>Si necesitas desactivar al usuario, hazlo desde la sección "Gestión de Usuarios".</p>
        `
      : `
          <p>¿Estás seguro de eliminar la solicitud de matrícula de <strong>${matricula.nombreAlumno}</strong>?</p>
          <p class="text-muted">Esta acción no se puede deshacer.</p>
        `;

    const result = await Swal.fire({
      title: esMatriculaActiva ? 'No se puede eliminar' : '¿Eliminar solicitud?',
      html: mensaje,
      icon: esMatriculaActiva ? 'error' : 'warning',
      showCancelButton: !esMatriculaActiva,
      confirmButtonColor: esMatriculaActiva ? '#6c757d' : '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: esMatriculaActiva ? 'Entendido' : 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    // Solo intentar eliminar si NO es matrícula activa y usuario confirmó
    if (!esMatriculaActiva && result.isConfirmed) {
      try {
        await deleteMutation.mutateAsync(matricula.id);
      } catch (error) {
        console.error('Error deleting matricula:', error);
        // Si el backend rechaza la eliminación, mostrar el mensaje del error
        if (error.response?.data?.error) {
          Swal.fire({
            title: 'Error al eliminar',
            text: error.response.data.error,
            icon: 'error'
          });
        }
      }
    }
  };

  // Apply filters
  const handleApplyFilters = () => {
    console.log('Filters applied:', { searchTerm, estadoFilter, cursoFilter, añoFilter });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setEstadoFilter('');
    setCursoFilter('');
    setAñoFilter('');
  };

  // Export matriculas to CSV
  const handleExportMatriculas = () => {
    const csv = [
      ['Alumno', 'RUT', 'Apoderado', 'Email', 'Teléfono', 'Curso', 'Año', 'Estado', 'Fecha', 'Observaciones'].join(','),
      ...filteredMatriculas.map(m => [
        m.nombreAlumno || '',
        m.rutAlumno || '',
        m.nombreApoderado || '',
        m.correoApoderado || '',
        m.telefonoApoderado || '',
        m.curso || '',
        m.añoEscolar || '',
        m.estado || '',
        m.fecha || m.timestamp?.split('T')[0] || '',
        m.observaciones || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `matriculas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Gestión de Matrículas"
        icon="fa-graduation-cap"
        buttonText="Nueva Matrícula"
        buttonIcon="fa-plus"
        buttonColor="primary"
        onButtonClick={handleCreateMatricula}
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Matrículas</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="card-content">
            <h3>{stats.pendientes}</h3>
            <p>Pendientes</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.aprobadas}</h3>
            <p>Aprobadas</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-times-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.rechazadas}</h3>
            <p>Rechazadas</p>
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
            placeholder="Buscar por nombre del alumno o RUT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Estado filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="estadoFilter">
            <i className="fas fa-filter"></i> Estado
          </label>
          <select
            id="estadoFilter"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </div>

        {/* Curso filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="cursoFilter">
            <i className="fas fa-book"></i> Curso
          </label>
          <select
            id="cursoFilter"
            value={cursoFilter}
            onChange={(e) => setCursoFilter(e.target.value)}
          >
            <option value="">Todos los cursos</option>
            {cursos.map(curso => (
              <option key={curso} value={curso}>{curso}</option>
            ))}
          </select>
        </div>

        {/* Año filter */}
        <div className="form-group" style={{ flex: '1 1 150px' }}>
          <label htmlFor="añoFilter">
            <i className="fas fa-calendar"></i> Año
          </label>
          <select
            id="añoFilter"
            value={añoFilter}
            onChange={(e) => setAñoFilter(e.target.value)}
          >
            <option value="">Todos los años</option>
            {años.map(año => (
              <option key={año} value={año}>{año}</option>
            ))}
          </select>
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={filteredMatriculas.length}>
        <button
          className="btn btn-success"
          onClick={handleExportMatriculas}
          disabled={filteredMatriculas.length === 0}
        >
          <i className="fas fa-download"></i>
          <span>Exportar</span>
        </button>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando matrículas...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar matrículas</h3>
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
      {!isLoading && !isError && filteredMatriculas.length === 0 && (
        <EmptyStateCard
          icon="fa-graduation-cap"
          title={searchTerm || estadoFilter || cursoFilter || añoFilter ? 'No se encontraron matrículas' : 'No hay matrículas registradas'}
          description={
            searchTerm || estadoFilter || cursoFilter || añoFilter
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Comienza agregando tu primera matrícula al sistema'
          }
          iconColor="#667eea"
          actionText={!(searchTerm || estadoFilter || cursoFilter || añoFilter) ? 'Nueva Matrícula' : ''}
          onAction={!(searchTerm || estadoFilter || cursoFilter || añoFilter) ? handleCreateMatricula : null}
        />
      )}

      {/* Matriculas List */}
      {!isLoading && !isError && filteredMatriculas.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>RUT</th>
                  <th>Apoderado</th>
                  <th>Contacto</th>
                  <th>Curso</th>
                  <th>Año</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatriculas.map((matricula) => (
                  <tr key={matricula.id}>
                    {/* Alumno */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          className="user-avatar"
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: '#667eea',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px'
                          }}
                        >
                          {getIniciales(matricula.nombreAlumno)}
                        </div>
                        <div>
                          <strong>{matricula.nombreAlumno}</strong>
                        </div>
                      </div>
                    </td>

                    {/* RUT */}
                    <td>
                      <code>{formatRut(matricula.rutAlumno)}</code>
                    </td>

                    {/* Apoderado */}
                    <td>{matricula.nombreApoderado || '-'}</td>

                    {/* Contacto */}
                    <td>
                      <div style={{ fontSize: '0.9em' }}>
                        {matricula.correoApoderado && (
                          <div>
                            <i className="fas fa-envelope" style={{ marginRight: '5px', color: '#667eea' }}></i>
                            {matricula.correoApoderado}
                          </div>
                        )}
                        {matricula.telefonoApoderado && (
                          <div style={{ marginTop: '4px' }}>
                            <i className="fas fa-phone" style={{ marginRight: '5px', color: '#48bb78' }}></i>
                            {matricula.telefonoApoderado}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Curso */}
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#f0f4ff',
                        borderRadius: '4px',
                        fontSize: '0.9em'
                      }}>
                        {matricula.curso || '-'}
                      </span>
                    </td>

                    {/* Año */}
                    <td>{matricula.añoEscolar || '-'}</td>

                    {/* Estado Badge */}
                    <td>
                      <EstadoBadge estado={matricula.estado} />
                    </td>

                    {/* Fecha */}
                    <td>{formatDate(matricula.fecha || matricula.timestamp)}</td>

                    {/* Actions */}
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          justifyContent: 'center',
                          flexWrap: 'wrap'
                        }}
                      >
                        {/* Quick approve/reject for pending */}
                        {matricula.estado === 'pendiente' && (
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleAprobar(matricula)}
                              title="Aprobar matrícula"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRechazar(matricula)}
                              title="Rechazar matrícula"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </>
                        )}

                        {/* Convert to user (for approved) */}
                        {(matricula.estado === 'aprobada' || matricula.estado === 'aprobado') && (
                          <button
                            className="btn btn-sm btn-info"
                            onClick={() => handleConvertir(matricula)}
                            title="Convertir a usuario"
                          >
                            <i className="fas fa-user-plus"></i>
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleEditMatricula(matricula)}
                          title="Editar matrícula"
                        >
                          <i className="fas fa-edit"></i>
                        </button>

                        {/* Delete */}
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteMatricula(matricula)}
                          title="Eliminar matrícula"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Matricula Modal */}
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
                <i className={`fas ${editingMatricula ? 'fa-edit' : 'fa-plus'}`}></i>
                {' '}
                {editingMatricula ? 'Editar Matrícula' : 'Nueva Matrícula'}
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
                {/* Datos del Alumno */}
                <h3 style={{ flex: '1 1 100%', fontSize: '1.1em', marginBottom: '10px', color: '#667eea' }}>
                  <i className="fas fa-user-graduate"></i> Datos del Alumno
                </h3>

                {/* Nombre Alumno */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="nombreAlumno">
                    Nombre del Alumno <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="nombreAlumno"
                    type="text"
                    name="nombreAlumno"
                    value={formData.nombreAlumno}
                    onChange={handleInputChange}
                    placeholder="Juan Pérez"
                    required
                  />
                </div>

                {/* RUT Alumno */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="rutAlumno">
                    RUT <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="rutAlumno"
                    type="text"
                    name="rutAlumno"
                    value={formData.rutAlumno}
                    onChange={handleInputChange}
                    placeholder="12345678-9"
                    required
                  />
                </div>

                {/* Datos del Apoderado */}
                <h3 style={{ flex: '1 1 100%', fontSize: '1.1em', marginTop: '15px', marginBottom: '10px', color: '#667eea' }}>
                  <i className="fas fa-user"></i> Datos del Apoderado
                </h3>

                {/* Nombre Apoderado */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="nombreApoderado">
                    Nombre del Apoderado
                  </label>
                  <input
                    id="nombreApoderado"
                    type="text"
                    name="nombreApoderado"
                    value={formData.nombreApoderado}
                    onChange={handleInputChange}
                    placeholder="María González"
                  />
                </div>

                {/* Email Apoderado */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="correoApoderado">
                    Email <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="correoApoderado"
                    type="email"
                    name="correoApoderado"
                    value={formData.correoApoderado}
                    onChange={handleInputChange}
                    placeholder="apoderado@ejemplo.com"
                    required
                  />
                </div>

                {/* Teléfono Apoderado */}
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="telefonoApoderado">
                    Teléfono
                  </label>
                  <input
                    id="telefonoApoderado"
                    type="tel"
                    name="telefonoApoderado"
                    value={formData.telefonoApoderado}
                    onChange={handleInputChange}
                    placeholder="+56 9 1234 5678"
                  />
                </div>

                {/* Datos de la Matrícula */}
                <h3 style={{ flex: '1 1 100%', fontSize: '1.1em', marginTop: '15px', marginBottom: '10px', color: '#667eea' }}>
                  <i className="fas fa-graduation-cap"></i> Datos de la Matrícula
                </h3>

                {/* Curso */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="curso">
                    Curso <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="curso"
                    name="curso"
                    value={formData.curso}
                    onChange={handleInputChange}
                    required
                    disabled={loadingCursos}
                  >
                    <option value="">{loadingCursos ? 'Cargando cursos...' : 'Seleccionar curso...'}</option>
                    {cursosConfig.map((curso) => (
                      <option key={curso.codigo} value={curso.nombre}>
                        {curso.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Año Escolar */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="añoEscolar">
                    Año Escolar <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="añoEscolar"
                    type="number"
                    name="añoEscolar"
                    value={formData.añoEscolar}
                    onChange={handleInputChange}
                    placeholder="2024"
                    min="2020"
                    max="2030"
                    required
                  />
                </div>

                {/* Estado */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="estado">
                    Estado <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobada">Aprobada</option>
                    <option value="rechazada">Rechazada</option>
                  </select>
                </div>

                {/* Observaciones */}
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="observaciones">
                    Observaciones
                  </label>
                  <textarea
                    id="observaciones"
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleInputChange}
                    placeholder="Notas adicionales..."
                    rows="3"
                    style={{ resize: 'vertical' }}
                  />
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
                    <i className={`fas ${editingMatricula ? 'fa-save' : 'fa-plus'}`}></i>
                  )}
                  <span>
                    {editingMatricula ? 'Guardar Cambios' : 'Crear Matrícula'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert to User Modal */}
      {isConvertModalOpen && convertingMatricula && (
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
          onClick={() => setIsConvertModalOpen(false)}
        >
          <div
            className="modal-content card"
            style={{
              maxWidth: '500px',
              width: '90%'
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
                <i className="fas fa-user-plus"></i> Convertir a Usuario
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setIsConvertModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Info */}
            <div style={{
              backgroundColor: '#f0f4ff',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>Alumno:</strong> {convertingMatricula.nombreAlumno}
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>RUT:</strong> {formatRut(convertingMatricula.rutAlumno)}
              </p>
              <p style={{ margin: '0' }}>
                <strong>Apoderado:</strong> {convertingMatricula.nombreApoderado}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleConvertSubmit}>
              <div className="form-group">
                <label htmlFor="convertCurso">
                  Curso a asignar <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <select
                  id="convertCurso"
                  value={convertCurso}
                  onChange={(e) => setConvertCurso(e.target.value)}
                  required
                  disabled={loadingCursos}
                >
                  <option value="">{loadingCursos ? 'Cargando cursos...' : 'Seleccionar curso...'}</option>
                  {cursosConfig.map((curso) => (
                    <option key={curso.codigo} value={curso.nombre}>
                      {curso.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Form Actions */}
              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: '20px'
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsConvertModalOpen(false)}
                  disabled={convertMutation.isPending}
                >
                  <i className="fas fa-times"></i>
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={convertMutation.isPending}
                >
                  {convertMutation.isPending && (
                    <i className="fas fa-spinner fa-spin"></i>
                  )}
                  {!convertMutation.isPending && (
                    <i className="fas fa-user-plus"></i>
                  )}
                  <span>Crear Usuario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Matriculas;
