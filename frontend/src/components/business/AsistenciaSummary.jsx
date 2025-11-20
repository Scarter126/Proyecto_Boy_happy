/**
 * AsistenciaSummary Component - Boy Happy
 *
 * Resumen visual de asistencia con estadísticas presente/ausente/atrasado.
 * Card con gradiente y backdrop-filter para efecto glassmorphism.
 *
 * Usado en: admin asistencia, profesor cursos, dashboard
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/helpers';

/**
 * AsistenciaSummary - Resumen de asistencia con estadísticas
 *
 * @param {Object} props
 * @param {Object} props.summary - Datos del resumen
 * @param {string} props.summary.id - ID del resumen
 * @param {string} props.summary.fecha - Fecha del resumen (ISO)
 * @param {string} props.summary.curso - Nombre del curso
 * @param {number} props.summary.totalAlumnos - Total de alumnos
 * @param {number} props.summary.presente - Cantidad de presentes
 * @param {number} props.summary.ausente - Cantidad de ausentes
 * @param {number} props.summary.atrasado - Cantidad de atrasados
 * @param {number} props.summary.porcentaje - Porcentaje global de asistencia
 * @param {number} props.summary.porcentajePresente - Porcentaje de presentes
 * @param {number} props.summary.porcentajeAusente - Porcentaje de ausentes
 * @param {number} props.summary.porcentajeAtrasado - Porcentaje de atrasados
 * @param {Function} props.onVerDetalle - Callback para ver detalle completo
 * @param {string} props.className - Clases CSS adicionales
 */
export function AsistenciaSummary({
  summary = {},
  onVerDetalle,
  className = '',
  ...props
}) {
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  // Estilo del botón con hover
  const buttonStyle = useMemo(() => ({
    width: '100%',
    marginTop: '15px',
    padding: '10px',
    background: isButtonHovered ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s'
  }), [isButtonHovered]);

  // Handler para ver detalle
  const handleVerDetalle = () => {
    if (onVerDetalle) {
      onVerDetalle(summary);
    }
  };

  return (
    <div
      className={cn('card', className)}
      style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}
      {...props}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: 'white' }}>
          <i className="fas fa-calendar-check" />
          {' '}Resumen de Asistencia
        </h3>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '8px 16px',
          borderRadius: '20px',
          fontWeight: 'bold',
          fontSize: '1.2em'
        }}>
          {summary.porcentaje || 0}%
        </div>
      </div>

      {/* Grid de Estadísticas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '15px'
      }}>
        {/* Presente */}
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: '0.85em', opacity: 0.9, marginBottom: '8px' }}>
            <i className="fas fa-check-circle" /> Presente
          </div>
          <div style={{ fontSize: '2em', fontWeight: 'bold' }}>
            {summary.presente || 0}
          </div>
          <div style={{ fontSize: '0.75em', opacity: 0.8, marginTop: '4px' }}>
            {summary.porcentajePresente || 0}%
          </div>
        </div>

        {/* Ausente */}
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: '0.85em', opacity: 0.9, marginBottom: '8px' }}>
            <i className="fas fa-times-circle" /> Ausente
          </div>
          <div style={{ fontSize: '2em', fontWeight: 'bold' }}>
            {summary.ausente || 0}
          </div>
          <div style={{ fontSize: '0.75em', opacity: 0.8, marginTop: '4px' }}>
            {summary.porcentajeAusente || 0}%
          </div>
        </div>

        {/* Atrasado */}
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: '0.85em', opacity: 0.9, marginBottom: '8px' }}>
            <i className="fas fa-clock" /> Atrasado
          </div>
          <div style={{ fontSize: '2em', fontWeight: 'bold' }}>
            {summary.atrasado || 0}
          </div>
          <div style={{ fontSize: '0.75em', opacity: 0.8, marginTop: '4px' }}>
            {summary.porcentajeAtrasado || 0}%
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div style={{
        marginTop: '20px',
        paddingTop: '20px',
        borderTop: '1px solid rgba(255,255,255,0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.9em',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div>
          <i className="fas fa-users" />
          <span> Total alumnos: {summary.totalAlumnos || 0}</span>
        </div>
        {summary.fecha && (
          <div>
            <i className="fas fa-calendar" />
            <span> {formatDate(summary.fecha, 'short')}</span>
          </div>
        )}
        {summary.curso && (
          <div>
            <i className="fas fa-graduation-cap" />
            <span> {summary.curso}</span>
          </div>
        )}
      </div>

      {/* Botón Ver Detalle (opcional) */}
      {summary.id && (
        <button
          style={buttonStyle}
          onClick={handleVerDetalle}
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
        >
          <i className="fas fa-eye" /> Ver Detalle Completo
        </button>
      )}
    </div>
  );
}

export default AsistenciaSummary;
