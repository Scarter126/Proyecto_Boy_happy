/**
 * MaterialTerapeuticoCard Component - Boy Happy
 *
 * Card de material terapéutico con preview y acciones.
 * Componente complejo con manejo de workflow de aprobación y múltiples tipos de archivos.
 *
 * Usado en: fono materiales, admin biblioteca, profesor recursos
 *
 * Complejidad:
 * - Múltiples tipos de archivos (imagen, pdf, video, audio)
 * - Workflow de aprobación (pendiente, aprobado, rechazado, requiere_correccion)
 * - Preview de thumbnails
 * - Rating system
 * - Categorías y tags display
 * - Acciones contextuales según estado y rol
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/helpers';

/**
 * MaterialTerapeuticoCard - Card de material terapéutico
 *
 * @param {Object} props
 * @param {Object} props.material - Datos del material
 * @param {string} props.material.id - ID único del material
 * @param {string} props.material.titulo - Título del material
 * @param {string} props.material.descripcion - Descripción
 * @param {string} props.material.tipo - Tipo: 'imagen', 'pdf', 'video', 'audio', 'otro'
 * @param {string} props.material.autor - Autor/Creador del material
 * @param {string[]} props.material.categorias - Array de categorías/tags
 * @param {string[]} props.material.areasTerapeuticas - Áreas terapéuticas relacionadas
 * @param {number} props.material.edadMin - Edad mínima recomendada
 * @param {number} props.material.edadMax - Edad máxima recomendada
 * @param {string} props.material.fechaSubida - Fecha de subida (ISO)
 * @param {string} props.material.tamanio - Tamaño del archivo (ej: "2.5 MB")
 * @param {number} props.material.descargas - Cantidad de descargas
 * @param {number} props.material.rating - Rating (1-5)
 * @param {number} props.material.totalValoraciones - Total de valoraciones
 * @param {string} props.material.url - URL del archivo
 * @param {string} props.material.thumbnail - URL del thumbnail/preview
 * @param {boolean} props.material.esPropio - Si es propio del usuario actual
 * @param {string} props.material.estado - Estado aprobación: 'pendiente', 'aprobado', 'rechazado', 'requiere_correccion'
 * @param {boolean} props.showActions - Mostrar botones de acciones
 * @param {Function} props.onVerPreview - Callback para ver preview
 * @param {Function} props.onDescargar - Callback para descargar
 * @param {Function} props.onCompartir - Callback para compartir
 * @param {Function} props.onEditar - Callback para editar (solo si esPropio)
 * @param {Function} props.onEliminar - Callback para eliminar (solo si esPropio)
 * @param {Function} props.onAprobar - Callback para aprobar (solo admin)
 * @param {Function} props.onRechazar - Callback para rechazar (solo admin)
 * @param {string} props.className - Clases CSS adicionales
 */
export function MaterialTerapeuticoCard({
  material = {},
  showActions = false,
  onVerPreview,
  onDescargar,
  onCompartir,
  onEditar,
  onEliminar,
  onAprobar,
  onRechazar,
  className = '',
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Configuración de tipo de archivo
  const tipoConfig = useMemo(() => {
    const configs = {
      'pdf': {
        icon: 'fa-file-pdf',
        bg: '#fee2e2',
        color: '#991b1b'
      },
      'imagen': {
        icon: 'fa-image',
        bg: '#dbeafe',
        color: '#1e40af'
      },
      'video': {
        icon: 'fa-video',
        bg: '#fce7f3',
        color: '#9f1239'
      },
      'audio': {
        icon: 'fa-volume-up',
        bg: '#fef3c7',
        color: '#92400e'
      },
      'otro': {
        icon: 'fa-file',
        bg: '#f3f4f6',
        color: '#374151'
      }
    };
    return configs[material.tipo] || configs.otro;
  }, [material.tipo]);

  // Configuración de estado de aprobación
  const estadoConfig = useMemo(() => {
    const configs = {
      'pendiente': {
        bg: '#fef3c7',
        color: '#92400e',
        icon: 'fa-clock',
        text: 'Pendiente'
      },
      'aprobado': {
        bg: '#dcfce7',
        color: '#166534',
        icon: 'fa-check-circle',
        text: 'Aprobado'
      },
      'rechazado': {
        bg: '#fee2e2',
        color: '#991b1b',
        icon: 'fa-times-circle',
        text: 'Rechazado'
      },
      'requiere_correccion': {
        bg: '#dbeafe',
        color: '#1e40af',
        icon: 'fa-exclamation-circle',
        text: 'Requiere Corrección'
      }
    };
    return configs[material.estado] || configs.pendiente;
  }, [material.estado]);

  // Estilos dinámicos de la card
  const cardStyle = useMemo(() => ({
    padding: '18px',
    borderLeft: '4px solid #06b6d4',
    transition: 'all 0.3s',
    background: 'white',
    boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)'
  }), [isHovered]);

  // Renderizar estrellas de rating
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <i
          key={i}
          className={i <= (material.rating || 0) ? 'fas fa-star' : 'far fa-star'}
          style={{ color: '#fbbf24', fontSize: '0.85em' }}
        />
      );
    }
    return stars;
  };

  // Handlers de acciones
  const handleActionClick = (callback) => (e) => {
    e.stopPropagation();
    if (callback) {
      callback(material);
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
      {/* Header: Título + Tipo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '1.05em', fontWeight: 600 }}>
            <i className={`fas ${tipoConfig.icon}`} style={{ color: '#06b6d4' }} />
            <span> {material.titulo || 'Material Terapéutico'}</span>
          </h4>
          {material.autor && (
            <div style={{ fontSize: '0.8em', color: '#666' }}>
              <i className="fas fa-user" />
              <span> {material.autor}</span>
            </div>
          )}
        </div>

        {/* Tipo de archivo badge */}
        <span
          style={{
            padding: '4px 10px',
            borderRadius: '10px',
            fontSize: '0.75em',
            fontWeight: 600,
            textTransform: 'uppercase',
            background: tipoConfig.bg,
            color: tipoConfig.color
          }}
        >
          {material.tipo || 'Archivo'}
        </span>
      </div>

      {/* Estado de aprobación (si existe) */}
      {material.estado && (
        <div style={{ marginBottom: '12px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '10px',
              fontSize: '0.75em',
              fontWeight: 600,
              background: estadoConfig.bg,
              color: estadoConfig.color
            }}
          >
            <i className={`fas ${estadoConfig.icon}`} />
            <span>{estadoConfig.text}</span>
          </span>
        </div>
      )}

      {/* Descripción */}
      {material.descripcion && (
        <p style={{ margin: '10px 0', color: '#555', fontSize: '0.9em', lineHeight: 1.5 }}>
          {material.descripcion}
        </p>
      )}

      {/* Categorías/Tags */}
      {material.categorias && material.categorias.length > 0 && (
        <div style={{ margin: '12px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {material.categorias.map((categoria, index) => (
              <span
                key={index}
                style={{
                  background: '#ecfeff',
                  color: '#0e7490',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75em',
                  fontWeight: 500
                }}
              >
                {categoria}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preview/Thumbnail (si es imagen) */}
      {material.thumbnail && material.tipo === 'imagen' && !imageError && (
        <div style={{ margin: '12px 0', borderRadius: '8px', overflow: 'hidden', maxHeight: '150px' }}>
          <img
            src={material.thumbnail}
            alt={material.titulo}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* Áreas terapéuticas */}
      {material.areasTerapeuticas && material.areasTerapeuticas.length > 0 && (
        <div style={{ margin: '12px 0' }}>
          <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '6px' }}>
            <i className="fas fa-bullseye" />
            <span> Áreas Terapéuticas:</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {material.areasTerapeuticas.map((area, index) => (
              <span
                key={index}
                style={{
                  background: '#ede9fe',
                  color: '#6b21a8',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75em'
                }}
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rango de edad recomendado */}
      {(material.edadMin || material.edadMax) && (
        <div style={{ margin: '10px 0', fontSize: '0.85em', color: '#666' }}>
          <i className="fas fa-child" style={{ color: '#06b6d4' }} />
          <span> Edad: {material.edadMin || '0'} - {material.edadMax || '12'} años</span>
        </div>
      )}

      {/* Metadata: Fecha, Tamaño, Descargas */}
      <div style={{
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #f3f4f6',
        fontSize: '0.8em',
        color: '#666'
      }}>
        {material.fechaSubida && (
          <div>
            <i className="fas fa-calendar" style={{ color: '#06b6d4' }} />
            <span> {formatDate(material.fechaSubida, 'short')}</span>
          </div>
        )}
        {material.tamanio && (
          <div>
            <i className="fas fa-file-archive" style={{ color: '#06b6d4' }} />
            <span> {material.tamanio}</span>
          </div>
        )}
        {material.descargas !== undefined && (
          <div>
            <i className="fas fa-download" style={{ color: '#06b6d4' }} />
            <span> {material.descargas} descargas</span>
          </div>
        )}
      </div>

      {/* Rating (opcional) */}
      {material.rating && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              {renderStars()}
            </div>
            {material.totalValoraciones && (
              <span style={{ fontSize: '0.75em', color: '#999' }}>
                ({material.totalValoraciones})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Acciones */}
      {showActions && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '15px', flexWrap: 'wrap' }}>
          {onVerPreview && (
            <button className="btn btn-sm btn-primary" onClick={handleActionClick(onVerPreview)}>
              <i className="fas fa-eye" />
              <span> Preview</span>
            </button>
          )}
          {onDescargar && (
            <button className="btn btn-sm btn-success" onClick={handleActionClick(onDescargar)}>
              <i className="fas fa-download" />
              <span> Descargar</span>
            </button>
          )}
          {onCompartir && (
            <button className="btn btn-sm btn-info" onClick={handleActionClick(onCompartir)}>
              <i className="fas fa-share" />
              <span> Compartir</span>
            </button>
          )}
          {material.esPropio && onEditar && (
            <button className="btn btn-sm btn-warning" onClick={handleActionClick(onEditar)}>
              <i className="fas fa-edit" />
            </button>
          )}
          {material.esPropio && onEliminar && (
            <button className="btn btn-sm btn-danger" onClick={handleActionClick(onEliminar)}>
              <i className="fas fa-trash" />
            </button>
          )}
          {/* Acciones de admin para aprobación */}
          {material.estado === 'pendiente' && onAprobar && (
            <button className="btn btn-sm btn-success" onClick={handleActionClick(onAprobar)}>
              <i className="fas fa-check" />
              <span> Aprobar</span>
            </button>
          )}
          {material.estado === 'pendiente' && onRechazar && (
            <button className="btn btn-sm btn-danger" onClick={handleActionClick(onRechazar)}>
              <i className="fas fa-times" />
              <span> Rechazar</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MaterialTerapeuticoCard;
