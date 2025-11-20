/**
 * ApoderadoDashboard - Dashboard para apoderados con información completa
 * Alineado con estilos de Admin Dashboard
 */

import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { useHijos } from '../../hooks/useHijos';
import { useEventos } from '../../hooks/useEventos';
import { useAnuncios } from '../../hooks/useAnuncios';
import { useAsistencia } from '../../hooks/useAsistencia';
import { useNotas } from '../../hooks/useNotas';
import { formatDate, formatNombre } from '../../utils/helpers';

function ApoderadoDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Fetch data
  const { data: hijos = [], isLoading: loadingHijos } = useHijos();
  const { data: eventos = [], isLoading: loadingEventos } = useEventos({ categoria: 'educacion' });
  const { data: anuncios = [], isLoading: loadingAnuncios } = useAnuncios();
  const { data: asistencia = [] } = useAsistencia();
  const { data: notas = [] } = useNotas();

  // Calculate stats
  const cantidadHijos = hijos.length;

  // Filter upcoming events (today or future)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const proximosEventos = eventos.filter(evento => {
    const fechaEvento = new Date(evento.fecha);
    return fechaEvento >= today;
  }).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 3);

  // Filter recent announcements (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const ultimosAnuncios = anuncios
    .filter(anuncio => {
      const fechaAnuncio = new Date(anuncio.fecha);
      return fechaAnuncio >= sevenDaysAgo;
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 3);

  // Calculate stats for each hijo
  const hijosConStats = hijos.map(hijo => {
    const asistenciaHijo = asistencia.filter(a => a.rutAlumno === hijo.alumnoRut);
    const notasHijo = notas.filter(n => n.rutAlumno === hijo.alumnoRut);

    const porcentajeAsistencia = asistenciaHijo.length > 0
      ? Math.round((asistenciaHijo.filter(a => a.estado === 'presente').length / asistenciaHijo.length) * 100)
      : 0;

    // Conceptual grading system
    const logrados = notasHijo.filter(n => n.nivelLogro === 'L').length;
    const tasaLogro = notasHijo.length > 0
      ? Math.round((logrados / notasHijo.length) * 100)
      : 0;

    // Determinar color de semáforo basado en asistencia
    let semaforoAsistencia = 'red';
    if (porcentajeAsistencia >= 85) semaforoAsistencia = 'green';
    else if (porcentajeAsistencia >= 75) semaforoAsistencia = 'yellow';

    return {
      ...hijo,
      porcentajeAsistencia,
      tasaLogro,
      totalNotas: notasHijo.length,
      logrados,
      semaforoAsistencia
    };
  });

  const loading = loadingHijos || loadingEventos || loadingAnuncios;

  // Calcular promedio de asistencia general
  const promedioAsistencia = hijosConStats.length > 0
    ? Math.round(hijosConStats.reduce((sum, h) => sum + h.porcentajeAsistencia, 0) / hijosConStats.length)
    : 0;

  let semaforoGeneral = 'red';
  if (promedioAsistencia >= 85) semaforoGeneral = 'green';
  else if (promedioAsistencia >= 75) semaforoGeneral = 'yellow';

  return (
    <div className="section active">
      <div className="content-header">
        <h1><i className="fas fa-home"></i> Bienvenido, {user?.name || 'Apoderado'}</h1>
        <p>Portal para apoderados - Seguimiento de sus hijos</p>
      </div>

      {/* Loading State */}
      {loading && !hijos.length && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#667eea' }}>
          <i className="fas fa-spinner fa-spin fa-3x"></i>
          <p style={{ marginTop: '15px', fontSize: '1.1em' }}>Cargando dashboard...</p>
        </div>
      )}

      {/* Dashboard Content */}
      <div>
        {/* Indicadores Principales */}
        <div className="dashboard-grid">
          {/* Mis Hijos */}
          <div className="indicator-card">
            <div className="indicator-header">
              <i className="fas fa-child fa-2x"></i>
              <h3>Mis Hijos</h3>
            </div>
            <div className="indicator-value">
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                cantidadHijos
              )}
            </div>
          </div>

          {/* Asistencia Promedio */}
          <div className="indicator-card">
            <div className="indicator-header">
              <i className="fas fa-calendar-check fa-2x"></i>
              <h3>Asistencia Promedio</h3>
            </div>
            <div className="indicator-value">{promedioAsistencia}%</div>
            <div className="indicator-semaphore" style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
              <div
                className={`semaphore-light ${semaforoGeneral === 'red' ? 'active' : ''}`}
                style={{ background: semaforoGeneral === 'red' ? '#f44336' : '#ddd' }}
              ></div>
              <div
                className={`semaphore-light ${semaforoGeneral === 'yellow' ? 'active' : ''}`}
                style={{ background: semaforoGeneral === 'yellow' ? '#ff9800' : '#ddd' }}
              ></div>
              <div
                className={`semaphore-light ${semaforoGeneral === 'green' ? 'active' : ''}`}
                style={{ background: semaforoGeneral === 'green' ? '#4caf50' : '#ddd' }}
              ></div>
            </div>
          </div>

          {/* Próximos Eventos */}
          <div className="indicator-card">
            <div className="indicator-header">
              <i className="fas fa-calendar-alt fa-2x"></i>
              <h3>Próximos Eventos</h3>
            </div>
            <div className="indicator-value">
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                proximosEventos.length
              )}
            </div>
          </div>

          {/* Anuncios Nuevos */}
          <div className="indicator-card">
            <div className="indicator-header">
              <i className="fas fa-bullhorn fa-2x"></i>
              <h3>Anuncios Nuevos</h3>
            </div>
            <div className="indicator-value">
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                ultimosAnuncios.length
              )}
            </div>
          </div>
        </div>

        {/* Mis Hijos - Cards */}
        {hijosConStats.length > 0 && (
          <div className="card" style={{ marginTop: '25px' }}>
            <h3><i className="fas fa-child"></i> Mis Hijos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginTop: '20px' }}>
              {hijosConStats.map((hijo) => (
                <div
                  key={hijo.alumnoRut}
                  className="card"
                  style={{
                    background: 'white',
                    border: '3px solid #AD1457',
                    color: '#333',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                  onClick={() => navigate('/apoderado/mis-hijos')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                  }}
                >
                  {/* Nombre del hijo con semáforo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, color: '#AD1457', fontWeight: 600 }}>{hijo.nombreAlumno || hijo.alumnoRut}</h4>
                    <div
                      className="semaphore-light active"
                      style={{
                        width: '16px',
                        height: '16px',
                        background: hijo.semaforoAsistencia === 'green' ? '#4caf50' : hijo.semaforoAsistencia === 'yellow' ? '#ff9800' : '#f44336',
                        boxShadow: `0 0 8px ${hijo.semaforoAsistencia === 'green' ? '#4caf50' : hijo.semaforoAsistencia === 'yellow' ? '#ff9800' : '#f44336'}`
                      }}
                    ></div>
                  </div>

                  {/* Info curso */}
                  <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '15px' }}>
                    <i className="fas fa-graduation-cap" style={{ color: '#AD1457' }}></i> Curso: {hijo.curso}
                  </div>

                  {/* Métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '4px' }}>
                        <i className="fas fa-calendar-check" style={{ color: '#AD1457' }}></i> Asistencia
                      </div>
                      <div style={{ fontSize: '1.6em', fontWeight: 'bold', color: '#AD1457' }}>{hijo.porcentajeAsistencia}%</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '4px' }}>
                        <i className="fas fa-star" style={{ color: '#AD1457' }}></i> Tasa Logro
                      </div>
                      <div style={{ fontSize: '1.6em', fontWeight: 'bold', color: '#AD1457' }}>{hijo.tasaLogro}%</div>
                    </div>
                  </div>

                  {/* Evaluaciones */}
                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #AD145733' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85em', color: '#666' }}>
                        <i className="fas fa-clipboard-check" style={{ color: '#AD1457' }}></i> Evaluaciones
                      </span>
                      <span style={{ fontSize: '1.1em', fontWeight: 'bold', color: '#AD1457' }}>
                        {hijo.logrados}/{hijo.totalNotas}
                      </span>
                    </div>
                  </div>

                  {/* Detalle */}
                  <div style={{ marginTop: '10px', fontSize: '0.75em', color: '#999', textAlign: 'right' }}>
                    <span>Logrados: {hijo.logrados}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Próximos Eventos */}
        {proximosEventos.length > 0 && (
          <div className="card" style={{ marginTop: '25px' }}>
            <h3><i className="fas fa-calendar-alt"></i> Próximos Eventos</h3>
            <div style={{ marginTop: '15px' }}>
              {proximosEventos.map((evento, index) => (
                <div
                  key={index}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    borderRadius: '8px',
                    background: '#2196f315',
                    borderLeft: '4px solid #2196f3',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate('/apoderado/calendario')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <i className="fas fa-calendar-day" style={{ color: '#2196f3', fontSize: '1.5em' }}></i>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#2196f3' }}>{evento.titulo}</strong>
                      <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                        <i className="fas fa-clock"></i> {formatDate(evento.fecha)}
                        {evento.hora_inicio && ` - ${evento.hora_inicio}`}
                      </div>
                      {evento.ubicacion && (
                        <div style={{ fontSize: '0.85em', color: '#666', marginTop: '2px' }}>
                          <i className="fas fa-map-marker-alt"></i> {evento.ubicacion}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75em', background: '#2196f3', color: 'white', padding: '4px 8px', borderRadius: '4px' }}>
                      {evento.tipo || 'Evento'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Últimos Anuncios */}
        {ultimosAnuncios.length > 0 && (
          <div className="card" style={{ marginTop: '25px' }}>
            <h3><i className="fas fa-bullhorn"></i> Últimos Anuncios</h3>
            <div style={{ marginTop: '15px' }}>
              {ultimosAnuncios.map((anuncio) => (
                <div
                  key={anuncio.id}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    borderRadius: '8px',
                    background: anuncio.prioridad === 'alta' ? '#f4433615' : '#ff980015',
                    borderLeft: `4px solid ${anuncio.prioridad === 'alta' ? '#f44336' : '#ff9800'}`,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate('/apoderado/anuncios')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <i className="fas fa-exclamation-circle" style={{ color: anuncio.prioridad === 'alta' ? '#f44336' : '#ff9800', fontSize: '1.5em' }}></i>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: anuncio.prioridad === 'alta' ? '#f44336' : '#ff9800' }}>{anuncio.titulo}</strong>
                      <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                        {anuncio.contenido || anuncio.descripcion}
                      </div>
                      <div style={{ fontSize: '0.75em', color: '#999', marginTop: '4px' }}>
                        <i className="fas fa-calendar"></i> {formatDate(anuncio.fecha)}
                      </div>
                    </div>
                    {anuncio.prioridad === 'alta' && (
                      <span style={{ fontSize: '0.75em', background: '#f44336', color: 'white', padding: '4px 8px', borderRadius: '4px' }}>
                        Importante
                      </span>
                    )}
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
              onClick={() => navigate('/apoderado/mis-hijos')}
            >
              <i className="fas fa-child"></i>
              Ver Mis Hijos
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              onClick={() => navigate('/apoderado/asistencia')}
            >
              <i className="fas fa-calendar-check"></i>
              Asistencia
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              onClick={() => navigate('/apoderado/evaluaciones')}
            >
              <i className="fas fa-star"></i>
              Evaluaciones
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              onClick={() => navigate('/apoderado/calendario')}
            >
              <i className="fas fa-calendar-alt"></i>
              Calendario
            </button>
          </div>
        </div>

        {/* Empty State */}
        {!loading && hijosConStats.length === 0 && (
          <div className="card" style={{ marginTop: '25px' }}>
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: '#2196f315',
              borderRadius: '8px',
              border: '2px dashed #2196f3'
            }}>
              <i className="fas fa-info-circle" style={{ fontSize: '3em', color: '#2196f3', marginBottom: '15px' }}></i>
              <h3 style={{ color: '#2196f3', marginBottom: '10px' }}>No hay hijos registrados</h3>
              <p style={{ color: '#666' }}>
                Contacta al administrador para asociar tus hijos a tu cuenta.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApoderadoDashboard;
