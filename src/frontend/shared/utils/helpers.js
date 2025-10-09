/**
 * Helpers - Funciones de Utilidad Puras
 *
 * Responsabilidad ÚNICA:
 * - Formatters (fecha, RUT, teléfono, etc.)
 * - Validadores
 * - Helpers generales
 *
 * NO maneja:
 * - Estado (eso es de store/)
 * - Peticiones HTTP (eso es de http-client/)
 * - Autenticación (eso es de utils/auth.js)
 */

// ==========================================
// FORMATTERS
// ==========================================

/**
 * Formatear fecha
 * @param {string|Date} date - Fecha a formatear
 * @param {string} format - Formato: 'short', 'long', 'time', 'iso'
 * @returns {string} Fecha formateada
 */
function formatDate(date, format = 'short') {
  if (!date) return '-';
  const d = new Date(date);

  if (format === 'short') {
    return d.toLocaleDateString('es-CL');
  } else if (format === 'long') {
    return d.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } else if (format === 'time') {
    return d.toLocaleString('es-CL');
  } else if (format === 'iso') {
    return d.toISOString().split('T')[0];
  }
  return d.toLocaleDateString('es-CL');
}

/**
 * Formatear RUT chileno
 * @param {string} rut - RUT a formatear
 * @returns {string} RUT formateado (12.345.678-9)
 */
function formatRut(rut) {
  if (!rut) return '-';
  const clean = rut.replace(/[^0-9kK]/g, '');
  if (clean.length < 2) return rut;

  const dv = clean.slice(-1);
  const nums = clean.slice(0, -1);
  const formatted = nums.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${formatted}-${dv}`;
}

/**
 * Formatear teléfono chileno
 * @param {string} telefono - Teléfono a formatear
 * @returns {string} Teléfono formateado
 */
function formatTelefono(telefono) {
  if (!telefono) return '-';
  const clean = telefono.replace(/\D/g, '');

  // Formato: +56 9 1234 5678
  if (clean.startsWith('569') && clean.length === 11) {
    return `+56 9 ${clean.slice(3, 7)} ${clean.slice(7)}`;
  }
  // Formato: 9 1234 5678
  if (clean.startsWith('9') && clean.length === 9) {
    return `9 ${clean.slice(1, 5)} ${clean.slice(5)}`;
  }
  return telefono;
}

/**
 * Formatear nombre completo
 * @param {object|string} persona - Objeto con nombre y apellido o string
 * @returns {string} Nombre formateado
 */
function formatNombre(persona) {
  if (!persona) return '-';
  if (typeof persona === 'string') return persona;
  return `${persona.nombre || ''} ${persona.apellido || ''}`.trim() || '-';
}

// ==========================================
// VALIDADORES
// ==========================================

/**
 * Validar RUT chileno
 * @param {string} rut - RUT a validar
 * @returns {boolean} true si es válido
 */
function validateRut(rut) {
  if (!rut) return false;
  const clean = rut.replace(/[^0-9kK]/g, '');
  if (clean.length < 2) return false;

  const dv = clean.slice(-1).toUpperCase();
  const nums = clean.slice(0, -1);

  let suma = 0;
  let multiplo = 2;

  for (let i = nums.length - 1; i >= 0; i--) {
    suma += parseInt(nums[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = suma % 11;
  const dvEsperado = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto);

  return dv === dvEsperado;
}

/**
 * Validar email
 * @param {string} email - Email a validar
 * @returns {boolean} true si es válido
 */
function validateEmail(email) {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validar teléfono chileno
 * @param {string} telefono - Teléfono a validar
 * @returns {boolean} true si es válido
 */
function validateTelefono(telefono) {
  if (!telefono) return false;
  const clean = telefono.replace(/\D/g, '');
  // Validar formato chileno: 9 dígitos empezando con 9
  return clean.length === 9 && clean.startsWith('9');
}

// ==========================================
// HELPERS GENERALES
// ==========================================

/**
 * Calcular edad desde fecha de nacimiento
 * @param {string|Date} fechaNacimiento - Fecha de nacimiento
 * @returns {number|null} Edad en años
 */
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

/**
 * Obtener iniciales de un nombre
 * @param {string} nombre - Nombre completo
 * @returns {string} Iniciales (ej: "JP")
 */
function getIniciales(nombre) {
  if (!nombre) return '?';
  const palabras = nombre.trim().split(' ');
  if (palabras.length >= 2) {
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }
  return nombre.substring(0, 2).toUpperCase();
}

/**
 * Capitalizar primera letra
 * @param {string} str - String a capitalizar
 * @returns {string} String capitalizado
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncar texto
 * @param {string} str - Texto a truncar
 * @param {number} length - Longitud máxima
 * @returns {string} Texto truncado
 */
function truncate(str, length = 50) {
  if (!str || str.length <= length) return str;
  return str.substring(0, length) + '...';
}

/**
 * Debounce - Retrasar ejecución de función
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función con debounce
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Copiar texto al portapapeles
 * @param {string} text - Texto a copiar
 */
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      if (window.Notify) {
        Notify.success('Copiado al portapapeles');
      }
    });
  } else {
    // Fallback para navegadores antiguos
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    if (window.Notify) {
      Notify.success('Copiado al portapapeles');
    }
  }
}

/**
 * Descargar objeto como JSON
 * @param {object} data - Datos a descargar
 * @param {string} filename - Nombre del archivo
 */
function downloadJSON(data, filename = 'data.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================
// EXPORTAR AL SCOPE GLOBAL
// ==========================================

window.Helpers = {
  // Formatters
  formatDate,
  formatRut,
  formatTelefono,
  formatNombre,

  // Validadores
  validateRut,
  validateEmail,
  validateTelefono,

  // Helpers
  calcularEdad,
  getIniciales,
  capitalize,
  truncate,
  debounce,
  copyToClipboard,
  downloadJSON
};

// Alias para uso en Alpine templates
if (typeof Alpine !== 'undefined') {
  Alpine.magic('helpers', () => window.Helpers);
}

console.log('✅ utils/helpers.js cargado');
