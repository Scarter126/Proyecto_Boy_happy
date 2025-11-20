/**
 * evaluacionHelper.js
 *
 * Helper para manejo de evaluaciones conceptuales (educación parvularia)
 * Sistema de logros: L (Logrado), OD (Objetivo en Desarrollo), NL (No Logrado), NT (No Trabajado)
 */

// Mapeo de nivel conceptual a valor numérico (escala chilena 1.0-7.0)
const NIVEL_A_NOTA = {
  'L': 7.0,   // Logrado = Excelente (nota máxima)
  'OD': 5.0,  // Objetivo en Desarrollo = Bueno (nota media)
  'NL': 3.0,  // No Logrado = Deficiente (bajo nota mínima)
  'NT': 0     // No Trabajado = Sin evaluar (excluir del promedio)
};

// Mapeo inverso: de nota numérica a nivel conceptual
const NOTA_A_NIVEL = {
  rango: (nota) => {
    if (nota >= 6.0) return 'L';
    if (nota >= 4.0) return 'OD';
    if (nota >= 1.0) return 'NL';
    return 'NT';
  }
};

// Niveles válidos
const NIVELES_VALIDOS = ['L', 'NL', 'OD', 'NT'];

/**
 * Convierte un nivel conceptual a su equivalente numérico
 * @param {string} nivelLogro - Nivel de logro (L, OD, NL, NT)
 * @returns {number} Valor numérico equivalente (0-7.0)
 */
function nivelANota(nivelLogro) {
  if (!nivelLogro || !NIVELES_VALIDOS.includes(nivelLogro)) {
    console.warn(`Nivel de logro inválido: ${nivelLogro}. Se asume 'NT'.`);
    return 0;
  }
  return NIVEL_A_NOTA[nivelLogro];
}

/**
 * Convierte una nota numérica a su nivel conceptual más cercano
 * @param {number} nota - Nota numérica (1.0-7.0)
 * @returns {string} Nivel de logro (L, OD, NL, NT)
 */
function notaANivel(nota) {
  return NOTA_A_NIVEL.rango(parseFloat(nota) || 0);
}

/**
 * Calcula el promedio de un conjunto de evaluaciones conceptuales
 * @param {Array} notas - Array de objetos de notas con campo nivelLogro
 * @returns {number} Promedio numérico (0-7.0)
 */
function calcularPromedioConceptual(notas) {
  if (!Array.isArray(notas) || notas.length === 0) {
    return 0;
  }

  // Filtrar notas válidas (excluir NT - No Trabajado)
  const notasValidas = notas.filter(nota =>
    nota && nota.nivelLogro && nota.nivelLogro !== 'NT'
  );

  if (notasValidas.length === 0) {
    return 0;
  }

  // Convertir niveles a valores numéricos y sumar
  const suma = notasValidas.reduce((total, nota) => {
    return total + nivelANota(nota.nivelLogro);
  }, 0);

  // Calcular promedio
  return parseFloat((suma / notasValidas.length).toFixed(1));
}

/**
 * Calcula estadísticas detalladas de evaluaciones conceptuales
 * @param {Array} notas - Array de objetos de notas con campo nivelLogro
 * @returns {Object} Estadísticas detalladas
 */
function calcularEstadisticasConceptuales(notas) {
  if (!Array.isArray(notas) || notas.length === 0) {
    return {
      total: 0,
      promedio: 0,
      logrados: 0,
      enDesarrollo: 0,
      noLogrados: 0,
      noTrabajados: 0,
      tasaLogro: 0,
      distribucion: { L: 0, OD: 0, NL: 0, NT: 0 }
    };
  }

  const distribucion = {
    L: notas.filter(n => n.nivelLogro === 'L').length,
    OD: notas.filter(n => n.nivelLogro === 'OD').length,
    NL: notas.filter(n => n.nivelLogro === 'NL').length,
    NT: notas.filter(n => n.nivelLogro === 'NT').length
  };

  const notasValidas = notas.filter(n => n.nivelLogro !== 'NT');
  const tasaLogro = notasValidas.length > 0
    ? parseFloat((distribucion.L / notasValidas.length * 100).toFixed(1))
    : 0;

  return {
    total: notas.length,
    promedio: calcularPromedioConceptual(notas),
    logrados: distribucion.L,
    enDesarrollo: distribucion.OD,
    noLogrados: distribucion.NL,
    noTrabajados: distribucion.NT,
    tasaLogro,
    distribucion
  };
}

/**
 * Determina el nivel de desempeño según el promedio
 * @param {number} promedio - Promedio numérico (0-7.0)
 * @returns {string} Nivel de desempeño (excelente, bueno, regular, deficiente)
 */
function determinarNivelDesempeno(promedio) {
  if (promedio >= 6.0) return 'excelente';
  if (promedio >= 5.0) return 'bueno';
  if (promedio >= 4.0) return 'regular';
  return 'deficiente';
}

/**
 * Determina si un alumno está en riesgo académico
 * @param {number} promedio - Promedio numérico (0-7.0)
 * @param {number} porcentajeAsistencia - Porcentaje de asistencia (0-100)
 * @returns {boolean} True si el alumno está en riesgo
 */
function estaEnRiesgo(promedio, porcentajeAsistencia) {
  // Riesgo académico: promedio < 4.0 (nota mínima de aprobación en Chile)
  // Riesgo por inasistencia: asistencia < 75% (umbral legal en Chile)
  return promedio < 4.0 || porcentajeAsistencia < 75;
}

/**
 * Valida si un nivel de logro es válido
 * @param {string} nivelLogro - Nivel a validar
 * @returns {boolean} True si es válido
 */
function esNivelValido(nivelLogro) {
  return NIVELES_VALIDOS.includes(nivelLogro);
}

/**
 * Obtiene descripción textual de un nivel de logro
 * @param {string} nivelLogro - Nivel de logro
 * @returns {string} Descripción del nivel
 */
function obtenerDescripcionNivel(nivelLogro) {
  const descripciones = {
    'L': 'Logrado - El estudiante alcanzó el objetivo de aprendizaje',
    'OD': 'Objetivo en Desarrollo - El estudiante está en proceso de alcanzar el objetivo',
    'NL': 'No Logrado - El estudiante no alcanzó el objetivo de aprendizaje',
    'NT': 'No Trabajado - Objetivo no evaluado aún'
  };
  return descripciones[nivelLogro] || 'Nivel desconocido';
}

module.exports = {
  // Constantes
  NIVEL_A_NOTA,
  NIVELES_VALIDOS,

  // Funciones de conversión
  nivelANota,
  notaANivel,

  // Funciones de cálculo
  calcularPromedioConceptual,
  calcularEstadisticasConceptuales,

  // Funciones de análisis
  determinarNivelDesempeno,
  estaEnRiesgo,

  // Funciones de validación
  esNivelValido,
  obtenerDescripcionNivel
};
