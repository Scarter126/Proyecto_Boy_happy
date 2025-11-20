/**
 * AvanceRegistroCard Component - Boy Happy
 *
 * Card de registro de avance individual de un alumno.
 * Componente complejo con progress tracking y estados visuales.
 *
 * Usado en: profesor avance-alumnos
 *
 * Complejidad:
 * - Múltiples estados de nivel (logrado, en-proceso, iniciado)
 * - Progress circular visual con SVG
 * - Texto expandible/colapsable
 * - Arrays de objetivos trabajados
 * - Color coding según progreso
 * - Acciones de edición y eliminación
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/helpers';

/**
 * AvanceRegistroCard - Card de registro de avance
 *
 * @param {Object} props
 * @param {Object} props.registro - Datos del registro
 * @param {string} props.registro.id - ID único del registro
 * @param {string} props.registro.area - Área de desarrollo
 * @param {string} props.registro.nivel - Nivel: 'logrado', 'en-proceso', 'iniciado'
 * @param {number} props.registro.progreso - Porcentaje de progreso (0-100)
 * @param {string} props.registro.fecha - Fecha del registro (ISO)
 * @param {string} props.registro.educador - Nombre del educador/profesor
 * @param {string} props.registro.observacion - Observación detallada
 * @param {string[]} props.registro.objetivos - Array de objetivos trabajados
 * @param {Function} props.onEditar - Callback para editar registro
 * @param {Function} props.onEliminar - Callback para eliminar registro
 * @param {string} props.className - Clases CSS adicionales
 */
export function AvanceRegistroCard({
  registro = {},
  onEditar,
  onEliminar,
  className = '',
  ...props
}) {
  const [expanded, setExpanded] = useState(false);

  // Configuración de nivel
  const nivelConfig = useMemo(() => {
    const configs = {
      'logrado': {
        bg: '#dcfce7',
        color: '#166534',
        icon: 'fa-check-circle',
        text: 'Logrado'
      },
      'en-proceso': {
        bg: '#fef3c7',
        color: '#92400e',
        icon: 'fa-clock',
        text: 'En Proceso'
      },
      'iniciado': {
        bg: '#dbeafe',
        color: '#1e40af',
        icon: 'fa-play-circle',
        text: 'Iniciado'
      }
    };
    return configs[registro.nivel] || configs.iniciado;
  }, [registro.nivel]);

  // Color del círculo de progreso según valor
  const progresoColor = useMemo(() => {
    const progreso = registro.progreso || 0;
    if (progreso >= 75) return '#10b981';
    if (progreso >= 50) return '#3b82f6';
    return '#f59e0b';
  }, [registro.progreso]);

  // Calcular stroke-dasharray para el círculo de progreso
  const strokeDasharray = useMemo(() => {
    const progreso = registro.progreso || 0;
    const circumference = 2 * Math.PI * 30; // radio = 30
    const progress = (progreso / 100) * circumference;
    return `${progress} ${circumference}`;
  }, [registro.progreso]);

  // Verificar si la observación es larga (más de 100 caracteres)
  const isLongObservation = useMemo(() => {
    return registro.observacion && registro.observacion.length > 100;
  }, [registro.observacion]);

  // Handlers de acciones
  const handleEditar = (e) => {
    e.stopPropagation();
    if (onEditar) {
      onEditar(registro);
    }
  };

  const handleEliminar = (e) => {
    e.stopPropagation();
    if (onEliminar) {
      onEliminar(registro);
    }
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <div
      className={cn('card', className)}
      style={{
        padding: '15px',
        borderLeft: '4px solid #3b82f6',
        transition: 'all 0.3s'
      }}
      {...props}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        {/* Información Principal */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1em' }}>
              {registro.area || 'Área de desarrollo'}
            </h4>

            {/* Badge de Nivel */}
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75em',
                fontWeight: 600,
                background: nivelConfig.bg,
                color: nivelConfig.color
              }}
            >
              <i className={`fas ${nivelConfig.icon}`} />
              <span> {nivelConfig.text}</span>
            </span>
          </div>

          {/* Fecha y Educador */}
          <div style={{ fontSize: '0.85em', color: '#64748b', marginBottom: '10px' }}>
            <i className="fas fa-calendar" style={{ color: '#3b82f6' }} />
            <span> {formatDate(registro.fecha, 'long')}</span>
            <span style={{ margin: '0 8px' }}>•</span>
            <i className="fas fa-user" style={{ color: '#10b981' }} />
            <span> {registro.educador || 'Educador'}</span>
          </div>

          {/* Observación (colapsable) */}
          <div>
            <p
              style={{
                margin: 0,
                color: '#475569',
                fontSize: '0.9em',
                lineHeight: 1.5,
                ...((!expanded && isLongObservation) && {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                })
              }}
            >
              {registro.observacion || 'Sin observación'}
            </p>

            {isLongObservation && (
              <button
                onClick={toggleExpanded}
                style={{
                  marginTop: '5px',
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  fontSize: '0.85em',
                  cursor: 'pointer',
                  fontWeight: 500,
                  padding: 0
                }}
              >
                <span>{expanded ? 'Ver menos' : 'Leer más'}</span>
                <i className={`fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginLeft: '4px' }} />
              </button>
            )}
          </div>

          {/* Objetivos Trabajados */}
          {registro.objetivos && registro.objetivos.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '0.8em', color: '#64748b', marginBottom: '5px', fontWeight: 600 }}>
                <i className="fas fa-clipboard-list" />
                <span> Objetivos:</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {registro.objetivos.map((objetivo, index) => (
                  <span
                    key={index}
                    style={{
                      padding: '4px 10px',
                      background: '#f1f5f9',
                      borderRadius: '16px',
                      fontSize: '0.8em',
                      color: '#475569'
                    }}
                  >
                    {objetivo}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Barra de Progreso Circular */}
        <div style={{ textAlign: 'center', marginLeft: '15px' }}>
          <div style={{ position: 'relative', width: '70px', height: '70px' }}>
            {/* SVG Circle Progress */}
            <svg width="70" height="70" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background circle */}
              <circle
                cx="35"
                cy="35"
                r="30"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="6"
              />
              {/* Progress circle */}
              <circle
                cx="35"
                cy="35"
                r="30"
                fill="none"
                stroke={progresoColor}
                strokeWidth="6"
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
              />
            </svg>
            {/* Percentage text */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '1.2em',
                fontWeight: 'bold',
                color: progresoColor
              }}
            >
              {registro.progreso || 0}%
            </div>
          </div>
          <div style={{ fontSize: '0.7em', color: '#64748b', marginTop: '5px' }}>
            Progreso
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          marginTop: '15px',
          paddingTop: '15px',
          borderTop: '1px solid #e2e8f0'
        }}
      >
        {onEditar && (
          <button className="btn btn-sm btn-outline-primary" onClick={handleEditar}>
            <i className="fas fa-edit" />
            <span> Editar</span>
          </button>
        )}
        {onEliminar && (
          <button className="btn btn-sm btn-outline-danger" onClick={handleEliminar}>
            <i className="fas fa-trash" />
            <span> Eliminar</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default AvanceRegistroCard;
