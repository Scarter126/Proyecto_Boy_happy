/**
 * EventoCard - Componente de tarjeta de evento del calendario
 *
 * Muestra eventos del calendario con:
 * - Fecha destacada en un box con color temático
 * - Título y descripción del evento
 * - Badge de tipo (reunión, evaluación, actividad)
 * - Metadata: hora, lugar, participantes
 * - Acciones: editar y eliminar
 * - Efectos hover interactivos
 *
 * @component
 * @example
 * ```jsx
 * <EventoCard
 *   evento={{
 *     id: "evt-001",
 *     titulo: "Reunión de Apoderados",
 *     descripcion: "Reunión mensual para revisar avances",
 *     fecha: "2025-10-27",
 *     hora: "18:00",
 *     lugar: "Sala Multiuso",
 *     tipo: "reunion",
 *     tipoLabel: "Reunión",
 *     participantes: "Apoderados Medio Mayor"
 *   }}
 *   onVerDetalle={(evento) => console.log('Ver', evento)}
 *   onEditar={(evento) => console.log('Editar', evento)}
 *   onEliminar={(evento) => console.log('Eliminar', evento)}
 * />
 * ```
 */

import React, { useState } from 'react';

/**
 * @typedef {Object} Evento
 * @property {string} id - ID único del evento
 * @property {string} titulo - Título del evento
 * @property {string} [descripcion] - Descripción del evento
 * @property {string} fecha - Fecha del evento (ISO string)
 * @property {string} [hora] - Hora del evento
 * @property {string} [lugar] - Lugar del evento
 * @property {string} [tipo] - Tipo: 'reunion', 'evaluacion', 'actividad', 'otro'
 * @property {string} [tipoLabel] - Etiqueta del tipo
 * @property {string} [participantes] - Participantes del evento
 */

/**
 * Obtener configuración de tipo de evento
 * @param {string} tipo - Tipo de evento
 * @returns {Object} Configuración de colores e ícono
 */
const getTipoConfig = (tipo) => {
  const configs = {
    reunion: {
      bg: '#dbeafe',
      color: '#1e40af',
      icon: 'fa-users',
      label: 'Reunión'
    },
    evaluacion: {
      bg: '#fef3c7',
      color: '#92400e',
      icon: 'fa-clipboard-check',
      label: 'Evaluación'
    },
    actividad: {
      bg: '#dcfce7',
      color: '#166534',
      icon: 'fa-star',
      label: 'Actividad'
    },
    otro: {
      bg: '#f1f5f9',
      color: '#475569',
      icon: 'fa-calendar',
      label: 'Evento'
    }
  };
  return configs[tipo] || configs.otro;
};

/**
 * Obtener nombre del mes en español (corto)
 * @param {number} mes - Índice del mes (0-11)
 * @returns {string} Nombre del mes
 */
const getMesNombre = (mes) => {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return meses[mes];
};

/**
 * @param {Object} props
 * @param {Evento} props.evento - Objeto con datos del evento
 * @param {Function} [props.onVerDetalle] - Callback al ver detalle (evento) => void
 * @param {Function} [props.onEditar] - Callback al editar (evento) => void
 * @param {Function} [props.onEliminar] - Callback al eliminar (evento) => void
 * @param {string} [props.className] - Clases CSS adicionales
 */
export default function EventoCard({
  evento = {},
  onVerDetalle,
  onEditar,
  onEliminar,
  className = ''
}) {
  const [isHovered, setIsHovered] = useState(false);

  const tipoConfig = getTipoConfig(evento.tipo);
  const fecha = new Date(evento.fecha);
  const dia = fecha.getDate();
  const mes = getMesNombre(fecha.getMonth());

  const handleCardClick = () => {
    if (onVerDetalle) {
      onVerDetalle(evento);
    }
  };

  return (
    <div
      className={`card ${className}`}
      style={{
        padding: '15px',
        borderLeft: `4px solid ${tipoConfig.color}`,
        transition: 'all 0.3s',
        cursor: onVerDetalle ? 'pointer' : 'default',
        boxShadow: isHovered
          ? '0 4px 12px rgba(0,0,0,0.1)'
          : '0 2px 4px rgba(0,0,0,0.05)',
        transform: isHovered ? 'translateX(5px)' : 'translateX(0)'
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', gap: '15px' }}>
        {/* Fecha Box */}
        <div style={{
          minWidth: '65px',
          textAlign: 'center',
          padding: '10px',
          borderRadius: '10px',
          background: tipoConfig.bg
        }}>
          <div style={{
            fontSize: '1.8em',
            fontWeight: 'bold',
            color: tipoConfig.color
          }}>
            {dia}
          </div>
          <div style={{
            fontSize: '0.7em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: tipoConfig.color
          }}>
            {mes}
          </div>
        </div>

        {/* Detalle del Evento */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            marginBottom: '8px'
          }}>
            <h4 style={{
              margin: 0,
              color: '#1e293b',
              fontSize: '1em'
            }}>
              {evento.titulo || 'Evento'}
            </h4>

            {/* Badge Tipo */}
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.75em',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: tipoConfig.bg,
              color: tipoConfig.color
            }}>
              <i className={`fas ${tipoConfig.icon}`} />
              <span> {evento.tipoLabel || tipoConfig.label}</span>
            </span>
          </div>

          <p style={{
            margin: '0 0 10px 0',
            color: '#64748b',
            fontSize: '0.9em',
            lineHeight: 1.4
          }}>
            {evento.descripcion || 'Sin descripción'}
          </p>

          {/* Metadata */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '15px',
            fontSize: '0.85em',
            color: '#64748b'
          }}>
            {evento.hora && (
              <div>
                <i className="fas fa-clock" style={{ color: '#3b82f6' }} />
                <span> {evento.hora}</span>
              </div>
            )}
            {evento.lugar && (
              <div>
                <i className="fas fa-map-marker-alt" style={{ color: '#10b981' }} />
                <span> {evento.lugar}</span>
              </div>
            )}
            {evento.participantes && (
              <div>
                <i className="fas fa-user-friends" style={{ color: '#8b5cf6' }} />
                <span> {evento.participantes}</span>
              </div>
            )}
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
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => onEditar && onEditar(evento)}
        >
          <i className="fas fa-edit" /> Editar
        </button>
        <button
          className="btn btn-sm btn-outline-danger"
          onClick={() => onEliminar && onEliminar(evento)}
        >
          <i className="fas fa-trash" /> Eliminar
        </button>
      </div>
    </div>
  );
}
