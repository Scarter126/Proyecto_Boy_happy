/**
 * Badge Components - Boy Happy
 *
 * Componentes React para badges con diferentes variantes y estilos.
 * Reemplazan las funciones renderBadge del sistema Alpine.js
 */

import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Badge Component - Base
 *
 * @param {Object} props
 * @param {string} props.variant - Variante: 'default', 'success', 'warning', 'danger', 'info'
 * @param {string} props.size - Tamaño: 'sm', 'md', 'lg'
 * @param {string} props.className - Clases CSS adicionales
 * @param {React.ReactNode} props.children - Contenido del badge
 */
export function Badge({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  const baseClasses = 'badge';
  const variantClasses = `badge-${variant}`;
  const sizeClasses = `badge-${size}`;

  return (
    <span
      className={cn(baseClasses, variantClasses, sizeClasses, className)}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * EstadoBadge - Badge para estados de matrícula, materiales, etc.
 *
 * @param {Object} props
 * @param {string} props.estado - Estado: 'pendiente', 'aprobada', 'rechazada', 'aprobado', 'rechazado', 'requiere_correccion'
 * @param {string} props.texto - Texto personalizado (opcional)
 * @param {string} props.className - Clases CSS adicionales
 */
export function EstadoBadge({
  estado,
  texto = null,
  className = '',
  ...props
}) {
  const variantMap = {
    'pendiente': 'warning',
    'aprobada': 'success',
    'rechazada': 'danger',
    'aprobado': 'success',
    'rechazado': 'danger',
    'requiere_correccion': 'info'
  };

  const textoMap = {
    'pendiente': 'Pendiente',
    'aprobada': 'Aprobada',
    'rechazada': 'Rechazada',
    'aprobado': 'Aprobado',
    'rechazado': 'Rechazado',
    'requiere_correccion': 'Requiere Corrección'
  };

  const variant = variantMap[estado] || 'default';
  const displayText = texto || textoMap[estado] || estado;

  return (
    <Badge
      variant={variant}
      size="sm"
      className={className}
      {...props}
    >
      {displayText}
    </Badge>
  );
}

/**
 * RolBadge - Badge para roles de usuario
 *
 * @param {Object} props
 * @param {string} props.rol - Rol: 'admin', 'profesor', 'alumno', 'apoderado', 'fono'
 * @param {string} props.texto - Texto personalizado (opcional)
 * @param {string} props.className - Clases CSS adicionales
 */
export function RolBadge({
  rol,
  texto = null,
  className = '',
  ...props
}) {
  const textoMap = {
    'admin': 'Administrador',
    'profesor': 'Profesor',
    'alumno': 'Alumno',
    'apoderado': 'Apoderado',
    'fono': 'Fonoaudiólogo'
  };

  const displayText = texto || textoMap[rol] || rol;
  const classes = cn('badge-rol', rol, className);

  return (
    <span className={classes} {...props}>
      {displayText}
    </span>
  );
}

/**
 * ActivoBadge - Badge para estado activo/inactivo
 *
 * @param {Object} props
 * @param {boolean} props.activo - Estado activo (true/false)
 * @param {string} props.className - Clases CSS adicionales
 */
export function ActivoBadge({
  activo,
  className = '',
  ...props
}) {
  const classes = cn(activo ? 'badge-activo' : 'badge-inactivo', className);
  const texto = activo ? 'Activo' : 'Inactivo';

  return (
    <span className={classes} {...props}>
      {texto}
    </span>
  );
}

/**
 * NivelBadge - Badge para niveles de evaluación
 *
 * @param {Object} props
 * @param {string} props.nivel - Nivel: 'logrado', 'no-logrado', 'en-desarrollo', 'no-trabajado'
 * @param {string} props.texto - Texto personalizado (opcional)
 * @param {string} props.className - Clases CSS adicionales
 */
export function NivelBadge({
  nivel,
  texto = null,
  className = '',
  ...props
}) {
  const textoMap = {
    'logrado': 'Logrado',
    'no-logrado': 'No Logrado',
    'en-desarrollo': 'En Desarrollo',
    'no-trabajado': 'No Trabajado'
  };

  const displayText = texto || textoMap[nivel] || nivel;
  const classes = cn('nivel-badge', nivel, className);

  return (
    <span className={classes} {...props}>
      {displayText}
    </span>
  );
}

/**
 * AsistenciaBadge - Badge para estados de asistencia
 *
 * @param {Object} props
 * @param {string} props.estado - Estado: 'presente', 'ausente', 'atrasado'
 * @param {string} props.texto - Texto personalizado (opcional)
 * @param {string} props.className - Clases CSS adicionales
 */
export function AsistenciaBadge({
  estado,
  texto = null,
  className = '',
  ...props
}) {
  const textoMap = {
    'presente': 'Presente',
    'ausente': 'Ausente',
    'atrasado': 'Atrasado'
  };

  const displayText = texto || textoMap[estado] || estado;
  const classes = cn(`badge-${estado}`, className);

  return (
    <span className={classes} {...props}>
      {displayText}
    </span>
  );
}

/**
 * CursoBadge - Badge para cursos (usado en timeline)
 *
 * @param {Object} props
 * @param {string} props.curso - Nombre del curso
 * @param {React.ReactNode} props.icon - Icono opcional
 * @param {string} props.className - Clases CSS adicionales
 */
export function CursoBadge({
  curso,
  icon = null,
  className = '',
  ...props
}) {
  const classes = cn('curso-badge', className);

  return (
    <span className={classes} {...props}>
      {icon && <i className={icon} />}
      {curso}
    </span>
  );
}

/**
 * TimelineBadge - Badge para tipos de retroalimentación
 *
 * @param {Object} props
 * @param {string} props.tipo - Tipo: 'felicitacion', 'sugerencia', 'preocupacion', 'logro', 'recomendacion'
 * @param {string} props.texto - Texto personalizado (opcional)
 * @param {string} props.className - Clases CSS adicionales
 */
export function TimelineBadge({
  tipo,
  texto = null,
  className = '',
  ...props
}) {
  const textoMap = {
    'felicitacion': 'Felicitación',
    'sugerencia': 'Sugerencia',
    'preocupacion': 'Preocupación',
    'logro': 'Logro',
    'recomendacion': 'Recomendación'
  };

  const displayText = texto || textoMap[tipo] || tipo;
  const classes = cn('timeline-badge', tipo, className);

  return (
    <span className={classes} {...props}>
      {displayText}
    </span>
  );
}

/**
 * AmbitoBadge - Badge para ámbitos (usado en timeline)
 *
 * @param {Object} props
 * @param {string} props.ambito - Nombre del ámbito
 * @param {React.ReactNode} props.icon - Icono opcional
 * @param {string} props.className - Clases CSS adicionales
 */
export function AmbitoBadge({
  ambito,
  icon = null,
  className = '',
  ...props
}) {
  const classes = cn('timeline-ambito', className);

  return (
    <span className={classes} {...props}>
      {icon && <i className={icon} />}
      {ambito}
    </span>
  );
}

/**
 * VisibilidadBadge - Badge para visibilidad (pública/privada)
 *
 * @param {Object} props
 * @param {string} props.visibilidad - Visibilidad: 'publica', 'privada'
 * @param {string} props.texto - Texto personalizado (opcional)
 * @param {React.ReactNode} props.icon - Icono opcional
 * @param {string} props.className - Clases CSS adicionales
 */
export function VisibilidadBadge({
  visibilidad,
  texto = null,
  icon = null,
  className = '',
  ...props
}) {
  const textoMap = {
    'publica': 'Pública',
    'privada': 'Privada'
  };

  const displayText = texto || textoMap[visibilidad] || visibilidad;
  const classes = cn('timeline-visibilidad', visibilidad, className);

  return (
    <span className={classes} {...props}>
      {icon && <i className={icon} />}
      {displayText}
    </span>
  );
}

// Export all components
export default {
  Badge,
  EstadoBadge,
  RolBadge,
  ActivoBadge,
  NivelBadge,
  AsistenciaBadge,
  CursoBadge,
  TimelineBadge,
  AmbitoBadge,
  VisibilidadBadge
};
