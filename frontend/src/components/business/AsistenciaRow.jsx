/**
 * AsistenciaRow - Componente de fila de registro de asistencia
 *
 * Fila interactiva para registrar la asistencia diaria de un alumno:
 * - Avatar del alumno con iniciales
 * - Información del alumno (nombre, RUT)
 * - Botones de estado: Presente, Ausente, Tarde, Justificado
 * - Indicador visual de estado
 * - Botón para agregar observaciones
 * - Fondo dinámico según estado
 *
 * @component
 * @example
 * ```jsx
 * <AsistenciaRow
 *   alumno={{
 *     rut: "12345678-9",
 *     nombre: "Sofía Pérez",
 *     genero: "F",
 *     estadoAsistencia: "pendiente"
 *   }}
 *   onEstadoChange={(alumno, estado) => console.log(alumno, estado)}
 *   onAgregarObservacion={(alumno) => console.log('Agregar observación', alumno)}
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';

/**
 * @typedef {Object} Alumno
 * @property {string} rut - RUT del alumno
 * @property {string} nombre - Nombre completo del alumno
 * @property {string} [genero] - Género del alumno ('M' o 'F')
 * @property {string} [estadoAsistencia] - Estado inicial: 'presente', 'ausente', 'tarde', 'justificado', 'pendiente'
 */

/**
 * Obtener configuración de estado de asistencia
 * @param {string} estado - Estado de asistencia
 * @returns {Object} Configuración de colores
 */
const getEstadoConfig = (estado) => {
  const configs = {
    presente: {
      bg: '#f0fdf4',
      border: '#10b981',
      indicator: '#10b981'
    },
    ausente: {
      bg: '#fef2f2',
      border: '#ef4444',
      indicator: '#ef4444'
    },
    tarde: {
      bg: '#fef3c7',
      border: '#d97706',
      indicator: '#d97706'
    },
    justificado: {
      bg: '#fffbeb',
      border: '#f59e0b',
      indicator: '#f59e0b'
    },
    pendiente: {
      bg: 'white',
      border: '#e2e8f0',
      indicator: '#cbd5e1'
    }
  };
  return configs[estado] || configs.pendiente;
};

/**
 * @param {Object} props
 * @param {Alumno} props.alumno - Objeto con datos del alumno
 * @param {Function} [props.onEstadoChange] - Callback al cambiar estado (alumno, nuevoEstado) => void
 * @param {Function} [props.onAgregarObservacion] - Callback al agregar observación (alumno) => void
 * @param {string} [props.className] - Clases CSS adicionales
 */
export default function AsistenciaRow({
  alumno = {},
  onEstadoChange,
  onAgregarObservacion,
  className = ''
}) {
  const [estado, setEstado] = useState(alumno.estadoAsistencia || 'pendiente');
  const [isHovered, setIsHovered] = useState(false);

  // Sincronizar estado local cuando cambie el prop desde el padre
  useEffect(() => {
    setEstado(alumno.estadoAsistencia || 'pendiente');
  }, [alumno.estadoAsistencia]);

  const handleEstadoChange = (nuevoEstado) => {
    setEstado(nuevoEstado);
    if (onEstadoChange) {
      onEstadoChange(alumno, nuevoEstado);
    }
  };

  const estadoConfig = getEstadoConfig(estado);
  const avatarGradient = alumno.genero === 'F'
    ? 'linear-gradient(135deg, #ec4899, #f472b6)'
    : 'linear-gradient(135deg, #3b82f6, #60a5fa)';

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        padding: '12px',
        background: estadoConfig.bg,
        borderRadius: '8px',
        border: `1px solid ${estadoConfig.border}`,
        transition: 'all 0.2s',
        boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar pequeño */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: avatarGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '1em',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {alumno.nombre ? alumno.nombre.charAt(0).toUpperCase() : 'A'}
      </div>

      {/* Nombre del Alumno */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600,
          color: '#1e293b',
          fontSize: '0.95em'
        }}>
          {alumno.nombre || 'Alumno'}
        </div>
        <div style={{
          fontSize: '0.8em',
          color: '#64748b',
          marginTop: '2px'
        }}>
          <i className="fas fa-id-card" />
          <span> {alumno.rut || 'Sin RUT'}</span>
        </div>
      </div>

      {/* Botones de Estado */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* Presente */}
        <button
          onClick={() => handleEstadoChange('presente')}
          className={`btn btn-sm ${estado === 'presente' ? 'btn-success' : 'btn-outline-success'}`}
          style={{ minWidth: '90px' }}
        >
          <i className="fas fa-check-circle" /> Presente
        </button>

        {/* Ausente */}
        <button
          onClick={() => handleEstadoChange('ausente')}
          className={`btn btn-sm ${estado === 'ausente' ? 'btn-danger' : 'btn-outline-danger'}`}
          style={{ minWidth: '90px' }}
        >
          <i className="fas fa-times-circle" /> Ausente
        </button>

        {/* Tarde */}
        <button
          onClick={() => handleEstadoChange('tarde')}
          className={`btn btn-sm ${estado === 'tarde' ? 'btn-secondary' : 'btn-outline-secondary'}`}
          style={{ minWidth: '80px', backgroundColor: estado === 'tarde' ? '#d97706' : undefined, borderColor: estado === 'tarde' ? '#d97706' : '#d97706', color: estado === 'tarde' ? 'white' : '#d97706' }}
        >
          <i className="fas fa-clock" /> Tarde
        </button>

        {/* Justificado */}
        <button
          onClick={() => handleEstadoChange('justificado')}
          className={`btn btn-sm ${estado === 'justificado' ? 'btn-warning' : 'btn-outline-warning'}`}
          style={{ minWidth: '100px' }}
        >
          <i className="fas fa-file-medical" /> Justificado
        </button>
      </div>

      {/* Indicador Visual de Estado */}
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: estadoConfig.indicator
      }} />

      {/* Botón de Observación */}
      <button
        className="btn btn-sm btn-outline-secondary"
        onClick={() => onAgregarObservacion && onAgregarObservacion(alumno)}
      >
        <i className="fas fa-comment" />
      </button>
    </div>
  );
}
