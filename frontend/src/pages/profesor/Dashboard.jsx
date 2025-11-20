/**
 * ProfesorDashboard - Dashboard para profesores con datos reales
 * Alineado con estilos del dashboard de admin
 */

import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { useProfesorDashboard } from '../../hooks/useProfesorDashboard';

// Colores para cursos (misma paleta del admin)
const CURSO_COLORS = [
  '#4A148C', '#7B1FA2', '#AD1457', '#C2185B',
  '#D81B60', '#E91E63', '#F06292', '#1565C0'
];

function ProfesorDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { loading, error, dashboardData } = useProfesorDashboard();

  const getCursoColor = (index) => {
    return CURSO_COLORS[index % CURSO_COLORS.length];
  };

  // Loading State
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#667eea' }}>
        <i className="fas fa-spinner fa-spin fa-3x"></i>
        <p style={{ marginTop: '15px', fontSize: '1.1em' }}>Cargando dashboard...</p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="card" style={{ background: '#fff5f5', borderLeft: '4px solid #f44336' }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
          <i className="fas fa-exclamation-circle" style={{ color: '#f44336', fontSize: '1.5em' }}></i>
          <div>
            <h3 style={{ margin: '0 0 8px 0', color: '#f44336' }}>Error al cargar el dashboard</h3>
            <p style={{ margin: 0, color: '#666' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const { stats, cursos, alertas } = dashboardData;

  return (
    <div className="section active">
      {/* Header */}
      <div className="content-header">
        <h1>
          <i className="fas fa-tachometer-alt"></i> Bienvenido, {user?.name || 'Profesor'}
        </h1>
        <p style={{ color: '#666', margin: '8px 0 0 0' }}>Panel de control para profesores</p>
      </div>

      {/* Indicadores Principales */}
      <div className="dashboard-grid">
        {/* Mis Cursos */}
        <div className="indicator-card">
          <div className="indicator-header">
            <i className="fas fa-chalkboard fa-2x"></i>
            <h3>Mis Cursos</h3>
          </div>
          <div className="indicator-value">{stats.totalCursos}</div>
        </div>

        {/* Total Alumnos */}
        <div className="indicator-card">
          <div className="indicator-header">
            <i className="fas fa-user-graduate fa-2x"></i>
            <h3>Total Alumnos</h3>
          </div>
          <div className="indicator-value">{stats.totalAlumnos}</div>
        </div>

        {/* Asistencia Promedio */}
        <div className="indicator-card">
          <div className="indicator-header">
            <i className="fas fa-calendar-check fa-2x"></i>
            <h3>Asistencia Promedio</h3>
          </div>
          <div className="indicator-value">{stats.promedioAsistencia}%</div>
          <div className="indicator-semaphore" style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
            <div
              className={`semaphore-light ${stats.promedioAsistencia < 70 ? 'active' : ''}`}
              style={{ background: stats.promedioAsistencia < 70 ? '#f44336' : '#ddd' }}
            ></div>
            <div
              className={`semaphore-light ${stats.promedioAsistencia >= 70 && stats.promedioAsistencia < 85 ? 'active' : ''}`}
              style={{ background: stats.promedioAsistencia >= 70 && stats.promedioAsistencia < 85 ? '#ff9800' : '#ddd' }}
            ></div>
            <div
              className={`semaphore-light ${stats.promedioAsistencia >= 85 ? 'active' : ''}`}
              style={{ background: stats.promedioAsistencia >= 85 ? '#4caf50' : '#ddd' }}
            ></div>
          </div>
        </div>

        {/* Materiales Publicados */}
        <div className="indicator-card">
          <div className="indicator-header">
            <i className="fas fa-book fa-2x"></i>
            <h3>Materiales Publicados</h3>
          </div>
          <div className="indicator-value">{stats.materialesPublicados}</div>
        </div>
      </div>

      {/* Mis Cursos */}
      {cursos.length > 0 && (
        <div className="card" style={{ marginTop: '25px' }}>
          <h3><i className="fas fa-chalkboard-teacher"></i> Mis Cursos</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginTop: '20px' }}>
            {cursos.map((curso, index) => (
              <div
                key={`${curso.profesorRut}-${curso.curso}`}
                className="card"
                style={{
                  background: 'white',
                  border: `3px solid ${getCursoColor(index)}`,
                  color: '#333',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                onClick={() => navigate(`/profesor/curso/${curso.curso}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                {/* Nombre del curso con semáforo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, color: getCursoColor(index), fontWeight: 600 }}>{curso.curso}</h4>
                  <div
                    className="semaphore-light active"
                    style={{
                      width: '16px',
                      height: '16px',
                      background: curso.promedioAsistencia >= 80 ? '#4caf50' : curso.promedioAsistencia >= 60 ? '#ff9800' : '#f44336',
                      boxShadow: `0 0 8px ${curso.promedioAsistencia >= 80 ? '#4caf50' : curso.promedioAsistencia >= 60 ? '#ff9800' : '#f44336'}`
                    }}
                  ></div>
                </div>

                {/* Tipo */}
                <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '12px' }}>
                  {curso.tipo === 'jefe' ? 'Profesor Jefe' : curso.asignatura}
                </div>

                {/* Métricas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '4px' }}>
                      <i className="fas fa-users" style={{ color: getCursoColor(index) }}></i> Alumnos
                    </div>
                    <div style={{ fontSize: '1.6em', fontWeight: 'bold', color: getCursoColor(index) }}>{curso.totalAlumnos}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '4px' }}>
                      <i className="fas fa-calendar-check" style={{ color: getCursoColor(index) }}></i> Asistencia
                    </div>
                    <div style={{ fontSize: '1.6em', fontWeight: 'bold', color: getCursoColor(index) }}>{curso.promedioAsistencia}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones Rápidas */}
      <div className="card" style={{ marginTop: '25px' }}>
        <h3><i className="fas fa-bolt"></i> Acciones Rápidas</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '15px' }}>
          <button
            onClick={() => navigate('/profesor/asistencia')}
            className="btn-primary"
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <i className="fas fa-calendar-check"></i>
            Registrar Asistencia
          </button>
          <button
            onClick={() => navigate('/profesor/evaluaciones')}
            className="btn-secondary"
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <i className="fas fa-star"></i>
            Ingresar Notas
          </button>
          <button
            onClick={() => navigate('/profesor/materiales')}
            className="btn-secondary"
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <i className="fas fa-book"></i>
            Ver Materiales
          </button>
          <button
            onClick={() => navigate('/profesor/calendario')}
            className="btn-secondary"
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <i className="fas fa-calendar"></i>
            Ver Calendario
          </button>
        </div>
      </div>

      {/* Alertas y Notificaciones */}
      {alertas.length > 0 && (
        <div className="card" style={{ marginTop: '25px' }}>
          <h3><i className="fas fa-exclamation-triangle"></i> Alertas y Notificaciones</h3>
          <div style={{ marginTop: '15px', maxHeight: '400px', overflowY: 'auto' }}>
            {alertas.map((alerta, index) => (
              <div
                key={index}
                style={{
                  padding: '15px',
                  marginBottom: '10px',
                  borderRadius: '8px',
                  background: `${alerta.color}15`,
                  borderLeft: `4px solid ${alerta.color}`,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <i className={`fas ${alerta.icono}`} style={{ color: alerta.color, fontSize: '1.5em' }}></i>
                  <div>
                    <strong style={{ color: alerta.color }}>{alerta.mensaje}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado sin cursos */}
      {cursos.length === 0 && (
        <div className="card" style={{ marginTop: '25px', background: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <i className="fas fa-info-circle" style={{ color: '#2196f3', fontSize: '1.5em' }}></i>
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>No tienes cursos asignados</h3>
              <p style={{ margin: 0, color: '#666' }}>
                Contacta al administrador para que te asigne cursos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfesorDashboard;
