/**
 * Script común para funciones compartidas entre vistas
 * Incluye carga dinámica de cursos desde configuración
 */

// Variables globales
let cursosDisponibles = [];


/**
 * Obtener cursos desde la configuración en DynamoDB
 */
async function obtenerCursosDesdeConfiguracion() {
  try {
    // Obtener API_URL del contexto global o usar PREFIX
    const apiUrl = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || PREFIX || '';

    const data = await authFetchJSON(`${apiUrl}/configuracion?key=cursos`);
    return data.cursos || [];
  } catch (error) {
    console.error('Error al cargar cursos:', error);
    return [];
  }
}

/**
 * Cargar cursos dinámicamente y almacenarlos en variable global
 */
async function cargarCursosGlobal() {
  cursosDisponibles = await obtenerCursosDesdeConfiguracion();
  return cursosDisponibles;
}

/**
 * Poblar un select con los cursos disponibles
 * @param {string} selectId - ID del elemento select
 * @param {Object} options - Opciones de configuración
 * @param {string} options.placeholder - Texto del placeholder (opcional)
 * @param {boolean} options.incluirTodos - Incluir opción "Todos" (opcional)
 * @param {string} options.valorSeleccionado - Valor pre-seleccionado (opcional)
 */
async function cargarCursosEnSelect(selectId, options = {}) {
  const select = document.getElementById(selectId);
  if (!select) {
    console.error(`Select con id "${selectId}" no encontrado`);
    return;
  }

  // Cargar cursos si no están cargados
  if (cursosDisponibles.length === 0) {
    await cargarCursosGlobal();
  }

  // Limpiar opciones existentes
  select.innerHTML = '';

  // Agregar placeholder si existe
  if (options.placeholder) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = options.placeholder;
    select.appendChild(placeholderOption);
  }

  // Agregar opción "Todos" si se requiere
  if (options.incluirTodos) {
    const todosOption = document.createElement('option');
    todosOption.value = 'todos';
    todosOption.textContent = 'Todos los cursos';
    select.appendChild(todosOption);
  }

  // Agregar cursos
  cursosDisponibles.forEach(curso => {
    const option = document.createElement('option');
    option.value = curso;
    option.textContent = curso;
    if (options.valorSeleccionado === curso) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

/**
 * Generar checkboxes de cursos dinámicamente
 * @param {string} containerId - ID del contenedor
 * @param {string} checkboxClass - Clase CSS para los checkboxes
 * @param {boolean} todosChecked - Marcar todos por defecto
 */
async function cargarCursosEnCheckboxes(containerId, checkboxClass = 'curso-checkbox', todosChecked = true) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Contenedor con id "${containerId}" no encontrado`);
    return;
  }

  // Cargar cursos si no están cargados
  if (cursosDisponibles.length === 0) {
    await cargarCursosGlobal();
  }

  // Limpiar contenido existente
  container.innerHTML = '';

  // Generar checkboxes
  cursosDisponibles.forEach(curso => {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';
    label.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = checkboxClass;
    checkbox.value = curso;
    checkbox.checked = todosChecked;

    const span = document.createElement('span');
    span.textContent = curso;

    label.appendChild(checkbox);
    label.appendChild(span);
    container.appendChild(label);
  });
}

/**
 * Normalizar nombre de curso (para compatibilidad con valores antiguos)
 * @param {string} cursoAntiguo - Nombre del curso en formato antiguo
 * @returns {string} - Nombre normalizado o el original si no hay match
 */
function normalizarCurso(cursoAntiguo) {
  const mapeo = {
    'medio-mayor': 'Medio Mayor',
    'prekinder-a': 'Prekínder A',
    'prekinder-b': 'Prekínder B',
    'kinder': 'Kínder',
    'extension': 'Extensión Horaria',
    'Pre-Kinder': 'Prekínder',
    'Kinder': 'Kínder'
  };

  return mapeo[cursoAntiguo] || cursoAntiguo;
}
