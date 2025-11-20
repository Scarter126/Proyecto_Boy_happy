/**
 * EvaluacionCard Component - Boy Happy
 *
 * Card de evaluación fonoaudiológica con resultados y estado.
 * Muestra áreas evaluadas, puntajes, progreso y observaciones.
 *
 * Usado en: fono evaluaciones, admin supervisión, profesor consulta
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/helpers';

/**
 * EvaluacionCard - Card de evaluación con progreso y estado
 *
 * @param {Object} props
 * @param {Object} props.evaluacion - Datos de la evaluación
 * @param {string} props.evaluacion.id - ID de la evaluación
 * @param {string} props.evaluacion.nombreAlumno - Nombre del alumno evaluado
 * @param {string} props.evaluacion.rutAlumno - RUT del alumno
 * @param {string} props.evaluacion.tipoEvaluacion - Tipo de evaluación
 * @param {Array<string>} props.evaluacion.areas - Áreas evaluadas
 * @param {number} props.evaluacion.puntaje - Puntaje obtenido
 * @param {number} props.evaluacion.puntajeMaximo - Puntaje máximo posible
 * @param {string} props.evaluacion.estado - Estado: 'completada', 'en_proceso', 'pendiente'
 * @param {string} props.evaluacion.observaciones - Observaciones del evaluador
 * @param {string} props.evaluacion.fecha - Fecha de evaluación (ISO)
 * @param {string} props.evaluacion.evaluador - Nombre del evaluador
 * @param {number} props.evaluacion.duracion - Duración en minutos
 * @param {string} props.evaluacion.pdfUrl - URL del reporte PDF
 * @param {boolean} props.showActions - Mostrar botones de acciones (default: false)
 * @param {Function} props.onVerDetalle - Callback para ver detalle
 * @param {Function} props.onCompletar - Callback para completar evaluación
 * @param {Function} props.onEditar - Callback para editar evaluación
 * @param {string} props.className - Clases CSS adicionales
 */
export function EvaluacionCard({
  evaluacion = {},
  showActions = false,
  onVerDetalle,
  onCompletar,
  onEditar,
  className = '',
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Configuración de estado
  const estadoConfig = useMemo(() => {
    const configs = {
      completada: {
        bg: '#d1fae5',
        color: '#065f46',
        text: 'Completada'
      },
      en_proceso: {
        bg: '#fef3c7',
        color: '#92400e',
        text: 'En Proceso'
      },
      pendiente: {
        bg: '#fee2e2',
        color: '#991b1b',
        text: 'Pendiente'
      }
    };
    return configs[evaluacion.estado] || configs.pendiente;
  }, [evaluacion.estado]);

  // Calcular porcentaje de progreso
  const porcentajeProgreso = useMemo(() => {
    if (!evaluacion.puntajeMaximo || !evaluacion.puntaje) return 0;
    return (evaluacion.puntaje / evaluacion.puntajeMaximo) * 100;
  }, [evaluacion.puntaje, evaluacion.puntajeMaximo]);

  // Estilo de la card con hover
  const cardStyle = useMemo(() => ({
    padding: '20px',
    borderLeft: '4px solid #8b5cf6',
    transition: 'all 0.3s',
    ...(isHovered && {
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    })
  }), [isHovered]);

  // Handler para acciones
  const handleAction = (callback) => (e) => {
    if (callback) {
      callback(evaluacion);
    }
  };

  // Abrir PDF en nueva pestaña
  const handleOpenPdf = () => {
    if (evaluacion.pdfUrl) {
      window.open(evaluacion.pdfUrl, '_blank');
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
      {/* Header: Alumno + Tipo de Evaluación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '1.1em' }}>
            <i className="fas fa-user" style={{ color: '#8b5cf6' }} />
            <span> {evaluacion.nombreAlumno || 'Alumno'}</span>
          </h4>
          <div style={{ fontSize: '0.85em', color: '#666' }}>
            <i className="fas fa-stethoscope" />
            <span> {evaluacion.tipoEvaluacion || 'Evaluación Fonoaudiológica'}</span>
          </div>
        </div>

        {/* Estado de la evaluación */}
        {evaluacion.estado && (
          <span style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.8em',
            fontWeight: 600,
            background: estadoConfig.bg,
            color: estadoConfig.color
          }}>
            {estadoConfig.text}
          </span>
        )}
      </div>

      {/* Áreas Evaluadas */}
      {evaluacion.areas && evaluacion.areas.length > 0 && (
        <div style={{ margin: '15px 0' }}>
          <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>
            <i className="fas fa-list-check" /> Áreas Evaluadas:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {evaluacion.areas.map((area, index) => (
              <span
                key={index}
                style={{
                  background: '#ede9fe',
                  color: '#6b21a8',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '0.8em'
                }}
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Resultados/Puntajes */}
      {evaluacion.puntaje !== undefined && (
        <div style={{ margin: '15px 0', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9em', color: '#666' }}>Puntaje Total:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.3em', fontWeight: 'bold', color: '#8b5cf6' }}>
                {evaluacion.puntaje}
              </span>
              <span style={{ fontSize: '0.85em', color: '#999' }}>
                / {evaluacion.puntajeMaximo || 100}
              </span>
            </div>
          </div>

          {/* Barra de progreso */}
          {evaluacion.puntajeMaximo && (
            <div style={{ marginTop: '8px', width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${porcentajeProgreso}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
                transition: 'width 0.3s'
              }} />
            </div>
          )}
        </div>
      )}

      {/* Observaciones */}
      {evaluacion.observaciones && (
        <div style={{ margin: '12px 0' }}>
          <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '5px' }}>
            <i className="fas fa-comment-dots" /> Observaciones:
          </div>
          <p style={{ margin: 0, fontSize: '0.9em', color: '#555', lineHeight: 1.5, fontStyle: 'italic' }}>
            {evaluacion.observaciones}
          </p>
        </div>
      )}

      {/* Metadata: Fecha, Evaluador, Duración */}
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
        {evaluacion.fecha && (
          <div>
            <i className="fas fa-calendar" style={{ color: '#8b5cf6' }} />
            <span> {formatDate(evaluacion.fecha, 'short')}</span>
          </div>
        )}
        {evaluacion.evaluador && (
          <div>
            <i className="fas fa-user-md" style={{ color: '#8b5cf6' }} />
            <span> {evaluacion.evaluador}</span>
          </div>
        )}
        {evaluacion.duracion && (
          <div>
            <i className="fas fa-clock" style={{ color: '#8b5cf6' }} />
            <span> {evaluacion.duracion} min</span>
          </div>
        )}
      </div>

      {/* Acciones (opcional) */}
      {showActions && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleAction(onVerDetalle)}
          >
            <i className="fas fa-eye" /> Ver Detalle
          </button>
          {evaluacion.estado !== 'completada' && (
            <button
              className="btn btn-sm btn-success"
              onClick={handleAction(onCompletar)}
            >
              <i className="fas fa-check" /> Completar
            </button>
          )}
          <button
            className="btn btn-sm btn-warning"
            onClick={handleAction(onEditar)}
          >
            <i className="fas fa-edit" /> Editar
          </button>
          {evaluacion.pdfUrl && (
            <button
              className="btn btn-sm btn-info"
              onClick={handleOpenPdf}
            >
              <i className="fas fa-file-pdf" /> PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default EvaluacionCard;
