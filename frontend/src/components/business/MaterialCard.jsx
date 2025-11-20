/**
 * MaterialCard - Componente de tarjeta de material educativo
 *
 * Muestra información de materiales educativos con:
 * - Título y categoría
 * - Badge de estado (pendiente, aprobado, rechazado)
 * - Descripción
 * - Metadata: curso, fecha, autor
 * - Archivo adjunto descargable
 * - Acciones opcionales (ver, aprobar, corregir, rechazar)
 *
 * @component
 * @example
 * ```jsx
 * <MaterialCard
 *   material={{
 *     id: "mat-001",
 *     titulo: "Guía de Lenguaje - Vocales",
 *     descripcion: "Material didáctico...",
 *     categoria: "Lenguaje",
 *     asignatura: "Lenguaje y Comunicación",
 *     curso: "Medio Mayor",
 *     estado: "pendiente",
 *     fechaSubida: "2025-10-20",
 *     creadoPor: "Prof. María González",
 *     archivoUrl: "/uploads/guia.pdf",
 *     archivoNombre: "guia-vocales.pdf",
 *     archivoSize: "2.5 MB"
 *   }}
 *   showActions={true}
 *   onVerDetalle={(material) => console.log('Ver', material)}
 *   onAprobar={(material) => console.log('Aprobar', material)}
 *   onSolicitarCorreccion={(material) => console.log('Corregir', material)}
 *   onRechazar={(material) => console.log('Rechazar', material)}
 * />
 * ```
 */

import React, { useState } from 'react';
import { EstadoBadge } from '../ui/Badge';
import { formatDate } from '../../utils/helpers';

/**
 * @typedef {Object} Material
 * @property {string} id - ID único del material
 * @property {string} titulo - Título del material
 * @property {string} [descripcion] - Descripción del material
 * @property {string} [categoria] - Categoría del material
 * @property {string} [asignatura] - Asignatura del material
 * @property {string} [curso] - Curso al que pertenece
 * @property {string} [estado] - Estado: 'pendiente', 'aprobado', 'rechazado', 'requiere_correccion'
 * @property {string} [fechaSubida] - Fecha de subida (ISO string)
 * @property {string} [creadoPor] - Autor/creador del material
 * @property {string} [archivoUrl] - URL del archivo
 * @property {string} [archivoNombre] - Nombre del archivo
 * @property {string} [archivoSize] - Tamaño del archivo
 */

/**
 * @param {Object} props
 * @param {Material} props.material - Objeto con datos del material
 * @param {boolean} [props.showActions=false] - Mostrar botones de acción
 * @param {Function} [props.onVerDetalle] - Callback al ver detalle (material) => void
 * @param {Function} [props.onAprobar] - Callback al aprobar (material) => void
 * @param {Function} [props.onSolicitarCorreccion] - Callback al solicitar corrección (material) => void
 * @param {Function} [props.onRechazar] - Callback al rechazar (material) => void
 * @param {string} [props.className] - Clases CSS adicionales
 */
export default function MaterialCard({
  material = {},
  showActions = false,
  onVerDetalle,
  onAprobar,
  onSolicitarCorreccion,
  onRechazar,
  className = ''
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`card ${className}`}
      style={{
        padding: '20px',
        borderLeft: '4px solid #667eea',
        transition: 'all 0.3s',
        boxShadow: isHovered
          ? '0 4px 12px rgba(0,0,0,0.15)'
          : '0 2px 4px rgba(0,0,0,0.1)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header: Título + Badge Estado */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <h4 style={{
            margin: '0 0 5px 0',
            color: '#333',
            fontSize: '1.1em'
          }}>
            {material.titulo || 'Material'}
          </h4>
          <div style={{ fontSize: '0.85em', color: '#666' }}>
            <i className="fas fa-folder" />
            <span> {material.categoria || 'Sin categoría'}</span>
            {material.asignatura && (
              <>
                <span> • </span>
                <span>{material.asignatura}</span>
              </>
            )}
          </div>
        </div>

        {/* Badge de Estado */}
        <EstadoBadge estado={material.estado || 'pendiente'} />
      </div>

      {/* Descripción */}
      {material.descripcion && (
        <p style={{
          margin: '10px 0',
          color: '#666',
          fontSize: '0.9em',
          lineHeight: 1.5
        }}>
          {material.descripcion}
        </p>
      )}

      {/* Metadata: Curso, Fecha, Autor */}
      <div style={{
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        marginTop: '15px',
        paddingTop: '15px',
        borderTop: '1px solid #eee',
        fontSize: '0.85em',
        color: '#666'
      }}>
        {material.curso && (
          <div>
            <i className="fas fa-graduation-cap" style={{ color: '#667eea' }} />
            <span> {material.curso}</span>
          </div>
        )}
        {material.fechaSubida && (
          <div>
            <i className="fas fa-calendar" style={{ color: '#667eea' }} />
            <span> {formatDate(material.fechaSubida, 'short')}</span>
          </div>
        )}
        {material.creadoPor && (
          <div>
            <i className="fas fa-user" style={{ color: '#667eea' }} />
            <span> {material.creadoPor}</span>
          </div>
        )}
      </div>

      {/* Archivo adjunto */}
      {material.archivoUrl && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: '#f8f9fa',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <i className="fas fa-file-pdf fa-2x" style={{ color: '#dc3545' }} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: 600,
              fontSize: '0.9em'
            }}>
              {material.archivoNombre || 'documento.pdf'}
            </div>
            <div style={{
              fontSize: '0.8em',
              color: '#666'
            }}>
              {material.archivoSize || '0 KB'}
            </div>
          </div>
          <a
            href={material.archivoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-primary"
            style={{ textDecoration: 'none' }}
          >
            <i className="fas fa-download" /> Descargar
          </a>
        </div>
      )}

      {/* Acciones (solo si showActions = true) */}
      {showActions && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '15px'
        }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onVerDetalle && onVerDetalle(material)}
          >
            <i className="fas fa-eye" /> Ver
          </button>
          {material.estado === 'pendiente' && (
            <>
              <button
                className="btn btn-sm btn-success"
                onClick={() => onAprobar && onAprobar(material)}
              >
                <i className="fas fa-check" /> Aprobar
              </button>
              <button
                className="btn btn-sm btn-warning"
                onClick={() => onSolicitarCorreccion && onSolicitarCorreccion(material)}
              >
                <i className="fas fa-edit" /> Corregir
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => onRechazar && onRechazar(material)}
              >
                <i className="fas fa-times" /> Rechazar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
