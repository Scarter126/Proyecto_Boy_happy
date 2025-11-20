/**
 * SesionCard Component - Boy Happy
 *
 * Card de sesión fonoaudiológica con objetivos y observaciones.
 * Componente más complejo del sistema con nested objetivos, materiales y evidencias.
 *
 * Usado en: fono bitácora, admin supervisión, profesor consulta
 *
 * Complejidad:
 * - Manejo de arrays nested (objetivos, materiales, evidencias)
 * - Múltiples secciones condicionales
 * - Progress tracking visual
 * - File attachments display
 * - Acciones contextuales según rol
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/helpers';

/**
 * SesionCard - Card de sesión fonoaudiológica
 *
 * @param {Object} props
 * @param {Object} props.sesion - Datos de la sesión
 * @param {string} props.sesion.id - ID único de la sesión
 * @param {string} props.sesion.nombreAlumno - Nombre del alumno
 * @param {string} props.sesion.rutAlumno - RUT del alumno
 * @param {number} props.sesion.numeroSesion - Número de sesión (1, 2, 3...)
 * @param {string} props.sesion.tipo - Tipo de terapia
 * @param {string} props.sesion.fecha - Fecha de la sesión (ISO)
 * @param {number} props.sesion.duracion - Duración en minutos
 * @param {string[]} props.sesion.objetivos - Array de objetivos trabajados
 * @param {string} props.sesion.actividades - Descripción de actividades
 * @param {string} props.sesion.observaciones - Observaciones del terapeuta
 * @param {number} props.sesion.progreso - Porcentaje de progreso (0-100)
 * @param {string[]} props.sesion.materiales - Array de materiales utilizados
 * @param {Object[]} props.sesion.evidencias - Array de evidencias (archivos)
 * @param {string} props.sesion.evidencias[].nombre - Nombre del archivo
 * @param {string} props.sesion.evidencias[].url - URL del archivo
 * @param {string} props.sesion.evidencias[].tipo - Tipo: 'imagen', 'audio', 'pdf', 'otro'
 * @param {string} props.sesion.terapeuta - Nombre del terapeuta
 * @param {boolean} props.showActions - Mostrar botones de acciones
 * @param {Function} props.onVerDetalle - Callback para ver detalle completo
 * @param {Function} props.onEditar - Callback para editar sesión
 * @param {Function} props.onCompartir - Callback para compartir sesión
 * @param {string} props.className - Clases CSS adicionales
 */
export function SesionCard({
  sesion = {},
  showActions = false,
  onVerDetalle,
  onEditar,
  onCompartir,
  className = '',
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Estilos dinámicos de la card
  const cardStyle = useMemo(() => ({
    padding: '20px',
    borderLeft: '4px solid #10b981',
    transition: 'all 0.3s',
    boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)'
  }), [isHovered]);

  // Obtener icono de evidencia según tipo
  const getEvidenciaIcon = (tipo) => {
    const iconMap = {
      'imagen': 'fa-image',
      'audio': 'fa-volume-up',
      'video': 'fa-video',
      'pdf': 'fa-file-pdf',
      'otro': 'fa-file'
    };
    return iconMap[tipo] || 'fa-file';
  };

  // Calcular color de la barra de progreso
  const progresoColor = useMemo(() => {
    const progreso = sesion.progreso || 0;
    if (progreso >= 75) return '#10b981';
    if (progreso >= 50) return '#3b82f6';
    if (progreso >= 25) return '#f59e0b';
    return '#ef4444';
  }, [sesion.progreso]);

  // Handlers de acciones
  const handleVerDetalle = () => {
    if (onVerDetalle) {
      onVerDetalle(sesion);
    }
  };

  const handleEditar = (e) => {
    e.stopPropagation();
    if (onEditar) {
      onEditar(sesion);
    }
  };

  const handleCompartir = (e) => {
    e.stopPropagation();
    if (onCompartir) {
      onCompartir(sesion);
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
      {/* Header: Alumno + Número de Sesión */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '1.1em' }}>
            <i className="fas fa-user" style={{ color: '#10b981' }} />
            <span> {sesion.nombreAlumno || 'Alumno'}</span>
          </h4>
          <div style={{ fontSize: '0.85em', color: '#666' }}>
            <i className="fas fa-hashtag" />
            <span> Sesión {sesion.numeroSesion || '1'}</span>
            {sesion.tipo && (
              <>
                <span> • </span>
                <span>{sesion.tipo}</span>
              </>
            )}
          </div>
        </div>

        {/* Fecha y Duración */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85em', color: '#666' }}>
            {formatDate(sesion.fecha, 'short')}
          </div>
          {sesion.duracion && (
            <div style={{ fontSize: '0.8em', color: '#999', marginTop: '2px' }}>
              <i className="fas fa-clock" />
              <span> {sesion.duracion} min</span>
            </div>
          )}
        </div>
      </div>

      {/* Objetivos de la sesión */}
      {sesion.objetivos && sesion.objetivos.length > 0 && (
        <div style={{ margin: '15px 0' }}>
          <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px', fontWeight: 600 }}>
            <i className="fas fa-bullseye" />
            <span> Objetivos Trabajados:</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', listStyle: 'none' }}>
            {sesion.objetivos.map((objetivo, index) => (
              <li
                key={index}
                style={{
                  marginBottom: '6px',
                  fontSize: '0.9em',
                  color: '#555',
                  position: 'relative',
                  paddingLeft: '15px'
                }}
              >
                <i
                  className="fas fa-check"
                  style={{
                    position: 'absolute',
                    left: 0,
                    color: '#10b981',
                    fontSize: '0.8em',
                    marginTop: '3px'
                  }}
                />
                <span>{objetivo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actividades realizadas */}
      {sesion.actividades && (
        <div style={{ margin: '12px 0', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.85em', color: '#065f46', fontWeight: 600, marginBottom: '5px' }}>
            <i className="fas fa-tasks" />
            <span> Actividades:</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.9em', color: '#047857', lineHeight: 1.5 }}>
            {sesion.actividades}
          </p>
        </div>
      )}

      {/* Observaciones */}
      {sesion.observaciones && (
        <div style={{ margin: '12px 0' }}>
          <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '5px', fontWeight: 600 }}>
            <i className="fas fa-comment-dots" />
            <span> Observaciones:</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.9em', color: '#555', lineHeight: 1.5, fontStyle: 'italic' }}>
            {sesion.observaciones}
          </p>
        </div>
      )}

      {/* Progreso/Estado */}
      {sesion.progreso !== undefined && sesion.progreso !== null && (
        <div style={{ margin: '15px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.85em', color: '#666' }}>Progreso del Objetivo:</span>
            <span style={{ fontSize: '0.9em', fontWeight: 'bold', color: progresoColor }}>
              {sesion.progreso}%
            </span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${sesion.progreso}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${progresoColor}, ${progresoColor}dd)`,
                transition: 'width 0.3s'
              }}
            />
          </div>
        </div>
      )}

      {/* Materiales utilizados */}
      {sesion.materiales && sesion.materiales.length > 0 && (
        <div style={{ margin: '12px 0' }}>
          <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '6px' }}>
            <i className="fas fa-box" />
            <span> Materiales utilizados:</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {sesion.materiales.map((material, index) => (
              <span
                key={index}
                style={{
                  background: '#dbeafe',
                  color: '#1e40af',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.8em'
                }}
              >
                {material}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Evidencias (imágenes/archivos adjuntos) */}
      {sesion.evidencias && sesion.evidencias.length > 0 && (
        <div style={{ margin: '12px 0' }}>
          <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>
            <i className="fas fa-paperclip" />
            <span> Evidencias adjuntas:</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {sesion.evidencias.map((evidencia, index) => (
              <a
                key={index}
                href={evidencia.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '0.8em',
                  color: '#374151',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
              >
                <i className={`fas ${getEvidenciaIcon(evidencia.tipo)}`} />
                <span>{evidencia.nombre}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Metadata: Terapeuta */}
      <div style={{
        marginTop: '15px',
        paddingTop: '15px',
        borderTop: '1px solid #eee',
        fontSize: '0.85em',
        color: '#666'
      }}>
        <i className="fas fa-user-md" style={{ color: '#10b981' }} />
        <span> {sesion.terapeuta || 'Fonoaudiólogo'}</span>
      </div>

      {/* Acciones (opcional) */}
      {showActions && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
          {onVerDetalle && (
            <button className="btn btn-sm btn-primary" onClick={handleVerDetalle}>
              <i className="fas fa-eye" />
              <span> Ver Detalle</span>
            </button>
          )}
          {onEditar && (
            <button className="btn btn-sm btn-warning" onClick={handleEditar}>
              <i className="fas fa-edit" />
              <span> Editar</span>
            </button>
          )}
          {onCompartir && (
            <button className="btn btn-sm btn-info" onClick={handleCompartir}>
              <i className="fas fa-share" />
              <span> Compartir</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default SesionCard;
