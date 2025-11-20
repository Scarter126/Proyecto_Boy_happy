/**
 * CursoCard - Componente de tarjeta de curso
 *
 * Muestra información visual de un curso con:
 * - Nombre del curso con color temático
 * - Semáforo de estado
 * - Métricas: Número de alumnos y porcentaje de asistencia
 * - Progreso de materiales publicados
 * - Registros de asistencia
 * - Efectos hover interactivos
 *
 * @component
 * @example
 * ```jsx
 * <CursoCard
 *   curso={{
 *     nombre: "Medio Mayor",
 *     alumnos: 25,
 *     asistencia: "92%",
 *     materialesPublicados: 8,
 *     materialesTotal: 10,
 *     semaforoColor: "#4caf50",
 *     registrosAsistencia: 120
 *   }}
 *   colorIndex={0}
 *   onClick={() => console.log('Curso clicked')}
 * />
 * ```
 */

import React, { useState } from 'react';

/**
 * @typedef {Object} Curso
 * @property {string} nombre - Nombre del curso
 * @property {number} alumnos - Número de alumnos
 * @property {string} asistencia - Porcentaje de asistencia (ej: "92%")
 * @property {number} [materialesPublicados] - Materiales publicados
 * @property {number} [materialesTotal] - Total de materiales
 * @property {string} [semaforoColor] - Color del semáforo (#hex)
 * @property {number} [registrosAsistencia] - Número de registros de asistencia
 */

/**
 * Obtener color del curso según índice
 * @param {number} index - Índice del color
 * @returns {string} Color hex
 */
const getCursoColor = (index) => {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16'  // lime
  ];
  return colors[index % colors.length];
};

/**
 * @param {Object} props
 * @param {Curso} props.curso - Objeto con datos del curso
 * @param {number} [props.colorIndex=0] - Índice para color temático
 * @param {Function} [props.onClick] - Callback al hacer click en la tarjeta
 * @param {string} [props.className] - Clases CSS adicionales
 */
export default function CursoCard({
  curso = {},
  colorIndex = 0,
  onClick,
  className = ''
}) {
  const [isHovered, setIsHovered] = useState(false);
  const cursoColor = getCursoColor(colorIndex);

  return (
    <div
      className={`card ${className}`}
      style={{
        background: 'white',
        border: `3px solid ${cursoColor}`,
        color: '#333',
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s',
        boxShadow: isHovered
          ? '0 8px 16px rgba(0,0,0,0.15)'
          : '0 4px 6px rgba(0,0,0,0.1)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Nombre del curso con semáforo */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <h4 style={{
          margin: 0,
          color: cursoColor,
          fontWeight: 600
        }}>
          {curso.nombre || 'Curso'}
        </h4>
        <div
          className="semaphore-light active"
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: curso.semaforoColor || '#ddd',
            boxShadow: `0 0 8px ${curso.semaforoColor || '#ddd'}`
          }}
        />
      </div>

      {/* Métricas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '15px'
      }}>
        {/* Alumnos */}
        <div>
          <div style={{
            fontSize: '0.85em',
            color: '#666',
            marginBottom: '4px'
          }}>
            <i className="fas fa-users" style={{ color: cursoColor }} /> Alumnos
          </div>
          <div style={{
            fontSize: '1.6em',
            fontWeight: 'bold',
            color: cursoColor
          }}>
            {curso.alumnos || 0}
          </div>
        </div>

        {/* Asistencia */}
        <div>
          <div style={{
            fontSize: '0.85em',
            color: '#666',
            marginBottom: '4px'
          }}>
            <i className="fas fa-calendar-check" style={{ color: cursoColor }} /> Asistencia
          </div>
          <div style={{
            fontSize: '1.6em',
            fontWeight: 'bold',
            color: cursoColor
          }}>
            {curso.asistencia || '0%'}
          </div>
        </div>
      </div>

      {/* Materiales */}
      <div style={{
        marginTop: '15px',
        paddingTop: '15px',
        borderTop: `2px solid ${cursoColor}33`
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.85em', color: '#666' }}>
            <i className="fas fa-book" style={{ color: cursoColor }} /> Materiales publicados
          </span>
          <span style={{
            fontSize: '1.1em',
            fontWeight: 'bold',
            color: cursoColor
          }}>
            {curso.materialesPublicados || 0}/{curso.materialesTotal || 0}
          </span>
        </div>
      </div>

      {/* Detalle de registros */}
      <div style={{
        marginTop: '10px',
        fontSize: '0.75em',
        color: '#999',
        textAlign: 'right'
      }}>
        {curso.registrosAsistencia || 0} registros
      </div>
    </div>
  );
}
