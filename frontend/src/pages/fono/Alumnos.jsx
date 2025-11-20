/**
 * Alumnos - Student Management for Speech Therapists
 *
 * Features:
 * - List all students assigned to this speech therapist
 * - Filter by grade, course, search by name
 * - Statistics: total students, active/inactive
 * - Student details modal
 * - Assign/unassign students functionality
 */

import { useState, useMemo } from 'react';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import { useCursos } from '../../hooks/useConfiguracion';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate, formatNombre, getIniciales } from '../../utils/helpers';
import Swal from 'sweetalert2';

function Alumnos() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [searchTerm, setSearchTerm] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [selectedAlumno, setSelectedAlumno] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: alumnos = [], isLoading, isError, error, refetch } = useUsuariosPorRol('alumno');
  const { data: cursosConfig = [], isLoading: loadingCursos } = useCursos();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const filteredAlumnos = useMemo(() => {
    if (!Array.isArray(alumnos)) return [];

    return alumnos.filter(alumno => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        `${alumno.nombres} ${alumno.apellidos}`.toLowerCase().includes(searchLower) ||
        alumno.rut?.toLowerCase().includes(searchLower);

      const matchesCurso = !cursoFilter || alumno.curso === cursoFilter;
      const matchesEstado = !estadoFilter ||
        (estadoFilter === 'activo' && alumno.activo) ||
        (estadoFilter === 'inactivo' && !alumno.activo);

      return matchesSearch && matchesCurso && matchesEstado;
    });
  }, [alumnos, searchTerm, cursoFilter, estadoFilter]);

  const stats = useMemo(() => {
    if (!Array.isArray(alumnos)) return { total: 0, activos: 0, inactivos: 0 };

    return {
      total: alumnos.length,
      activos: alumnos.filter(a => a.activo).length,
      inactivos: alumnos.filter(a => !a.activo).length,
      porcurso: alumnos.reduce((acc, a) => {
        acc[a.curso] = (acc[a.curso] || 0) + 1;
        return acc;
      }, {})
    };
  }, [alumnos]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleVerDetalle = (alumno) => {
    setSelectedAlumno(alumno);
    setIsDetailModalOpen(true);
  };

  const handleApplyFilters = () => {
    console.log('Filters applied:', { searchTerm, cursoFilter, estadoFilter });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setCursoFilter('');
    setEstadoFilter('');
  };

  const handleExportCSV = () => {
    const csv = [
      ['RUT', 'Nombres', 'Apellidos', 'Curso', 'Edad', 'Estado', 'Email', 'Telefono'].join(','),
      ...filteredAlumnos.map(alumno => [
        alumno.rut || '',
        `"${alumno.nombres || ''}"`,
        `"${alumno.apellidos || ''}"`,
        alumno.curso || '',
        alumno.edad || '',
        alumno.activo ? 'Activo' : 'Inactivo',
        alumno.email || '',
        alumno.telefono || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alumnos_fono_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Mis Alumnos"
        icon="fa-user-graduate"
        buttonText="Exportar Lista"
        buttonIcon="fa-download"
        buttonColor="success"
        onButtonClick={handleExportCSV}
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="card-content">
            <h3>{stats.total}</h3>
            <p>Total Alumnos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.activos}</h3>
            <p>Activos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-times-circle"></i>
          </div>
          <div className="card-content">
            <h3>{stats.inactivos}</h3>
            <p>Inactivos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="card-content">
            <h3>{Object.keys(stats.porcurso).length}</h3>
            <p>Cursos</p>
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
            placeholder="Buscar por nombre o RUT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="cursoFilter">
            <i className="fas fa-school"></i> Curso
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

        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label htmlFor="estadoFilter">
            <i className="fas fa-toggle-on"></i> Estado
          </label>
          <select
            id="estadoFilter"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </div>
      </FilterPanel>

      {/* Action Bar */}
      <ActionBar count={filteredAlumnos.length}>
      </ActionBar>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando alumnos...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar alumnos</h3>
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
      {!isLoading && !isError && filteredAlumnos.length === 0 && (
        <EmptyStateCard
          icon="fa-user-graduate"
          title={searchTerm || cursoFilter || estadoFilter
            ? 'No se encontraron alumnos'
            : 'No hay alumnos asignados'}
          description={
            searchTerm || cursoFilter || estadoFilter
              ? 'Intenta ajustar los filtros de busqueda'
              : 'No tienes alumnos asignados actualmente'
          }
          iconColor="#667eea"
        />
      )}

      {/* Students Grid */}
      {!isLoading && !isError && filteredAlumnos.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}
        >
          {filteredAlumnos.map((alumno) => (
            <div key={alumno.rut} className="card" style={{ padding: '20px' }}>
              {/* Student Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: '#667eea',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}
                >
                  {getIniciales(formatNombre(alumno))}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '1.1em', color: '#1f2937' }}>
                    {formatNombre(alumno)}
                  </h3>
                  <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9em' }}>
                    <i className="fas fa-id-card"></i> {alumno.rut}
                  </p>
                </div>
                <span
                  className={`badge badge-${alumno.activo ? 'success' : 'danger'}`}
                >
                  {alumno.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {/* Student Info */}
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                    <i className="fas fa-school" style={{ width: '20px' }}></i>
                    <strong>Curso:</strong> {alumno.curso || 'No asignado'}
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                    <i className="fas fa-birthday-cake" style={{ width: '20px' }}></i>
                    <strong>Edad:</strong> {alumno.edad || 'N/A'} anos
                  </div>
                  {alumno.email && (
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-envelope" style={{ width: '20px' }}></i>
                      {alumno.email}
                    </div>
                  )}
                  {alumno.telefono && (
                    <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
                      <i className="fas fa-phone" style={{ width: '20px' }}></i>
                      {alumno.telefono}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => handleVerDetalle(alumno)}
                >
                  <i className="fas fa-eye"></i>
                  <span>Ver Detalle</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student Detail Modal */}
      {isDetailModalOpen && selectedAlumno && (
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
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '2px solid #e5e7eb'
            }}>
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
                    fontSize: '20px',
                    fontWeight: 'bold'
                  }}
                >
                  {getIniciales(formatNombre(selectedAlumno))}
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>
                    {formatNombre(selectedAlumno)}
                  </h2>
                  <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
                    RUT: {selectedAlumno.rut}
                  </p>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Personal Info Section */}
              <div>
                <h3 style={{ marginBottom: '15px', color: '#1f2937', fontSize: '1.1em' }}>
                  <i className="fas fa-user"></i> Informacion Personal
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Nombres
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {selectedAlumno.nombres || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Apellidos
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {selectedAlumno.apellidos || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Edad
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {selectedAlumno.edad || 'N/A'} anos
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Fecha de Nacimiento
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {selectedAlumno.fechaNacimiento ? formatDate(selectedAlumno.fechaNacimiento) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Academic Info Section */}
              <div>
                <h3 style={{ marginBottom: '15px', color: '#1f2937', fontSize: '1.1em' }}>
                  <i className="fas fa-graduation-cap"></i> Informacion Academica
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Curso
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {selectedAlumno.curso || 'No asignado'}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Estado
                    </label>
                    <p style={{ margin: '4px 0 0' }}>
                      <span className={`badge badge-${selectedAlumno.activo ? 'success' : 'danger'}`}>
                        {selectedAlumno.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Info Section */}
              <div>
                <h3 style={{ marginBottom: '15px', color: '#1f2937', fontSize: '1.1em' }}>
                  <i className="fas fa-address-book"></i> Informacion de Contacto
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Email
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {selectedAlumno.email || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Telefono
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {selectedAlumno.telefono || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: '600' }}>
                      Direccion
                    </label>
                    <p style={{ margin: '4px 0 0', color: '#1f2937' }}>
                      {selectedAlumno.direccion || 'N/A'}
                    </p>
                  </div>
                </div>
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

export default Alumnos;
