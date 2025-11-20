/**
 * Sesiones - Therapy Sessions Management
 *
 * Features:
 * - List all therapy sessions
 * - Filter by student, date, session status
 * - Statistics: total sessions, completed, pending
 * - Create new session record
 * - Edit session details (notes, objectives, activities)
 * - Upload session files/evidence
 * - Session history timeline
 */

import { useState, useMemo } from 'react';
import {
  useSesiones,
  useCreateSesion,
  useUpdateSesion,
  useDeleteSesion,
  useSubirArchivoSesion
} from '../../hooks/useSesiones';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import useAuthStore from '../../stores/authStore';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre, getIniciales } from '../../utils/helpers';
import Swal from 'sweetalert2';

const ESTADOS_SESION = [
  { value: 'programada', label: 'Programada', color: '#667eea' },
  { value: 'en-curso', label: 'En Curso', color: '#ed8936' },
  { value: 'completada', label: 'Completada', color: '#48bb78' },
  { value: 'cancelada', label: 'Cancelada', color: '#e53e3e' }
];

const TIPOS_SESION = [
  { value: 'individual', label: 'Individual', icon: 'fa-user' },
  { value: 'grupal', label: 'Grupal', icon: 'fa-users' }
];

const AREAS_TRABAJO = [
  { value: 'articulacion', label: 'Articulacion' },
  { value: 'lenguaje-expresivo', label: 'Lenguaje Expresivo' },
  { value: 'lenguaje-comprensivo', label: 'Lenguaje Comprensivo' },
  { value: 'voz', label: 'Voz' },
  { value: 'fluidez', label: 'Fluidez' },
  { value: 'deglution', label: 'Deglution' },
  { value: 'respiracion', label: 'Respiracion' }
];

function Sesiones() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [searchTerm, setSearchTerm] = useState('');
  const [alumnoFilter, setAlumnoFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSesion, setEditingSesion] = useState(null);
  const [selectedSesion, setSelectedSesion] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [formData, setFormData] = useState({
    alumno_id: '',
    fecha: new Date().toISOString().split('T')[0],
    hora_inicio: '09:00',
    duracion: 45,
    tipo: 'individual',
    area: 'articulacion',
    objetivos: '',
    actividades: '',
    materiales_utilizados: '',
    observaciones: '',
    logros: '',
    dificultades: '',
    tareas_casa: '',
    estado: 'programada',
  });

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { user } = useAuthStore();

  const sesionesFilters = useMemo(() => {
    const filters = {};

    if (alumnoFilter) filters.alumno_id = alumnoFilter;
    if (estadoFilter) filters.estado = estadoFilter;
    if (dateFrom) filters.fechaDesde = dateFrom;
    if (dateTo) filters.fechaHasta = dateTo;

    return filters;
  }, [alumnoFilter, estadoFilter, dateFrom, dateTo]);

  const { data: sesiones = [], isLoading, isError, error, refetch } = useSesiones(sesionesFilters);
  const { data: alumnos = [] } = useUsuariosPorRol('alumno');

  const createMutation = useCreateSesion();
  const updateMutation = useUpdateSesion();
  const deleteMutation = useDeleteSesion();
  const subirArchivoMutation = useSubirArchivoSesion();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const filteredSesiones = useMemo(() => {
    if (!Array.isArray(sesiones)) return [];

    return sesiones.filter(sesion => {
      const searchLower = searchTerm.toLowerCase();
      const alumno = alumnos.find(a => a.rut === sesion.alumno_id) || {};
      const nombreCompleto = formatNombre(alumno).toLowerCase();

      const matchesSearch = !searchTerm ||
        nombreCompleto.includes(searchLower) ||
        sesion.objetivos?.toLowerCase().includes(searchLower) ||
        sesion.actividades?.toLowerCase().includes(searchLower);

      return matchesSearch;
    });
  }, [sesiones, searchTerm, alumnos]);

  const stats = useMemo(() => {
    if (!Array.isArray(sesiones)) return { total: 0, completadas: 0, programadas: 0, enCurso: 0 };

    return {
      total: sesiones.length,
      completadas: sesiones.filter(s => s.estado === 'completada').length,
      programadas: sesiones.filter(s => s.estado === 'programada').length,
      enCurso: sesiones.filter(s => s.estado === 'en-curso').length,
      canceladas: sesiones.filter(s => s.estado === 'cancelada').length
    };
  }, [sesiones]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleCreateSesion = () => {
    setEditingSesion(null);
    setSelectedFile(null);
    setFormData({
      alumno_id: '',
      fecha: new Date().toISOString().split('T')[0],
      hora_inicio: '09:00',
      duracion: 45,
      tipo: 'individual',
      area: 'articulacion',
      objetivos: '',
      actividades: '',
      materiales_utilizados: '',
      observaciones: '',
      logros: '',
      dificultades: '',
      tareas_casa: '',
      estado: 'programada',
    });
    setIsModalOpen(true);
  };

  const handleEditSesion = (sesion) => {
    setEditingSesion(sesion);
    setSelectedFile(null);
    setFormData({
      alumno_id: sesion.alumno_id || '',
      fecha: sesion.fecha || new Date().toISOString().split('T')[0],
      hora_inicio: sesion.hora_inicio || '09:00',
      duracion: sesion.duracion || 45,
      tipo: sesion.tipo || 'individual',
      area: sesion.area || 'articulacion',
      objetivos: sesion.objetivos || '',
      actividades: sesion.actividades || '',
      materiales_utilizados: sesion.materiales_utilizados || '',
      observaciones: sesion.observaciones || '',
      logros: sesion.logros || '',
      dificultades: sesion.dificultades || '',
      tareas_casa: sesion.tareas_casa || '',
      estado: sesion.estado || 'programada',
    });
    setIsModalOpen(true);
  };

  const handleVerDetalle = (sesion) => {
    setSelectedSesion(sesion);
    setIsDetailModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.alumno_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Debes seleccionar un alumno'
      });
      return;
    }

    try {
      const data = {
        ...formData,
        fonoaudiologo: user?.rut || 'sistema',
        archivo: selectedFile
      };

      if (editingSesion) {
        await updateMutation.mutateAsync({
          id: editingSesion.id,
          ...data
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting session:', error);
    }
  };

  const handleDeleteSesion = async (sesion) => {
    const result = await Swal.fire({
      title: 'Eliminar sesion?',
      html: `<p>Estas seguro de eliminar esta sesion?</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await deleteMutation.mutateAsync(sesion.id);
        setIsDetailModalOpen(false);
      } catch (error) {
        console.error('Error deleting session:', error);
      }
    }
  };

  const handleCambiarEstado = async (sesion, nuevoEstado) => {
    try {
      await updateMutation.mutateAsync({
        id: sesion.id,
        estado: nuevoEstado
      });
    } catch (error) {
      console.error('Error updating session status:', error);
    }
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { alumnoFilter, estadoFilter, dateFrom, dateTo });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setAlumnoFilter('');
    setEstadoFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Fecha', 'Alumno', 'RUT', 'Tipo', 'Area', 'Duracion', 'Estado', 'Objetivos'].join(','),
      ...filteredSesiones.map(sesion => {
        const alumno = alumnos.find(a => a.rut === sesion.alumno_id) || {};
        return [
          sesion.fecha,
          `"${formatNombre(alumno)}"`,
          sesion.alumno_id,
          sesion.tipo,
          sesion.area,
          `${sesion.duracion} min`,
          sesion.estado,
          `"${(sesion.objetivos || '').replace(/,/g, ';')}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sesiones_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Sesiones Terapeuticas"
        icon="fa-clipboard-list"
        buttonText="Nueva Sesion"
        buttonIcon="fa-plus"
        buttonColor="primary"
        onButtonClick={handleCreateSesion}
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clipboard-list"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Sesiones</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.completadas}</h3>
            <p>Completadas</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="card-content">
            <h3>{stats.programadas}</h3>
            <p>Programadas</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-play-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.enCurso}</h3>
            <p>En Curso</p>
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
            placeholder="Buscar por alumno, objetivos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ flex: '1 1 250px' }}>
          <label htmlFor="alumnoFilter">
            <i className="fas fa-user"></i> Alumno
          </label>
          <select
            id="alumnoFilter"
            value={alumnoFilter}
            onChange={(e) => setAlumnoFilter(e.target.value)}
          >
            <option value="">Todos los alumnos</option>
            {alumnos.map(alumno => (
              <option key={alumno.rut} value={alumno.rut}>
                {formatNombre(alumno)}
              </option>
            ))}
          </select>
        </div>

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
            {ESTADOS_SESION.map(estado => (
              <option key={estado.value} value={estado.value}>{estado.label}</option>
            ))}
          </select>
        </div>

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
      <ActionBar count={filteredSesiones.length}>
        <button
          className="btn btn-success"
          onClick={handleExportCSV}
          disabled={filteredSesiones.length === 0}
        >
          <i className="fas fa-download"></i>
          <span>Exportar CSV</span>
        </button>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando sesiones...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar sesiones</h3>
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
      {!isLoading && !isError && filteredSesiones.length === 0 && (
        <EmptyStateCard
          icon="fa-clipboard-list"
          title="No hay sesiones registradas"
          description="Comienza registrando tu primera sesion terapeutica"
          iconColor="#667eea"
          actionText="Nueva Sesion"
          onAction={handleCreateSesion}
        />
      )}

      {/* Sessions Timeline */}
      {!isLoading && !isError && filteredSesiones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {filteredSesiones.map((sesion) => {
            const alumno = alumnos.find(a => a.rut === sesion.alumno_id) || {};
            const estadoInfo = ESTADOS_SESION.find(e => e.value === sesion.estado);
            const tipoInfo = TIPOS_SESION.find(t => t.value === sesion.tipo);
            const areaInfo = AREAS_TRABAJO.find(a => a.value === sesion.area);

            return (
              <div key={sesion.id} className="card" style={{ padding: '20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        backgroundColor: '#667eea',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 'bold'
                      }}
                    >
                      {getIniciales(formatNombre(alumno))}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1em', color: '#1f2937' }}>
                        {formatNombre(alumno)}
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.9em', color: '#6b7280' }}>
                        <i className="fas fa-calendar"></i> {formatDate(sesion.fecha)}
                        {' - '}
                        <i className="fas fa-clock"></i> {sesion.hora_inicio}
                        {' '}
                        ({sesion.duracion} min)
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: estadoInfo?.color || '#6b7280',
                        color: 'white'
                      }}
                    >
                      {estadoInfo?.label || sesion.estado}
                    </span>
                    <span className="badge badge-secondary">
                      <i className={`fas ${tipoInfo?.icon || 'fa-user'}`}></i>
                      {' '}
                      {tipoInfo?.label || sesion.tipo}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                    {sesion.area && (
                      <div>
                        <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                          Area de Trabajo
                        </label>
                        <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                          <i className="fas fa-brain"></i> {areaInfo?.label || sesion.area}
                        </p>
                      </div>
                    )}

                    {sesion.objetivos && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                          Objetivos
                        </label>
                        <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                          {sesion.objetivos}
                        </p>
                      </div>
                    )}

                    {sesion.actividades && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                          Actividades Realizadas
                        </label>
                        <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                          {sesion.actividades}
                        </p>
                      </div>
                    )}

                    {sesion.logros && (
                      <div>
                        <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                          <i className="fas fa-star" style={{ color: '#48bb78' }}></i> Logros
                        </label>
                        <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                          {sesion.logros}
                        </p>
                      </div>
                    )}

                    {sesion.dificultades && (
                      <div>
                        <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                          <i className="fas fa-exclamation-circle" style={{ color: '#ed8936' }}></i> Dificultades
                        </label>
                        <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                          {sesion.dificultades}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleVerDetalle(sesion)}
                  >
                    <i className="fas fa-eye"></i>
                    <span>Ver Completo</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEditSesion(sesion)}
                  >
                    <i className="fas fa-edit"></i>
                    <span>Editar</span>
                  </button>

                  {sesion.estado === 'programada' && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleCambiarEstado(sesion, 'completada')}
                    >
                      <i className="fas fa-check"></i>
                      <span>Marcar Completada</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Session Modal */}
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
              maxWidth: '800px',
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
                <i className={`fas ${editingSesion ? 'fa-edit' : 'fa-plus'}`}></i>
                {' '}
                {editingSesion ? 'Editar Sesion' : 'Nueva Sesion'}
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
                  <label htmlFor="alumno_id">
                    Alumno <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="alumno_id"
                    name="alumno_id"
                    value={formData.alumno_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Seleccionar alumno</option>
                    {alumnos.map(alumno => (
                      <option key={alumno.rut} value={alumno.rut}>
                        {formatNombre(alumno)} - {alumno.rut}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 33%' }}>
                  <label htmlFor="fecha">
                    Fecha <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="fecha"
                    type="date"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 33%' }}>
                  <label htmlFor="hora_inicio">
                    Hora Inicio <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="hora_inicio"
                    type="time"
                    name="hora_inicio"
                    value={formData.hora_inicio}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 33%' }}>
                  <label htmlFor="duracion">
                    Duracion (min) <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    id="duracion"
                    type="number"
                    name="duracion"
                    value={formData.duracion}
                    onChange={handleInputChange}
                    min="15"
                    step="15"
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="tipo">
                    Tipo de Sesion <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="tipo"
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleInputChange}
                    required
                  >
                    {TIPOS_SESION.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="area">
                    Area de Trabajo <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <select
                    id="area"
                    name="area"
                    value={formData.area}
                    onChange={handleInputChange}
                    required
                  >
                    {AREAS_TRABAJO.map(area => (
                      <option key={area.value} value={area.value}>{area.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="objetivos">
                    Objetivos de la Sesion
                  </label>
                  <textarea
                    id="objetivos"
                    name="objetivos"
                    value={formData.objetivos}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Define los objetivos a trabajar en esta sesion..."
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="actividades">
                    Actividades Realizadas
                  </label>
                  <textarea
                    id="actividades"
                    name="actividades"
                    value={formData.actividades}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Describe las actividades realizadas durante la sesion..."
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="logros">
                    Logros
                  </label>
                  <textarea
                    id="logros"
                    name="logros"
                    value={formData.logros}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="Logros alcanzados..."
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="dificultades">
                    Dificultades
                  </label>
                  <textarea
                    id="dificultades"
                    name="dificultades"
                    value={formData.dificultades}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="Dificultades encontradas..."
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="materiales_utilizados">
                    Materiales Utilizados
                  </label>
                  <input
                    id="materiales_utilizados"
                    type="text"
                    name="materiales_utilizados"
                    value={formData.materiales_utilizados}
                    onChange={handleInputChange}
                    placeholder="Ej: Tarjetas de articulacion, espejo"
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="tareas_casa">
                    Tareas para Casa
                  </label>
                  <textarea
                    id="tareas_casa"
                    name="tareas_casa"
                    value={formData.tareas_casa}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="Actividades o ejercicios para realizar en casa..."
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label htmlFor="observaciones">
                    Observaciones Generales
                  </label>
                  <textarea
                    id="observaciones"
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Observaciones adicionales sobre la sesion..."
                  />
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="estado">
                    Estado
                  </label>
                  <select
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                  >
                    {ESTADOS_SESION.map(estado => (
                      <option key={estado.value} value={estado.value}>{estado.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 50%' }}>
                  <label htmlFor="archivo">
                    Adjuntar Archivo (opcional)
                  </label>
                  <input
                    id="archivo"
                    type="file"
                    name="archivo"
                    onChange={handleFileChange}
                  />
                  {selectedFile && (
                    <p style={{ marginTop: '8px', fontSize: '0.9em', color: '#666' }}>
                      <i className="fas fa-file"></i> {selectedFile.name}
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
                    <i className="fas fa-save"></i>
                  )}
                  <span>Guardar Sesion</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {isDetailModalOpen && selectedSesion && (
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
          onClick={() => setIsDetailModalOpen(false)}
        >
          <div
            className="modal-content card"
            style={{
              maxWidth: '800px',
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
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <h2 style={{ margin: 0 }}>
                <i className="fas fa-clipboard-list"></i> Detalle de Sesion
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Complete session details here - similar structure to Evaluaciones detail modal */}
              <p style={{ color: '#4b5563' }}>
                Ver detalles completos de la sesion de {formatNombre(alumnos.find(a => a.rut === selectedSesion.alumno_id) || {})}
              </p>
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
                className="btn btn-danger"
                onClick={() => handleDeleteSesion(selectedSesion)}
              >
                <i className="fas fa-trash"></i>
                <span>Eliminar</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleEditSesion(selectedSesion);
                }}
              >
                <i className="fas fa-edit"></i>
                <span>Editar</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
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

export default Sesiones;
