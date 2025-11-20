/**
 * AnuncioCard - Componente de tarjeta de anuncio/comunicado
 *
 * Muestra anuncios y comunicados para apoderados con:
 * - Título y fecha
 * - Contenido expandible (leer más/menos)
 * - Badge de "Nuevo"
 * - Categoría con colores (urgente, evento, recordatorio)
 * - Archivo adjunto descargable
 * - Destinatarios
 *
 * @component
 * @example
 * ```jsx
 * <AnuncioCard
 *   anuncio={{
 *     id: "anun-001",
 *     titulo: "Reunión de Apoderados",
 *     contenido: "Estimados apoderados...",
 *     fecha: "2025-10-23",
 *     autor: "Dirección",
 *     categoria: "evento",
 *     esNuevo: true,
 *     destinatarios: "todos",
 *     archivoUrl: "/docs/agenda.pdf",
 *     archivoNombre: "Agenda.pdf",
 *     archivoTamanio: "245 KB"
 *   }}
 * />
 * ```
 */

import React, { useState } from 'react';
import { formatDate } from '../../utils/helpers';

/**
 * @typedef {Object} Anuncio
 * @property {string} id - ID único del anuncio
 * @property {string} titulo - Título del anuncio
 * @property {string} contenido - Contenido del anuncio
 * @property {string} fecha - Fecha del anuncio (ISO string)
 * @property {string} [autor] - Autor del anuncio
 * @property {string} [categoria] - Categoría: 'urgente', 'evento', 'recordatorio', 'informacion'
 * @property {boolean} [esNuevo] - Si el anuncio es nuevo
 * @property {string} [destinatarios] - Destinatarios del anuncio
 * @property {string} [archivoUrl] - URL del archivo adjunto
 * @property {string} [archivoNombre] - Nombre del archivo adjunto
 * @property {string} [archivoTamanio] - Tamaño del archivo adjunto
 */

/**
 * @param {Object} props
 * @param {Anuncio} props.anuncio - Objeto con datos del anuncio
 * @param {string} [props.className] - Clases CSS adicionales
 */
export default function AnuncioCard({ anuncio = {}, className = '' }) {
  const [expandido, setExpandido] = useState(false);

  // Configuración de categorías
  const getCategoriaConfig = (categoria) => {
    const configs = {
      urgente: {
        bg: '#fee2e2',
        color: '#991b1b',
        icon: 'fa-exclamation-triangle',
        label: 'Urgente'
      },
      evento: {
        bg: '#dbeafe',
        color: '#1e40af',
        icon: 'fa-calendar-star',
        label: 'Evento'
      },
      recordatorio: {
        bg: '#fef3c7',
        color: '#92400e',
        icon: 'fa-bell',
        label: 'Recordatorio'
      },
      informacion: {
        bg: '#f3f4f6',
        color: '#374151',
        icon: 'fa-info-circle',
        label: 'Información'
      }
    };
    return configs[categoria] || configs.informacion;
  };

  const categoriaConfig = getCategoriaConfig(anuncio.categoria);
  const shouldShowReadMore = anuncio.contenido && anuncio.contenido.length > 150;

  return (
    <div
      className={`card ${className}`}
      style={{
        padding: '18px',
        borderLeft: '4px solid #10b981',
        transition: 'all 0.3s'
      }}
    >
      {/* Header: Título + Badge Nuevo */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <h4 style={{
            margin: '0 0 5px 0',
            color: '#1e293b',
            fontSize: '1.05em',
            fontWeight: 600
          }}>
            {anuncio.titulo || 'Anuncio'}
          </h4>
          <div style={{ fontSize: '0.8em', color: '#64748b' }}>
            <i className="fas fa-calendar" style={{ color: '#10b981' }} />
            <span> {formatDate(anuncio.fecha, 'long')}</span>
            {anuncio.autor && (
              <span style={{ marginLeft: '10px' }}>
                <i className="fas fa-user" />
                <span> {anuncio.autor}</span>
              </span>
            )}
          </div>
        </div>

        {/* Badge Nuevo */}
        {anuncio.esNuevo && (
          <span style={{
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75em',
            fontWeight: 600,
            background: '#fef3c7',
            color: '#92400e',
            whiteSpace: 'nowrap'
          }}>
            <i className="fas fa-star" /> Nuevo
          </span>
        )}
      </div>

      {/* Contenido (truncado o completo) */}
      <div style={{ margin: '12px 0' }}>
        <p style={{
          margin: 0,
          color: '#475569',
          fontSize: '0.9em',
          lineHeight: 1.6,
          ...((!expandido && shouldShowReadMore) && {
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          })
        }}>
          {anuncio.contenido || 'Sin contenido'}
        </p>

        {/* Botón Leer más/menos */}
        {shouldShowReadMore && (
          <button
            onClick={() => setExpandido(!expandido)}
            style={{
              marginTop: '8px',
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              fontSize: '0.85em',
              cursor: 'pointer',
              fontWeight: 500,
              padding: 0
            }}
          >
            <span>{expandido ? 'Ver menos' : 'Leer más'}</span>
            <i
              className={`fas ${expandido ? 'fa-chevron-up' : 'fa-chevron-down'}`}
              style={{ marginLeft: '4px' }}
            />
          </button>
        )}
      </div>

      {/* Categoría/Tipo */}
      {anuncio.categoria && (
        <div style={{ marginTop: '12px' }}>
          <span style={{
            padding: '4px 12px',
            borderRadius: '8px',
            fontSize: '0.75em',
            fontWeight: 500,
            background: categoriaConfig.bg,
            color: categoriaConfig.color
          }}>
            <i className={`fas ${categoriaConfig.icon}`} />
            <span> {categoriaConfig.label}</span>
          </span>
        </div>
      )}

      {/* Archivo adjunto (si existe) */}
      {anuncio.archivoUrl && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: '#f8fafc',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <i className="fas fa-paperclip fa-lg" style={{ color: '#64748b' }} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '0.85em',
              fontWeight: 500,
              color: '#334155'
            }}>
              {anuncio.archivoNombre || 'Archivo adjunto'}
            </div>
            {anuncio.archivoTamanio && (
              <div style={{
                fontSize: '0.75em',
                color: '#94a3b8'
              }}>
                {anuncio.archivoTamanio}
              </div>
            )}
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => window.open(anuncio.archivoUrl, '_blank')}
          >
            <i className="fas fa-download" />
          </button>
        </div>
      )}

      {/* Footer: Destinatarios */}
      {anuncio.destinatarios && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #e2e8f0',
          fontSize: '0.8em',
          color: '#94a3b8'
        }}>
          <i className="fas fa-users" />
          <span> Para: </span>
          <span style={{ color: '#64748b', fontWeight: 500 }}>
            {anuncio.destinatarios === 'todos'
              ? 'Todos los apoderados'
              : anuncio.destinatarios}
          </span>
        </div>
      )}
    </div>
  );
}
