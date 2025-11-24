/**
 * Users Management Page - Boy Happy
 *
 * Comprehensive production-ready page demonstrating all migrated React components.
 * Implements full CRUD operations with React Query, UI components, and best practices.
 *
 * Features:
 * - Search and filter by name, RUT, email, role, status
 * - Create, edit, delete users
 * - Change user roles
 * - Statistics dashboard
 * - Loading and error states
 * - Optimistic updates
 * - Responsive design
 * - Accessibility
 */

import { useState, useMemo } from 'react';
import {
  useUsuarios,
  useCreateUsuario,
  useUpdateUsuario,
  useDeleteUsuario,
  useCambiarRol
} from '../../hooks/useUsuarios';
import { useCursos } from '../../hooks/useConfiguracion';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { RolBadge, ActivoBadge } from '../../components/ui/Badge';
import { formatRut, formatDate, formatNombre, getIniciales } from '../../utils/helpers';
import Swal from 'sweetalert2';
import apiClient from '../../lib/apiClient';

function Users() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    rut: '',
    nombre: '',
    apellido: '',
    correo: '',
    rol: 'alumno',
    activo: true,
    curso: '',
    especialidad: '',
    descripcion: '',
    foto: '',
  });

  const [fotoFile, setFotoFile] = useState(null);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: usuarios = [], isLoading, isError, error, refetch } = useUsuarios();
  const { data: cursosConfig = [], isLoading: loadingCursos } = useCursos();
  const createMutation = useCreateUsuario();
  const updateMutation = useUpdateUsuario();
  const deleteMutation = useDeleteUsuario();
  const cambiarRolMutation = useCambiarRol();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(usuarios)) return [];

    return usuarios.filter(user => {
      // Search filter (name, RUT, email)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        formatNombre(user).toLowerCase().includes(searchLower) ||
        user.rut?.toLowerCase().includes(searchLower) ||
        user.correo?.toLowerCase().includes(searchLower);

      // Role filter
      const matchesRole = !roleFilter || user.rol === roleFilter;

      // Status filter
      const matchesStatus = !statusFilter ||
        (statusFilter === 'activo' ? user.activo : !user.activo);

      // Course filter (only for alumnos)
      const matchesCurso = !cursoFilter || user.curso === cursoFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesCurso;
    });
  }, [usuarios, searchTerm, roleFilter, statusFilter, cursoFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!Array.isArray(usuarios)) return { total: 0, byRole: {}, active: 0, inactive: 0 };

    const byRole = usuarios.reduce((acc, user) => {
      acc[user.rol] = (acc[user.rol] || 0) + 1;
      return acc;
    }, {});

    const active = usuarios.filter(u => u.activo).length;
    const inactive = usuarios.length - active;

    return {
      total: usuarios.length,
      byRole,
      active,
      inactive
    };
  }, [usuarios]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  // Open modal for creating a new user
  const handleCreateUser = () => {
    setEditingUser(null);
    setFormData({
      rut: '',
      nombre: '',
      apellido: '',
      correo: '',
      rol: 'alumno',
      activo: true,
      curso: '',
      especialidad: '',
      descripcion: '',
      foto: '',
    });
    setFotoFile(null);
    setIsModalOpen(true);
  };

  // Open modal for editing an existing user
  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      rut: user.rut,
      nombre: user.nombre,
      apellido: user.apellido,
      correo: user.correo,
      rol: user.rol,
      activo: user.activo,
      curso: user.curso || '',
      especialidad: user.especialidad || '',
      descripcion: user.descripcion || '',
      foto: user.foto || '',
    });
    setFotoFile(null);
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

  // Handle file input change for photo
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo inválido',
          text: 'Por favor selecciona una imagen válida (JPG, PNG, etc.)'
        });
        return;
      }
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo muy grande',
          text: 'La imagen no debe superar 2MB'
        });
        return;
      }
      setFotoFile(file);
    }
  };

  // Submit form (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let fotoUrl = formData.foto;

      // If there's a new photo file, upload it to S3 first
      if (fotoFile) {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(fotoFile);
        });

        const base64Data = await base64Promise;

        // Upload to S3 via /api/images
        const uploadResult = await apiClient.post('/images', {
          imageName: `usuario_${formData.rut}_${Date.now()}.${fotoFile.name.split('.').pop()}`,
          imageData: base64Data,
          grupo: 'public',
          album: 'profesionales'
        });
        // The S3 URL format is: https://BUCKET_NAME.s3.amazonaws.com/KEY
        const bucketName = 'boyhappy-images-590183704612'; // From outputs.json
        fotoUrl = `https://${bucketName}.s3.amazonaws.com/${uploadResult.key}`;
      }

      const dataToSubmit = {
        ...formData,
        foto: fotoUrl
      };

      if (editingUser) {
        // Update existing user
        await updateMutation.mutateAsync({
          rut: editingUser.rut,
          ...dataToSubmit
        });
      } else {
        // Create new user
        await createMutation.mutateAsync(dataToSubmit);
      }
      setIsModalOpen(false);
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Error submitting form:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo guardar el usuario'
      });
    }
  };

  // Delete user with confirmation
  const handleDeleteUser = async (user) => {
    const result = await Swal.fire({
      title: '¿Eliminar usuario?',
      html: `
        <p>¿Estás seguro de eliminar a <strong>${formatNombre(user)}</strong>?</p>
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
        await deleteMutation.mutateAsync(user.rut);
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  // Change user role with confirmation
  const handleChangeRole = async (user) => {
    const roles = ['admin', 'profesor', 'alumno', 'apoderado', 'fono'];
    const rolesLabels = {
      admin: 'Administrador',
      profesor: 'Profesor',
      alumno: 'Alumno',
      apoderado: 'Apoderado',
      fono: 'Fonoaudiólogo'
    };

    const options = {};
    roles.forEach(rol => {
      options[rol] = rolesLabels[rol];
    });

    const { value: nuevoRol } = await Swal.fire({
      title: 'Cambiar rol de usuario',
      html: `<p>Usuario: <strong>${formatNombre(user)}</strong></p><p>Rol actual: <strong>${rolesLabels[user.rol]}</strong></p>`,
      input: 'select',
      inputOptions: options,
      inputPlaceholder: 'Selecciona un rol',
      showCancelButton: true,
      confirmButtonText: 'Cambiar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes seleccionar un rol';
        }
      }
    });

    if (nuevoRol && nuevoRol !== user.rol) {
      try {
        await cambiarRolMutation.mutateAsync({
          rut: user.rut,
          nuevoRol
        });
      } catch (error) {
        console.error('Error changing role:', error);
      }
    }
  };

  // Toggle user active status
  const handleToggleStatus = async (user) => {
    const action = user.activo ? 'desactivar' : 'activar';

    const result = await Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} usuario?`,
      html: `<p>¿Estás seguro de ${action} a <strong>${formatNombre(user)}</strong>?</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await updateMutation.mutateAsync({
          rut: user.rut,
          activo: !user.activo
        });
      } catch (error) {
        console.error('Error toggling status:', error);
      }
    }
  };

  // Apply filters
  const handleApplyFilters = () => {
    // Filters are automatically applied via useMemo
    // This function can be used for additional processing if needed
    console.log('Filters applied:', { searchTerm, roleFilter, statusFilter });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setRoleFilter('');
    setStatusFilter('');
    setCursoFilter('');
  };

  // Export users to CSV
  const handleExportUsers = () => {
    const csv = [
      ['RUT', 'Nombre', 'Apellido', 'Email', 'Rol', 'Estado'].join(','),
      ...filteredUsers.map(user => [
        user.rut,
        user.nombre,
        user.apellido,
        user.correo,
        user.rol,
        user.activo ? 'Activo' : 'Inactivo'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Gestión de Usuarios"
        icon="fa-users"
        buttonText="Crear Usuario"
        buttonIcon="fa-plus"
        buttonColor="primary"
        onButtonClick={handleCreateUser}
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Usuarios</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-user-check"></i>
          </div>
          <div className="card-content">
            <h3>{stats.active}</h3>
            <p>Usuarios Activos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-user-slash"></i>
          </div>
          <div className="card-content">
            <h3>{stats.inactive}</h3>
            <p>Usuarios Inactivos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-user-graduate"></i>
          </div>
          <div className="card-content">
            <h3>{stats.byRole.alumno || 0}</h3>
            <p>Alumnos</p>
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
            placeholder="Buscar por nombre, RUT o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Role filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="roleFilter">
            <i className="fas fa-user-tag"></i> Rol
          </label>
          <select
            id="roleFilter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="profesor">Profesor</option>
            <option value="alumno">Alumno</option>
            <option value="apoderado">Apoderado</option>
            <option value="fono">Fonoaudiólogo</option>
          </select>
        </div>

        {/* Status filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="statusFilter">
            <i className="fas fa-toggle-on"></i> Estado
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </div>

        {/* Course filter */}
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="cursoFilter">
            <i className="fas fa-chalkboard"></i> Curso
          </label>
          <select
            id="cursoFilter"
            value={cursoFilter}
            onChange={(e) => setCursoFilter(e.target.value)}
            disabled={loadingCursos}
          >
            <option value="">Todos los cursos</option>
            {cursosConfig.map((curso) => (
              <option key={curso.codigo} value={curso.codigo}>
                {curso.nombre}
              </option>
            ))}
          </select>
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={filteredUsers.length}>
        <button
          className="btn btn-success"
          onClick={handleExportUsers}
          disabled={filteredUsers.length === 0}
        >
          <i className="fas fa-download"></i>
          <span>Exportar</span>
        </button>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando usuarios...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar usuarios</h3>
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
      {!isLoading && !isError && filteredUsers.length === 0 && (
        <EmptyStateCard
          icon="fa-users"
          title={searchTerm || roleFilter || statusFilter ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
          description={
            searchTerm || roleFilter || statusFilter
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Comienza agregando tu primer usuario al sistema'
          }
          iconColor="#667eea"
          actionText={!(searchTerm || roleFilter || statusFilter) ? 'Crear Usuario' : ''}
          onAction={!(searchTerm || roleFilter || statusFilter) ? handleCreateUser : null}
        />
      )}

      {/* Users List */}
      {!isLoading && !isError && filteredUsers.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>RUT</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Curso</th>
                  <th>Estado</th>
                  <th>Fecha Registro</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.rut}>
                    {/* User Info */}
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
                          {getIniciales(formatNombre(user))}
                        </div>
                        <div>
                          <strong>{formatNombre(user)}</strong>
                        </div>
                      </div>
                    </td>

                    {/* RUT */}
                    <td>
                      <code>{formatRut(user.rut)}</code>
                    </td>

                    {/* Email */}
                    <td>{user.correo || '-'}</td>

                    {/* Role Badge */}
                    <td>
                      <RolBadge rol={user.rol} />
                    </td>

                    {/* Course */}
                    <td>
                      {user.rol === 'alumno' ? (
                        user.curso ? (
                          <span className="badge badge-info">
                            {cursosConfig.find(c => c.codigo === user.curso)?.nombre || user.curso}
                          </span>
                        ) : (
                          <span style={{ color: '#999', fontStyle: 'italic' }}>Sin curso</span>
                        )
                      ) : (
                        <span style={{ color: '#ccc' }}>-</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td>
                      <ActivoBadge activo={user.activo} />
                    </td>

                    {/* Registration Date */}
                    <td>{formatDate(user.fechaRegistro || user.createdAt)}</td>

                    {/* Actions */}
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          justifyContent: 'center'
                        }}
                      >
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleEditUser(user)}
                          title="Editar usuario"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => handleChangeRole(user)}
                          title="Cambiar rol"
                        >
                          <i className="fas fa-user-tag"></i>
                        </button>
                        <button
                          className={`btn btn-sm ${user.activo ? 'btn-warning' : 'btn-success'}`}
                          onClick={() => handleToggleStatus(user)}
                          title={user.activo ? 'Desactivar' : 'Activar'}
                        >
                          <i className={`fas ${user.activo ? 'fa-user-slash' : 'fa-user-check'}`}></i>
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteUser(user)}
                          title="Eliminar usuario"
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

      {/* Create/Edit User Modal */}
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
              maxWidth: '600px',
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
                <i className={`fas ${editingUser ? 'fa-edit' : 'fa-plus'}`}></i>
                {' '}
                {editingUser ? 'Editar Usuario' : 'Crear Usuario'}
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
                {/* RUT */}
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="rut">
                    RUT <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="rut"
                    type="text"
                    name="rut"
                    value={formData.rut}
                    onChange={handleInputChange}
                    placeholder="12345678-9"
                    required
                    disabled={!!editingUser}
                  />
                </div>

                {/* Nombre */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="nombre">
                    Nombre <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="nombre"
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    placeholder="Juan"
                    required
                  />
                </div>

                {/* Apellido */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="apellido">
                    Apellido <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="apellido"
                    type="text"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleInputChange}
                    placeholder="Pérez"
                    required
                  />
                </div>

                {/* Email */}
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="correo">
                    Email <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="correo"
                    type="email"
                    name="correo"
                    value={formData.correo}
                    onChange={handleInputChange}
                    placeholder="usuario@ejemplo.com"
                    required
                  />
                </div>

                {/* Rol */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="rol">
                    Rol <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="rol"
                    name="rol"
                    value={formData.rol}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="alumno">Alumno</option>
                    <option value="profesor">Profesor</option>
                    <option value="apoderado">Apoderado</option>
                    <option value="fono">Fonoaudiólogo</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {/* Curso (solo para alumnos) */}
                {formData.rol === 'alumno' && (
                  <div className="form-group" style={{ flex: '1 1 50%' }}>
                    <label htmlFor="curso">
                      Curso
                    </label>
                    <select
                      id="curso"
                      name="curso"
                      value={formData.curso}
                      onChange={handleInputChange}
                      disabled={loadingCursos}
                    >
                      <option value="">Seleccionar curso</option>
                      {cursosConfig.map((curso) => (
                        <option key={curso.codigo} value={curso.codigo}>
                          {curso.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Especialidad (solo para profesionales: admin, profesor, fono) */}
                {['admin', 'profesor', 'fono'].includes(formData.rol) && (
                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label htmlFor="especialidad">
                      Especialidad
                    </label>
                    <input
                      id="especialidad"
                      type="text"
                      name="especialidad"
                      value={formData.especialidad}
                      onChange={handleInputChange}
                      placeholder="Ej: Trastornos del Lenguaje, Matemáticas, Ciencias"
                    />
                  </div>
                )}

                {/* Descripción (solo para profesionales: admin, profesor, fono) */}
                {['admin', 'profesor', 'fono'].includes(formData.rol) && (
                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label htmlFor="descripcion">
                      Descripción / Biografía
                    </label>
                    <textarea
                      id="descripcion"
                      name="descripcion"
                      value={formData.descripcion}
                      onChange={handleInputChange}
                      placeholder="Breve descripción del profesional..."
                      rows="3"
                      style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>
                )}

                {/* Foto (solo para profesionales: admin, profesor, fono) */}
                {['admin', 'profesor', 'fono'].includes(formData.rol) && (
                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label htmlFor="foto">
                      Foto de Perfil
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        id="foto"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ padding: '8px' }}
                      />
                      {(fotoFile || formData.foto) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={fotoFile ? URL.createObjectURL(fotoFile) : formData.foto}
                            alt="Preview"
                            style={{
                              width: '80px',
                              height: '80px',
                              objectFit: 'cover',
                              borderRadius: '50%',
                              border: '2px solid #e0e0e0'
                            }}
                          />
                          {fotoFile && (
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              Nueva foto seleccionada
                            </span>
                          )}
                        </div>
                      )}
                      <small style={{ fontSize: '12px', color: '#666' }}>
                        Tamaño máximo: 2MB. Formatos: JPG, PNG, GIF, WEBP
                      </small>
                    </div>
                  </div>
                )}

                {/* Estado */}
                <div className="form-group" style={{ flex: '1 1 50%' }}>
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
                      Usuario activo
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
                    <i className={`fas ${editingUser ? 'fa-save' : 'fa-plus'}`}></i>
                  )}
                  <span>
                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
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

export default Users;
