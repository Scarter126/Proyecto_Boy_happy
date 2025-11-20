/**
 * Dashboard de Indicadores - Admin
 *
 * Recuperado de la estructura HTML legacy con todas sus funcionalidades
 */

import { useState, useEffect } from 'react';

// Colores para cursos (misma paleta del legacy)
const CURSO_COLORS = [
  '#4A148C', // Púrpura oscuro
  '#7B1FA2', // Púrpura
  '#AD1457', // Burgundy
  '#C2185B', // Rosa oscuro
  '#D81B60', // Rosa
  '#E91E63', // Rosa brillante
  '#F06292', // Rosa claro
  '#1565C0', // Azul
];

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [indicadores, setIndicadores] = useState({
    totalUsuarios: 0,
    trendUsuarios: '0%',
    promedioAsistencia: '0%',
    semaforoAsistencia: 'red',
    materialesActivos: 0,
    semaforoMateriales: 'red',
  });
  const [resumenCursos, setResumenCursos] = useState([]);
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Simular carga de datos (reemplazar con llamada real a API)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Datos simulados - reemplazar con datos reales
      const mockData = {
        indicadores: {
          totalUsuarios: 42,
          trendUsuarios: '+12%',
          promedioAsistencia: '87%',
          semaforoAsistencia: 'green',
          materialesActivos: 15,
          semaforoMateriales: 'yellow',
        },
        resumenCursos: [
          {
            codigo: 'CUR001',
            nombre: 'Pre-Kinder A',
            alumnos: 12,
            asistencia: '92%',
            materialesPublicados: 8,
            materialesTotal: 10,
            registrosAsistencia: 45,
            semaforoColor: '#4caf50', // verde
          },
          {
            codigo: 'CUR002',
            nombre: 'Kinder B',
            alumnos: 15,
            asistencia: '85%',
            materialesPublicados: 6,
            materialesTotal: 10,
            registrosAsistencia: 52,
            semaforoColor: '#ff9800', // amarillo
          },
          {
            codigo: 'CUR003',
            nombre: 'Primero Básico',
            alumnos: 18,
            asistencia: '78%',
            materialesPublicados: 5,
            materialesTotal: 10,
            registrosAsistencia: 38,
            semaforoColor: '#f44336', // rojo
          },
        ],
        alertas: [
          {
            mensaje: 'Asistencia baja en Kinder B (últimas 2 semanas)',
            prioridad: 'alta',
            icono: 'fa-exclamation-triangle',
            color: '#ff9800',
          },
          {
            mensaje: '3 materiales pendientes de publicar en Pre-Kinder A',
            prioridad: 'media',
            icono: 'fa-folder',
            color: '#2196f3',
          },
        ],
      };

      setData(mockData);
      setIndicadores(mockData.indicadores);
      setResumenCursos(mockData.resumenCursos);
      setAlertas(mockData.alertas);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCursoColor = (index) => {
    return CURSO_COLORS[index % CURSO_COLORS.length];
  };

  return (
    <div className="section active">
      <div className="content-header">
        <h1><i className="fas fa-tachometer-alt"></i> Dashboard de Indicadores</h1>
      </div>

      {/* Loading State */}
      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#667eea' }}>
          <i className="fas fa-spinner fa-spin fa-3x"></i>
          <p style={{ marginTop: '15px', fontSize: '1.1em' }}>Cargando dashboard...</p>
        </div>
      )}

      {/* Dashboard Content */}
      {data && (
        <div>
          {/* Indicadores Principales */}
          <div className="dashboard-grid">
            {/* Usuarios Activos */}
            <div className="indicator-card">
              <div className="indicator-header">
                <i className="fas fa-users fa-2x"></i>
                <h3>Usuarios Activos</h3>
              </div>
              <div className="indicator-value">{indicadores.totalUsuarios}</div>
              <div className="indicator-trend">
                <small style={{ color: '#4caf50' }}>
                  <i className="fas fa-arrow-up"></i>
                  <span>{indicadores.trendUsuarios}</span>
                </small>
              </div>
            </div>

            {/* Asistencia Promedio */}
            <div className="indicator-card">
              <div className="indicator-header">
                <i className="fas fa-calendar-check fa-2x"></i>
                <h3>Asistencia Promedio</h3>
              </div>
              <div className="indicator-value">{indicadores.promedioAsistencia}</div>
              <div className="indicator-semaphore" style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  className={`semaphore-light ${indicadores.semaforoAsistencia === 'red' ? 'active' : ''}`}
                  style={{ background: indicadores.semaforoAsistencia === 'red' ? '#f44336' : '#ddd' }}
                ></div>
                <div
                  className={`semaphore-light ${indicadores.semaforoAsistencia === 'yellow' ? 'active' : ''}`}
                  style={{ background: indicadores.semaforoAsistencia === 'yellow' ? '#ff9800' : '#ddd' }}
                ></div>
                <div
                  className={`semaphore-light ${indicadores.semaforoAsistencia === 'green' ? 'active' : ''}`}
                  style={{ background: indicadores.semaforoAsistencia === 'green' ? '#4caf50' : '#ddd' }}
                ></div>
              </div>
            </div>

            {/* Materiales Activos */}
            <div className="indicator-card">
              <div className="indicator-header">
                <i className="fas fa-folder fa-2x"></i>
                <h3>Materiales Activos</h3>
              </div>
              <div className="indicator-value">{indicadores.materialesActivos}</div>
              <div className="indicator-semaphore" style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  className={`semaphore-light ${indicadores.semaforoMateriales === 'red' ? 'active' : ''}`}
                  style={{ background: indicadores.semaforoMateriales === 'red' ? '#f44336' : '#ddd' }}
                ></div>
                <div
                  className={`semaphore-light ${indicadores.semaforoMateriales === 'yellow' ? 'active' : ''}`}
                  style={{ background: indicadores.semaforoMateriales === 'yellow' ? '#ff9800' : '#ddd' }}
                ></div>
                <div
                  className={`semaphore-light ${indicadores.semaforoMateriales === 'green' ? 'active' : ''}`}
                  style={{ background: indicadores.semaforoMateriales === 'green' ? '#4caf50' : '#ddd' }}
                ></div>
              </div>
            </div>
          </div>

          {/* Resumen por Curso */}
          <div className="card" style={{ marginTop: '25px' }}>
            <h3><i className="fas fa-chart-bar"></i> Resumen por Curso</h3>

            {resumenCursos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                <i className="fas fa-info-circle"></i> No hay datos de cursos disponibles
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginTop: '20px' }}>
                {resumenCursos.map((curso, index) => (
                  <div
                    key={curso.codigo}
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
                      <h4 style={{ margin: 0, color: getCursoColor(index), fontWeight: 600 }}>{curso.nombre}</h4>
                      <div
                        className="semaphore-light active"
                        style={{
                          width: '16px',
                          height: '16px',
                          background: curso.semaforoColor,
                          boxShadow: `0 0 8px ${curso.semaforoColor}`
                        }}
                      ></div>
                    </div>

                    {/* Métricas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '4px' }}>
                          <i className="fas fa-users" style={{ color: getCursoColor(index) }}></i> Alumnos
                        </div>
                        <div style={{ fontSize: '1.6em', fontWeight: 'bold', color: getCursoColor(index) }}>{curso.alumnos}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '4px' }}>
                          <i className="fas fa-calendar-check" style={{ color: getCursoColor(index) }}></i> Asistencia
                        </div>
                        <div style={{ fontSize: '1.6em', fontWeight: 'bold', color: getCursoColor(index) }}>{curso.asistencia}</div>
                      </div>
                    </div>

                    {/* Materiales */}
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: `2px solid ${getCursoColor(index)}33` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85em', color: '#666' }}>
                          <i className="fas fa-book" style={{ color: getCursoColor(index) }}></i> Materiales publicados
                        </span>
                        <span style={{ fontSize: '1.1em', fontWeight: 'bold', color: getCursoColor(index) }}>
                          {curso.materialesPublicados}/{curso.materialesTotal}
                        </span>
                      </div>
                    </div>

                    {/* Detalle de registros */}
                    <div style={{ marginTop: '10px', fontSize: '0.75em', color: '#999', textAlign: 'right' }}>
                      <span>{curso.registrosAsistencia} registros</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertas Críticas */}
          <div className="card" style={{ marginTop: '25px' }}>
            <h3><i className="fas fa-exclamation-triangle"></i> Alertas y Acciones Requeridas</h3>
            <div style={{ marginTop: '15px', maxHeight: '400px', overflowY: 'auto' }}>
              {alertas.length === 0 ? (
                <p style={{ color: '#4caf50', textAlign: 'center' }}>
                  <i className="fas fa-check-circle"></i> No hay alertas críticas
                </p>
              ) : (
                alertas.map((alerta, index) => (
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
                        <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                          Prioridad: <span>{alerta.prioridad.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
