/**
 * FonoDashboard - Dashboard para fonoaudiólogos
 * Alineado con estilos de ApoderadoDashboard
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { useUsuariosPorRol } from '../../hooks/useUsuarios';
import { useSesiones } from '../../hooks/useSesiones';
import { useEvaluaciones } from '../../hooks/useEvaluaciones';

function FonoDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Fetch data
  const { data: alumnos = [], isLoading: loadingAlumnos } = useUsuariosPorRol('alumno');
  const { data: sesiones = [], isLoading: loadingSesiones } = useSesiones();
  const { data: evaluaciones = [], isLoading: loadingEvaluaciones } = useEvaluaciones();

  // Calculate statistics
  const stats = useMemo(() => {
    // Total pacientes (alumnos activos)
    const totalPacientes = alumnos.filter(a => a.activo).length;

    // Sesiones de hoy
    const today = new Date().toISOString().split('T')[0];
    const sesionesHoy = sesiones.filter(s => {
      const sesionFecha = s.fecha || s.fechaHora?.split('T')[0];
      return sesionFecha === today;
    }).length;

    // Evaluaciones pendientes (tipo 'inicial' o sin completar)
    const evaluacionesPendientes = evaluaciones.filter(e =>
      e.tipo === 'inicial' || e.estado === 'pendiente' || !e.puntuacion
    ).length;

    // Sesiones completadas este mes
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const sesionesCompletadas = sesiones.filter(s => {
      if (s.estado !== 'completada') return false;
      const sesionDate = new Date(s.fecha || s.fechaHora);
      return sesionDate.getMonth() === currentMonth && sesionDate.getFullYear() === currentYear;
    }).length;

    return {
      totalPacientes,
      sesionesHoy,
      evaluacionesPendientes,
      sesionesCompletadas
    };
  }, [alumnos, sesiones, evaluaciones]);

  const isLoading = loadingAlumnos || loadingSesiones || loadingEvaluaciones;

  // Get recent sessions for activity section
  const sesionesRecientes = useMemo(() => {
    return sesiones
      .sort((a, b) => new Date(b.fecha || b.fechaHora) - new Date(a.fecha || a.fechaHora))
      .slice(0, 5);
  }, [sesiones]);

  return (
    <div className="section active">
      <div className="content-header">
        <h1><i className="fas fa-stethoscope"></i> Bienvenido, {user?.name || 'Fonoaudiólogo'}</h1>
        <p>Panel de control para fonoaudiólogos</p>
      </div>

      {/* Loading State */}
      {isLoading && !alumnos.length && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#667eea' }}>
          <i className="fas fa-spinner fa-spin fa-3x"></i>
          <p style={{ marginTop: '15px', fontSize: '1.1em' }}>Cargando dashboard...</p>
        </div>
      )}

      {/* Dashboard Content */}
      <div>
        {/* Indicadores Principales */}
        <div className="dashboard-grid">
          {/* Mis Pacientes */}
          <div className="indicator-card">
            <div className="indicator-header">
              <i className="fas fa-user-injured fa-2x"></i>
              <h3>Mis Pacientes</h3>
            </div>
            <div className="indicator-value">
              {isLoading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                stats.totalPacientes
              )}
            </div>
          </div>

          {/* Sesiones Hoy */}
          <div className="indicator-card">
            <div className="indicator-header">
              <i className="fas fa-calendar-day fa-2x"></i>
              <h3>Sesiones Hoy</h3>
            </div>
            <div className="indicator-value">
              {isLoading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                stats.sesionesHoy
              )}
            </div>
          </div>

          {/* Evaluaciones Pendientes */}
          <div className="indicator-card">
            <div className="indicator-header">
              <i className="fas fa-chart-line fa-2x"></i>
              <h3>Evaluaciones Pendientes</h3>
            </div>
            <div className="indicator-value">
              {isLoading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                stats.evaluacionesPendientes
              )}
            </div>
          </div>

          {/* Sesiones Completadas Este Mes */}
          <div className="indicator-card">
            <div className="indicator-header">
              <i className="fas fa-check-circle fa-2x"></i>
              <h3>Sesiones Completadas Este Mes</h3>
            </div>
            <div className="indicator-value">
              {isLoading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                stats.sesionesCompletadas
              )}
            </div>
            <button
              className="btn-secondary"
              style={{ marginTop: '10px', width: '100%' }}
              onClick={() => navigate('/fono/reportes')}
            >
              <i className="fas fa-file-alt"></i> Ver Reportes
            </button>
          </div>
        </div>

        {/* Actividad Reciente */}
        {sesionesRecientes.length > 0 && (
          <div className="card" style={{ marginTop: '25px' }}>
            <h3><i className="fas fa-history"></i> Actividad Reciente</h3>
            <div style={{ marginTop: '15px' }}>
              {sesionesRecientes.map((sesion, index) => (
                <div
                  key={sesion.id || index}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    borderRadius: '8px',
                    background: sesion.estado === 'completada' ? '#4caf5015' : '#2196f315',
                    borderLeft: `4px solid ${sesion.estado === 'completada' ? '#4caf50' : '#2196f3'}`,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate('/fono/sesiones')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <i className="fas fa-clipboard-list" style={{ color: sesion.estado === 'completada' ? '#4caf50' : '#2196f3', fontSize: '1.5em' }}></i>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: sesion.estado === 'completada' ? '#4caf50' : '#2196f3' }}>
                        Sesión {sesion.tipo || 'terapéutica'}
                      </strong>
                      <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                        <i className="fas fa-calendar"></i> {sesion.fecha} - {sesion.area || 'Sin área especificada'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.75em',
                      background: sesion.estado === 'completada' ? '#4caf50' : sesion.estado === 'en-curso' ? '#2196f3' : '#999',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}>
                      {sesion.estado === 'completada' ? 'Completada' : sesion.estado === 'en-curso' ? 'En Curso' : 'Programada'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card" style={{ marginTop: '25px' }}>
          <h3><i className="fas fa-bolt"></i> Acciones Rápidas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
            <button
              className="btn-primary"
              style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              onClick={() => navigate('/fono/sesiones')}
            >
              <i className="fas fa-clipboard-list"></i>
              Nueva Sesión
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              onClick={() => navigate('/fono/alumnos')}
            >
              <i className="fas fa-user-injured"></i>
              Ver Alumnos
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              onClick={() => navigate('/fono/evaluaciones')}
            >
              <i className="fas fa-chart-bar"></i>
              Evaluaciones
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              onClick={() => navigate('/fono/calendario')}
            >
              <i className="fas fa-calendar-check"></i>
              Calendario
            </button>
          </div>
        </div>

        {/* Empty State */}
        {!isLoading && sesionesRecientes.length === 0 && (
          <div className="card" style={{ marginTop: '25px' }}>
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: '#2196f315',
              borderRadius: '8px',
              border: '2px dashed #2196f3'
            }}>
              <i className="fas fa-info-circle" style={{ fontSize: '3em', color: '#2196f3', marginBottom: '15px' }}></i>
              <h3 style={{ color: '#2196f3', marginBottom: '10px' }}>No hay sesiones registradas</h3>
              <p style={{ color: '#666' }}>
                Comienza creando tu primera sesión terapéutica.
              </p>
              <button
                className="btn-primary"
                style={{ marginTop: '20px' }}
                onClick={() => navigate('/fono/sesiones')}
              >
                <i className="fas fa-plus"></i> Crear Primera Sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FonoDashboard;
