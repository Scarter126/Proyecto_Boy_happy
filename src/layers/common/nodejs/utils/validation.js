/**
 * Utilidades de validación compartidas
 */

/**
 * Validar RUT chileno
 */
function validarRUT(rut) {
  if (!rut || typeof rut !== 'string') return false;

  const rutLimpio = rut.replace(/[.-]/g, '');
  if (!/^\d{7,8}[\dkK]$/.test(rutLimpio)) return false;

  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1).toLowerCase();

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const dvCalculado = 11 - (suma % 11);
  const dvFinal = dvCalculado === 11 ? '0' : dvCalculado === 10 ? 'k' : dvCalculado.toString();

  return dv === dvFinal;
}

/**
 * Validar email
 */
function validarEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validar teléfono chileno
 */
function validarTelefono(telefono) {
  if (!telefono || typeof telefono !== 'string') return false;
  return /^\+?56?9\d{8}$/.test(telefono.replace(/\s/g, ''));
}

/**
 * Validar fecha ISO
 */
function validarFecha(fecha) {
  if (!fecha) return false;
  const timestamp = Date.parse(fecha);
  return !isNaN(timestamp);
}

/**
 * Validar campos requeridos
 */
function validarCamposRequeridos(obj, campos) {
  const faltantes = campos.filter(campo => !obj[campo]);

  if (faltantes.length > 0) {
    return {
      valido: false,
      error: `Faltan campos requeridos: ${faltantes.join(', ')}`,
    };
  }

  return { valido: true };
}

module.exports = {
  validarRUT,
  validarEmail,
  validarTelefono,
  validarFecha,
  validarCamposRequeridos,
};
