/**
 * AlumnoCard Component - Boy Happy
 *
 * Card de alumno para profesor con información resumida y acciones.
 * Soporta 2 modos de visualización: compact (admin) y full (profesor).
 *
 * Usado en: admin, profesor mi-curso, avance-alumnos
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';

/**
 * AlumnoCard - Card de alumno con 2 modos de visualización
 *
 * @param {Object} props
 * @param {Object} props.alumno - Datos del alumno
 * @param {string} props.alumno.rut - RUT del alumno
 * @param {string} props.alumno.nombre - Nombre completo
 * @param {number} props.alumno.edad - Edad en años
 * @param {string} props.alumno.genero - Género ('M' o 'F')
 * @param {string} props.alumno.cursoActual - Curso actual
 * @param {number} props.alumno.asistencia - Porcentaje de asistencia (0-100)
 * @param {number} props.alumno.avance - Porcentaje de avance (0-100)
 * @param {string} props.alumno.promedioEval - Promedio de evaluaciones
 * @param {string} props.alumno.estado - Estado: 'activo', 'ausente', 'alerta'
 * @param {string} props.alumno.apoderado - Nombre del apoderado
 * @param {string} props.alumno.telefonoApoderado - Teléfono del apoderado
 * @param {string} props.alumno.ultimaObservacion - Última observación registrada
 * @param {string} props.mode - Modo de visualización: 'compact' o 'full' (default: 'full')
 * @param {boolean} props.showActions - Mostrar botones de acciones (default: false)
 * @param {Function} props.onVerDetalle - Callback al hacer click en la card
 * @param {Function} props.onRegistrarAsistencia - Callback para registrar asistencia
 * @param {Function} props.onRegistrarAvance - Callback para registrar avance
 * @param {Function} props.onVerEvaluaciones - Callback para ver evaluaciones
 * @param {string} props.className - Clases CSS adicionales
 */
export function AlumnoCard({
  alumno = {},
  mode = 'full',
  showActions = false,
  onVerDetalle,
  onRegistrarAsistencia,
  onRegistrarAvance,
  onVerEvaluaciones,
  className = '',
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Calcular estilos dinámicos
  const cardStyle = useMemo(() => ({
    padding: mode === 'compact' ? '15px' : '20px',
    transition: 'all 0.3s',
    cursor: onVerDetalle ? 'pointer' : 'default',
    position: 'relative',
    ...(isHovered && onVerDetalle && {
      boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
      transform: 'translateY(-4px)'
    })
  }), [mode, isHovered, onVerDetalle]);

  // Obtener configuración de estado
  const estadoConfig = useMemo(() => {
    const configs = {
      activo: {
        bg: '#dcfce7',
        color: '#166534',
        icon: 'fa-check-circle',
        text: 'Activo'
      },
      ausente: {
        bg: '#fee2e2',
        color: '#991b1b',
        icon: 'fa-times-circle',
        text: 'Ausente Hoy'
      },
      alerta: {
        bg: '#fef3c7',
        color: '#92400e',
        icon: 'fa-exclamation-circle',
        text: 'Alerta'
      }
    };
    return configs[alumno.estado] || configs.activo;
  }, [alumno.estado]);

  // Obtener avatar config
  const avatarConfig = useMemo(() => ({
    gradient: alumno.genero === 'F'
      ? 'linear-gradient(135deg, #ec4899, #f472b6)'
      : 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    shadow: alumno.genero === 'F'
      ? 'rgba(236, 72, 153, 0.3)'
      : 'rgba(59, 130, 246, 0.3)'
  }), [alumno.genero]);

  // Obtener inicial del nombre
  const inicial = useMemo(() => {
    return alumno.nombre ? alumno.nombre.charAt(0).toUpperCase() : 'A';
  }, [alumno.nombre]);

  // Handler para click en la card
  const handleCardClick = () => {
    if (onVerDetalle) {
      onVerDetalle(alumno);
    }
  };

  // Prevenir propagación en acciones
  const handleActionClick = (callback) => (e) => {
    e.stopPropagation();
    if (callback) {
      callback(alumno);
    }
  };

  return (
    <div
      className={cn('card', className)}
      style={cardStyle}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {/* Badge Estado (top-right) - Solo en modo full */}
      {alumno.estado && mode === 'full' && (
        <div style={{ position: 'absolute', top: '15px', right: '15px' }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75em',
            fontWeight: 600,
            background: estadoConfig.bg,
            color: estadoConfig.color
          }}>
            <i className={`fas ${estadoConfig.icon}`} />
            <span> {estadoConfig.text}</span>
          </span>
        </div>
      )}

      {/* Modo Compacto */}
      {mode === 'compact' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Avatar */}
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.2em'
          }}>
            {inicial}
          </div>

          {/* Datos */}
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '1em', color: '#1e293b' }}>
              {alumno.nombre || 'Alumno'}
            </h4>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.85em', color: '#64748b' }}>
              {alumno.cursoActual || 'Sin curso'} • RUT: {alumno.rut || '-'}
            </p>
          </div>

          {/* Asistencia */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75em', color: '#64748b' }}>Asistencia</div>
            <div style={{ fontSize: '1.3em', fontWeight: 'bold', color: '#10b981' }}>
              {alumno.asistencia || 0}%
            </div>
          </div>
        </div>
      )}

      {/* Modo Full */}
      {mode === 'full' && (
        <div>
          {/* Header: Avatar + Info Básica */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            {/* Avatar */}
            <div style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              background: avatarConfig.gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1.8em',
              boxShadow: `0 4px 8px ${avatarConfig.shadow}`
            }}>
              {inicial}
            </div>

            {/* Info Básica */}
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '1.1em' }}>
                {alumno.nombre || 'Alumno'}
              </h4>
              <div style={{ fontSize: '0.85em', color: '#64748b' }}>
                <i className="fas fa-id-card" style={{ color: '#3b82f6' }} />
                <span> {alumno.rut || 'Sin RUT'}</span>
              </div>
              <div style={{ fontSize: '0.85em', color: '#64748b', marginTop: '3px' }}>
                <i className="fas fa-birthday-cake" style={{ color: '#f59e0b' }} />
                <span> {alumno.edad ? `${alumno.edad} años` : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Indicadores de Progreso */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '15px 0' }}>
            {/* Asistencia */}
            <div style={{
              textAlign: 'center',
              padding: '10px',
              background: 'linear-gradient(135deg, #10b98115, #10b98108)',
              borderRadius: '10px',
              border: '1px solid #10b98120'
            }}>
              <div style={{ fontSize: '0.7em', color: '#047857', marginBottom: '3px', fontWeight: 600 }}>
                <i className="fas fa-calendar-check" /> Asistencia
              </div>
              <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#10b981' }}>
                {alumno.asistencia || 0}%
              </div>
            </div>

            {/* Avance */}
            <div style={{
              textAlign: 'center',
              padding: '10px',
              background: 'linear-gradient(135deg, #3b82f615, #3b82f608)',
              borderRadius: '10px',
              border: '1px solid #3b82f620'
            }}>
              <div style={{ fontSize: '0.7em', color: '#1e40af', marginBottom: '3px', fontWeight: 600 }}>
                <i className="fas fa-chart-line" /> Avance
              </div>
              <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#3b82f6' }}>
                {alumno.avance || 0}%
              </div>
            </div>

            {/* Evaluaciones */}
            <div style={{
              textAlign: 'center',
              padding: '10px',
              background: 'linear-gradient(135deg, #f59e0b15, #f59e0b08)',
              borderRadius: '10px',
              border: '1px solid #f59e0b20'
            }}>
              <div style={{ fontSize: '0.7em', color: '#b45309', marginBottom: '3px', fontWeight: 600 }}>
                <i className="fas fa-star" /> Promedio
              </div>
              <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#f59e0b' }}>
                {alumno.promedioEval || 'N/A'}
              </div>
            </div>
          </div>

          {/* Apoderado */}
          {alumno.apoderado && (
            <div style={{
              padding: '10px',
              background: '#f8fafc',
              borderRadius: '8px',
              fontSize: '0.85em',
              color: '#64748b',
              marginBottom: '15px'
            }}>
              <i className="fas fa-user-friends" style={{ color: '#8b5cf6' }} />
              <span style={{ fontWeight: 500 }}> Apoderado: </span>
              <span>{alumno.apoderado}</span>
              {alumno.telefonoApoderado && (
                <span style={{ marginLeft: '10px' }}>
                  <i className="fas fa-phone" />
                  <span> {alumno.telefonoApoderado}</span>
                </span>
              )}
            </div>
          )}

          {/* Última Observación */}
          {alumno.ultimaObservacion && (
            <div style={{
              padding: '10px',
              background: '#fffbeb',
              borderRadius: '8px',
              borderLeft: '3px solid #f59e0b',
              marginBottom: '15px'
            }}>
              <div style={{ fontSize: '0.75em', color: '#92400e', marginBottom: '3px', fontWeight: 600 }}>
                <i className="fas fa-sticky-note" /> Última observación:
              </div>
              <div style={{ fontSize: '0.85em', color: '#78350f', fontStyle: 'italic' }}>
                {alumno.ultimaObservacion}
              </div>
            </div>
          )}

          {/* Acciones Rápidas */}
          {showActions && (
            <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleActionClick(onRegistrarAsistencia)}
              >
                <i className="fas fa-calendar-check" /> Asistencia
              </button>
              <button
                className="btn btn-sm btn-info"
                onClick={handleActionClick(onRegistrarAvance)}
              >
                <i className="fas fa-chart-line" /> Avance
              </button>
              <button
                className="btn btn-sm btn-success"
                onClick={handleActionClick(onVerEvaluaciones)}
              >
                <i className="fas fa-star" /> Evaluar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AlumnoCard;
