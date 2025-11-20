/**
 * Mis Hijos Page - Boy Happy (Apoderado)
 *
 * READ ONLY page for parents to view their children's information
 *
 * Features:
 * - View list of children with detailed information
 * - Display basic statistics for each child
 * - Responsive card layout
 * - Loading and error states
 */

import { useState } from 'react';
import { useHijos } from '../../hooks/useHijos';
import { SectionHeader, EmptyStateCard, StatCardGrid } from '../../components/ui';
import { formatRut, formatDate, formatNombre, calcularEdad } from '../../utils/helpers';

function MisHijos() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [selectedHijo, setSelectedHijo] = useState(null);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: hijos = [], isLoading, isError, error, refetch } = useHijos();

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="page-content">
      {/* Page Header */}
      <SectionHeader
        title="Mis Hijos"
        icon="fa-child"
      />

      {/* Statistics Cards */}
      <StatCardGrid>
        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-child"></i>
          </div>
          <div className="card-content">
            <h3>{hijos.length}</h3>
            <p>Total Hijos</p>
          </div>
        </div>

        <div className="indicator-card">
          <div className="card-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="card-content">
            <h3>{hijos.filter(h => h.activo).length}</h3>
            <p>Activos</p>
          </div>
        </div>
      </StatCardGrid>

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Cargando información...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar información</h3>
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
      {!isLoading && !isError && hijos.length === 0 && (
        <EmptyStateCard
          icon="fa-child"
          title="No hay hijos registrados"
          description="No se encontraron hijos asociados a su cuenta"
          iconColor="#667eea"
        />
      )}

      {/* Children List */}
      {!isLoading && !isError && hijos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {hijos.map((hijo) => (
            <div key={hijo.rut} className="card" style={{ position: 'relative' }}>
              {/* Header with Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
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
                    fontWeight: 'bold',
                    fontSize: '20px'
                  }}
                >
                  <i className="fas fa-child"></i>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '1.3em' }}>{formatNombre(hijo)}</h3>
                  <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9em' }}>
                    <code>{formatRut(hijo.rut)}</code>
                  </p>
                </div>
                {hijo.activo && (
                  <span className="badge badge-success">
                    <i className="fas fa-check-circle"></i> Activo
                  </span>
                )}
              </div>

              {/* Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Curso */}
                {hijo.curso && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fas fa-school" style={{ color: '#667eea', width: '20px' }}></i>
                    <span style={{ color: '#666' }}>Curso:</span>
                    <strong>{hijo.curso}</strong>
                  </div>
                )}

                {/* Email */}
                {hijo.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fas fa-envelope" style={{ color: '#667eea', width: '20px' }}></i>
                    <span style={{ color: '#666' }}>Email:</span>
                    <strong style={{ fontSize: '0.9em' }}>{hijo.email}</strong>
                  </div>
                )}

                {/* Fecha de Nacimiento */}
                {hijo.fechaNacimiento && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fas fa-birthday-cake" style={{ color: '#667eea', width: '20px' }}></i>
                    <span style={{ color: '#666' }}>F. Nacimiento:</span>
                    <strong>{formatDate(hijo.fechaNacimiento)}</strong>
                    {calcularEdad(hijo.fechaNacimiento) && (
                      <span style={{ color: '#666' }}>({calcularEdad(hijo.fechaNacimiento)} años)</span>
                    )}
                  </div>
                )}

                {/* Fecha de Registro */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fas fa-calendar-plus" style={{ color: '#667eea', width: '20px' }}></i>
                  <span style={{ color: '#666' }}>Registrado:</span>
                  <strong>{formatDate(hijo.fechaRegistro || hijo.createdAt)}</strong>
                </div>
              </div>

              {/* View Details Button */}
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => setSelectedHijo(hijo)}
                >
                  <i className="fas fa-info-circle"></i>
                  <span>Ver Detalles</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {selectedHijo && (
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
          onClick={() => setSelectedHijo(null)}
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
                <i className="fas fa-child"></i>
                {' '}
                Detalles de {formatNombre(selectedHijo)}
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedHijo(null)}
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                  Nombre Completo
                </label>
                <strong style={{ fontSize: '1.1em' }}>{formatNombre(selectedHijo)}</strong>
              </div>

              <div>
                <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                  RUT
                </label>
                <code style={{ fontSize: '1.1em' }}>{formatRut(selectedHijo.rut)}</code>
              </div>

              {selectedHijo.curso && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Curso
                  </label>
                  <strong>{selectedHijo.curso}</strong>
                </div>
              )}

              {selectedHijo.email && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Email
                  </label>
                  <strong>{selectedHijo.email}</strong>
                </div>
              )}

              {selectedHijo.fechaNacimiento && (
                <div>
                  <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                    Fecha de Nacimiento
                  </label>
                  <strong>
                    {formatDate(selectedHijo.fechaNacimiento, 'long')}
                    {calcularEdad(selectedHijo.fechaNacimiento) && (
                      <span style={{ color: '#666', marginLeft: '10px' }}>
                        ({calcularEdad(selectedHijo.fechaNacimiento)} años)
                      </span>
                    )}
                  </strong>
                </div>
              )}

              <div>
                <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                  Estado
                </label>
                {selectedHijo.activo ? (
                  <span className="badge badge-success">
                    <i className="fas fa-check-circle"></i> Activo
                  </span>
                ) : (
                  <span className="badge badge-danger">
                    <i className="fas fa-times-circle"></i> Inactivo
                  </span>
                )}
              </div>

              <div>
                <label style={{ color: '#666', fontSize: '0.9em', marginBottom: '5px', display: 'block' }}>
                  Fecha de Registro
                </label>
                <strong>{formatDate(selectedHijo.fechaRegistro || selectedHijo.createdAt, 'long')}</strong>
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
                onClick={() => setSelectedHijo(null)}
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

export default MisHijos;
