/**
 * HijoCard Component - Boy Happy
 *
 * Card de hijo/alumno para apoderado con información resumida.
 * Muestra indicadores rápidos, última actividad y acciones.
 *
 * Usado en: apoderado dashboard, mis hijos
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';

/**
 * HijoCard - Card de hijo para apoderados
 *
 * @param {Object} props
 * @param {Object} props.hijo - Datos del hijo/alumno
 * @param {string} props.hijo.rut - RUT del alumno
 * @param {string} props.hijo.nombre - Nombre completo
 * @param {string} props.hijo.curso - Curso actual
 * @param {number} props.hijo.edad - Edad en años
 * @param {number} props.hijo.asistencia - Porcentaje de asistencia (0-100)
 * @param {string} props.hijo.promedioEval - Promedio de evaluaciones
 * @param {number} props.hijo.comunicadosNuevos - Cantidad de comunicados nuevos
 * @param {string} props.hijo.ultimaActividad - Descripción de última actividad
 * @param {string} props.hijo.profesor - Nombre del profesor/educador
 * @param {boolean} props.showActions - Mostrar botones de acciones (default: false)
 * @param {Function} props.onVerDetalle - Callback al hacer click en la card
 * @param {Function} props.onVerAsistencia - Callback para ver asistencia
 * @param {Function} props.onVerEvaluaciones - Callback para ver evaluaciones
 * @param {Function} props.onVerMateriales - Callback para ver materiales
 * @param {string} props.className - Clases CSS adicionales
 */
export function HijoCard({
  hijo = {},
  showActions = false,
  onVerDetalle,
  onVerAsistencia,
  onVerEvaluaciones,
  onVerMateriales,
  className = '',
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Obtener inicial del nombre
  const inicial = useMemo(() => {
    return hijo.nombre ? hijo.nombre.charAt(0).toUpperCase() : 'A';
  }, [hijo.nombre]);

  // Estilo de la card con hover y transformación
  const cardStyle = useMemo(() => ({
    padding: '20px',
    borderLeft: '4px solid #3b82f6',
    transition: 'all 0.3s',
    cursor: onVerDetalle ? 'pointer' : 'default',
    ...(isHovered && onVerDetalle && {
      boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
      transform: 'translateY(-4px)'
    })
  }), [isHovered, onVerDetalle]);

  // Handler para click en la card
  const handleCardClick = () => {
    if (onVerDetalle) {
      onVerDetalle(hijo);
    }
  };

  // Handler para acciones (previene propagación)
  const handleAction = (callback) => (e) => {
    e.stopPropagation();
    if (callback) {
      callback(hijo);
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
      {/* Header: Avatar + Nombre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
        {/* Avatar */}
        <div style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '1.8em',
          boxShadow: '0 4px 8px rgba(59, 130, 246, 0.3)'
        }}>
          {inicial}
        </div>

        {/* Info Básica */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '1.2em' }}>
            {hijo.nombre || 'Alumno'}
          </h3>
          <div style={{ fontSize: '0.9em', color: '#64748b' }}>
            <i className="fas fa-graduation-cap" style={{ color: '#3b82f6' }} />
            <span> {hijo.curso || 'Sin curso'}</span>
            <span style={{ margin: '0 8px' }}>•</span>
            <span>{hijo.edad ? `${hijo.edad} años` : 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Indicadores Rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '15px 0' }}>
        {/* Asistencia */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          background: 'linear-gradient(135deg, #10b98115, #10b98108)',
          borderRadius: '10px',
          border: '1px solid #10b98120'
        }}>
          <div style={{ fontSize: '0.75em', color: '#047857', marginBottom: '5px', fontWeight: 600 }}>
            <i className="fas fa-calendar-check" /> Asistencia
          </div>
          <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#10b981' }}>
            {hijo.asistencia || 0}%
          </div>
        </div>

        {/* Evaluaciones */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          background: 'linear-gradient(135deg, #f59e0b15, #f59e0b08)',
          borderRadius: '10px',
          border: '1px solid #f59e0b20'
        }}>
          <div style={{ fontSize: '0.75em', color: '#b45309', marginBottom: '5px', fontWeight: 600 }}>
            <i className="fas fa-star" /> Evaluaciones
          </div>
          <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#f59e0b' }}>
            {hijo.promedioEval || 'N/A'}
          </div>
        </div>

        {/* Comunicados */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          background: 'linear-gradient(135deg, #8b5cf615, #8b5cf608)',
          borderRadius: '10px',
          border: '1px solid #8b5cf620'
        }}>
          <div style={{ fontSize: '0.75em', color: '#6b21a8', marginBottom: '5px', fontWeight: 600 }}>
            <i className="fas fa-bell" /> Nuevos
          </div>
          <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#8b5cf6' }}>
            {hijo.comunicadosNuevos || 0}
          </div>
        </div>
      </div>

      {/* Última Actividad */}
      {hijo.ultimaActividad && (
        <div style={{
          margin: '12px 0',
          padding: '10px',
          background: '#f8fafc',
          borderRadius: '8px',
          borderLeft: '3px solid #3b82f6'
        }}>
          <div style={{ fontSize: '0.8em', color: '#64748b', marginBottom: '3px' }}>
            <i className="fas fa-clock" /> Última actividad:
          </div>
          <div style={{ fontSize: '0.85em', color: '#334155', fontWeight: 500 }}>
            {hijo.ultimaActividad}
          </div>
        </div>
      )}

      {/* Profesor/Educador */}
      {hijo.profesor && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #e2e8f0',
          fontSize: '0.85em',
          color: '#64748b'
        }}>
          <i className="fas fa-chalkboard-teacher" style={{ color: '#3b82f6' }} />
          <span style={{ fontWeight: 500 }}> Educador: </span>
          <span>{hijo.profesor}</span>
        </div>
      )}

      {/* Acciones Rápidas (opcional) */}
      {showActions && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }} onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleAction(onVerAsistencia)}
          >
            <i className="fas fa-calendar-check" /> Asistencia
          </button>
          <button
            className="btn btn-sm btn-info"
            onClick={handleAction(onVerEvaluaciones)}
          >
            <i className="fas fa-star" /> Evaluaciones
          </button>
          <button
            className="btn btn-sm btn-success"
            onClick={handleAction(onVerMateriales)}
          >
            <i className="fas fa-book" /> Materiales
          </button>
        </div>
      )}
    </div>
  );
}

export default HijoCard;
