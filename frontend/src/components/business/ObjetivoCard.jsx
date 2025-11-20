/**
 * ObjetivoCard Component - Boy Happy
 *
 * Card de objetivo terapéutico con progreso y estado.
 * Muestra descripción, progreso, criterios de éxito y fechas.
 *
 * Usado en: fono mis alumnos, admin supervisión
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/helpers';

/**
 * ObjetivoCard - Card de objetivo terapéutico con tracking
 *
 * @param {Object} props
 * @param {Object} props.objetivo - Datos del objetivo
 * @param {string} props.objetivo.id - ID del objetivo
 * @param {string} props.objetivo.descripcion - Descripción del objetivo
 * @param {string} props.objetivo.area - Área terapéutica
 * @param {string} props.objetivo.estado - Estado: 'logrado', 'en_proceso', 'no_iniciado', 'pausado'
 * @param {number} props.objetivo.progreso - Porcentaje de progreso (0-100)
 * @param {Array<string>} props.objetivo.criterios - Criterios de éxito
 * @param {string} props.objetivo.fechaInicio - Fecha de inicio (ISO)
 * @param {string} props.objetivo.fechaObjetivo - Fecha objetivo/meta (ISO)
 * @param {number} props.objetivo.totalSesiones - Total de sesiones planificadas
 * @param {number} props.objetivo.sesionesRealizadas - Sesiones realizadas
 * @param {boolean} props.showActions - Mostrar botones de acciones (default: false)
 * @param {Function} props.onVerDetalle - Callback para ver detalle
 * @param {Function} props.onMarcarLogrado - Callback para marcar como logrado
 * @param {Function} props.onEditar - Callback para editar objetivo
 * @param {string} props.className - Clases CSS adicionales
 */
export function ObjetivoCard({
  objetivo = {},
  showActions = false,
  onVerDetalle,
  onMarcarLogrado,
  onEditar,
  className = '',
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Configuración de estado
  const estadoConfig = useMemo(() => {
    const configs = {
      logrado: {
        bg: '#d1fae5',
        color: '#065f46',
        text: 'Logrado'
      },
      en_proceso: {
        bg: '#fef3c7',
        color: '#92400e',
        text: 'En Proceso'
      },
      no_iniciado: {
        bg: '#fee2e2',
        color: '#991b1b',
        text: 'No Iniciado'
      },
      pausado: {
        bg: '#e0e7ff',
        color: '#3730a3',
        text: 'Pausado'
      }
    };
    return configs[objetivo.estado] || configs.no_iniciado;
  }, [objetivo.estado]);

  // Estilo de la card con hover
  const cardStyle = useMemo(() => ({
    padding: '16px',
    borderLeft: '4px solid #f59e0b',
    transition: 'all 0.3s',
    background: 'white',
    ...(isHovered && {
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    })
  }), [isHovered]);

  // Handler para acciones
  const handleAction = (callback) => (e) => {
    if (callback) {
      callback(objetivo);
    }
  };

  return (
    <div
      className={cn('card', className)}
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {/* Header: Descripción del Objetivo + Estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '1em', fontWeight: 600 }}>
            {objetivo.descripcion || 'Objetivo Terapéutico'}
          </h4>
          {objetivo.area && (
            <div style={{ fontSize: '0.8em', color: '#666' }}>
              <i className="fas fa-tag" style={{ color: '#f59e0b' }} />
              <span> {objetivo.area}</span>
            </div>
          )}
        </div>

        {/* Estado */}
        <span style={{
          padding: '4px 10px',
          borderRadius: '10px',
          fontSize: '0.75em',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          background: estadoConfig.bg,
          color: estadoConfig.color
        }}>
          {estadoConfig.text}
        </span>
      </div>

      {/* Progreso visual */}
      <div style={{ margin: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.8em', color: '#666' }}>Progreso:</span>
          <span style={{ fontSize: '0.85em', fontWeight: 'bold', color: '#f59e0b' }}>
            {objetivo.progreso || 0}%
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${objetivo.progreso || 0}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            transition: 'width 0.3s'
          }} />
        </div>
      </div>

      {/* Criterios de éxito */}
      {objetivo.criterios && objetivo.criterios.length > 0 && (
        <div style={{ margin: '12px 0' }}>
          <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '6px', fontWeight: 600 }}>
            <i className="fas fa-check-double" /> Criterios de Éxito:
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', listStyle: 'none' }}>
            {objetivo.criterios.map((criterio, index) => (
              <li
                key={index}
                style={{
                  marginBottom: '4px',
                  fontSize: '0.85em',
                  color: '#555',
                  position: 'relative',
                  paddingLeft: '12px'
                }}
              >
                <i
                  className="fas fa-circle"
                  style={{
                    position: 'absolute',
                    left: 0,
                    color: '#d1d5db',
                    fontSize: '0.4em',
                    marginTop: '6px'
                  }}
                />
                {criterio}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fechas */}
      <div style={{
        display: 'flex',
        gap: '15px',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #f3f4f6',
        fontSize: '0.8em',
        color: '#666'
      }}>
        {objetivo.fechaInicio && (
          <div>
            <i className="fas fa-calendar-plus" style={{ color: '#f59e0b' }} />
            <span> Inicio: {formatDate(objetivo.fechaInicio, 'short')}</span>
          </div>
        )}
        {objetivo.fechaObjetivo && (
          <div>
            <i className="fas fa-calendar-check" style={{ color: '#f59e0b' }} />
            <span> Meta: {formatDate(objetivo.fechaObjetivo, 'short')}</span>
          </div>
        )}
      </div>

      {/* Sesiones vinculadas */}
      {objetivo.totalSesiones !== undefined && (
        <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#666' }}>
          <i className="fas fa-clipboard-list" style={{ color: '#f59e0b' }} />
          <span> {objetivo.sesionesRealizadas || 0}/{objetivo.totalSesiones} sesiones realizadas</span>
        </div>
      )}

      {/* Acciones (opcional) */}
      {showActions && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleAction(onVerDetalle)}
          >
            <i className="fas fa-eye" /> Ver
          </button>
          {objetivo.estado !== 'logrado' && (
            <button
              className="btn btn-sm btn-success"
              onClick={handleAction(onMarcarLogrado)}
            >
              <i className="fas fa-check" /> Logrado
            </button>
          )}
          <button
            className="btn btn-sm btn-warning"
            onClick={handleAction(onEditar)}
          >
            <i className="fas fa-edit" />
          </button>
        </div>
      )}
    </div>
  );
}

export default ObjetivoCard;
