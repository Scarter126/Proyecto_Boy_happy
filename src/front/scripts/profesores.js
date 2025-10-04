// Proteger la página - verificar autenticación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  if (typeof requireAuth === 'function' && !requireAuth()) {
    return;
  }
});

// Configuración de prefijo de callback
const PREFIX = window.APP_CONFIG?.API_URL || '';

// Endpoints V3.0 - Lambdas consolidados
const anunciosUrl = `${PREFIX}/anuncios`; // ✅ CORREGIDO: era /comunicaciones
const eventosUrl = `${PREFIX}/eventos`; // ✅ CORREGIDO: era /comunicaciones
const notasUrl = `${PREFIX}/notas`; // ✅ CORREGIDO: era /recursos-academicos/notas
const materialesUrl = `${PREFIX}/materiales`; // ✅ CORREGIDO: era /recursos-academicos/materiales
const asistenciaUrl = `${PREFIX}/asistencia`;
const bitacoraUrl = `${PREFIX}/bitacora`; // ✅ CORREGIDO: era /bitacora-clases
const usuariosUrl = `${PREFIX}/usuarios`;

function showSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
  event.target.classList.add('active');
}

// cerrarSesion() is now defined in auth.js (shared)

function openModal() {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal').classList.remove('show');
}

// Cargar anuncios
async function cargarAnunciosPortal() {
  try {
    // ✅ CORREGIDO: usar /anuncios en lugar de /comunicaciones
    const res = await fetch(anunciosUrl);
    const anuncios = await res.json();

    // Filtrar solo anuncios para todos o profesores
    const filtered = anuncios.filter(a => a.destinatarios === 'todos' || a.destinatarios === 'profesores');

    document.getElementById('listaAnunciosPortal').innerHTML = filtered.map(a => `
      <div class="card">
        <h3>${a.titulo}</h3>
        <p>${a.contenido}</p>
        <small style="color: #666;">
          <strong>Fecha:</strong> ${new Date(a.fecha).toLocaleDateString()} |
          <strong>Autor:</strong> ${a.autor}
        </small>
      </div>
    `).join('') || '<div class="card"><p>No hay anuncios disponibles.</p></div>';
  } catch (err) {
    console.error('Error cargando anuncios:', err);
    document.getElementById('listaAnunciosPortal').innerHTML = '<div class="card"><p>Error al cargar anuncios.</p></div>';
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  // Cargar anuncios al iniciar
  cargarAnunciosPortal();

  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    height: 600,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: async function(fetchInfo, successCallback, failureCallback) {
      try {
        // ✅ CORREGIDO: usar /eventos en lugar de /comunicaciones
    const res = await fetch(eventosUrl);
        const eventos = await res.json();
        successCallback(eventos.map(e => ({
          id: e.id,
          title: e.titulo,
          start: e.fecha + (e.hora ? 'T' + e.hora : ''),
          description: e.descripcion,
          extendedProps: { curso: e.curso, tipo: e.tipo }
        })));
      } catch (err) {
        console.error(err);
        failureCallback(err);
      }
    },
    editable: true,
    eventClick: function(info) {
      if (confirm('¿Deseas eliminar este evento?')) {
        const eventId = info.event.id;
        // ✅ CORREGIDO: usar /eventos en lugar de /comunicaciones (timestamp eliminado - no usado por backend)
        fetch(`${eventosUrl}?id=${eventId}`, {
          method: 'DELETE'
        }).then(() => {
          info.event.remove();
          alert('Evento eliminado');
        }).catch(err => {
          console.error(err);
          alert('No se pudo eliminar');
        });
      }
    },
    eventDrop: function(info) {
      const e = info.event;
      const eventId = e.id;
      const timestamp = eventId.split('#')[1] || Date.now();
      const data = {
        tipo: 'evento',
        titulo: e.title,
        descripcion: e.extendedProps.description || '',
        fecha: e.startStr.split('T')[0],
        hora: e.startStr.split('T')[1] || '',
        tipoEvento: e.extendedProps.tipo,
        curso: e.extendedProps.curso
      };
      fetch(`${comunicacionesUrl}?id=${eventId}&timestamp=${timestamp}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(err => console.error(err));
    }
  });
  calendar.render();

  document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      tipo: 'evento',
      titulo: document.getElementById('titulo').value,
      descripcion: document.getElementById('descripcion').value,
      fecha: document.getElementById('fecha').value,
      hora: document.getElementById('hora').value,
      tipoEvento: document.getElementById('tipo').value,
      curso: document.getElementById('curso').value
    };
    try {
      // ✅ CORREGIDO: usar /eventos en lugar de /comunicaciones
      const res = await fetch(eventosUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Error al guardar');
      alert('✅ Evento guardado');
      closeModal();
      calendar.refetchEvents();
    } catch (err) {
      alert('❌ No se pudo guardar el evento');
      console.error(err);
    }
  });

  // Establecer fecha actual por defecto
  document.getElementById('asistenciaFecha').value = new Date().toISOString().split('T')[0];
});

// ==============================================
// GESTIÓN DE ASISTENCIA
// ==============================================

// Cargar alumnos del curso seleccionado
async function cargarAlumnosAsistencia() {
  const curso = document.getElementById('asistenciaCurso').value;
  const fecha = document.getElementById('asistenciaFecha').value;

  if (!curso) {
    alert('Por favor selecciona un curso');
    return;
  }

  if (!fecha) {
    alert('Por favor selecciona una fecha');
    return;
  }

  try {
    // Obtener alumnos del curso (filtrar por rol=alumno y curso)
    const res = await fetch(`${PREFIX}/usuarios`);
    const usuarios = await res.json();

    // Filtrar alumnos (en un sistema real, los alumnos tendrían un campo "curso")
    const alumnos = usuarios.filter(u => u.rol === 'alumno');

    if (alumnos.length === 0) {
      document.getElementById('listaAlumnosAsistencia').innerHTML = `
        <div class="card">
          <p>No hay alumnos registrados en este curso.</p>
        </div>
      `;
      return;
    }

    // Verificar si ya existe asistencia para esta fecha y curso
    const asistenciaRes = await fetch(`${asistenciaUrl}?curso=${encodeURIComponent(curso)}&fecha=${fecha}`);
    const asistenciaExistente = await asistenciaRes.json();

    // Crear mapa de asistencia existente
    const asistenciaMap = {};
    asistenciaExistente.forEach(a => {
      asistenciaMap[a.rutAlumno] = a;
    });

    // Generar tabla de asistencia
    document.getElementById('listaAlumnosAsistencia').innerHTML = `
      <div class="card">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Nombre</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">RUT</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Estado</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Observación</th>
            </tr>
          </thead>
          <tbody>
            ${alumnos.map(alumno => {
              const asistencia = asistenciaMap[alumno.rut];
              const estado = asistencia?.estado || 'presente';
              const observacion = asistencia?.observacion || '';

              return `
                <tr data-rut="${alumno.rut}">
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">${alumno.nombre}</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">${alumno.rut}</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">
                    <select class="estado-select" data-rut="${alumno.rut}" style="padding: 5px; border-radius: 4px; border: 1px solid #ddd;">
                      <option value="presente" ${estado === 'presente' ? 'selected' : ''}>✅ Presente</option>
                      <option value="ausente" ${estado === 'ausente' ? 'selected' : ''}>❌ Ausente</option>
                      <option value="atrasado" ${estado === 'atrasado' ? 'selected' : ''}>⏰ Atrasado</option>
                    </select>
                  </td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">
                    <input type="text" class="observacion-input" data-rut="${alumno.rut}"
                           value="${observacion}"
                           placeholder="Observación (opcional)"
                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('botonesAsistencia').style.display = 'block';

  } catch (err) {
    console.error('Error cargando alumnos:', err);
    alert('Error al cargar los alumnos');
  }
}

// Guardar asistencia de todos los alumnos
async function guardarAsistencia() {
  const curso = document.getElementById('asistenciaCurso').value;
  const fecha = document.getElementById('asistenciaFecha').value;

  const alumnos = [];
  const rows = document.querySelectorAll('#listaAlumnosAsistencia tr[data-rut]');

  rows.forEach(row => {
    const rut = row.dataset.rut;
    const nombre = row.querySelector('td:first-child').textContent;
    const estado = row.querySelector('.estado-select').value;
    const observacion = row.querySelector('.observacion-input').value;

    alumnos.push({
      rut,
      nombre,
      estado,
      observacion
    });
  });

  if (alumnos.length === 0) {
    alert('No hay alumnos para registrar');
    return;
  }

  try {
    const res = await fetch(asistenciaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        curso,
        fecha,
        alumnos
      })
    });

    if (!res.ok) throw new Error('Error al guardar');

    const result = await res.json();
    alert(`✅ Asistencia guardada correctamente (${result.registrados} alumnos)`);

  } catch (err) {
    console.error('Error guardando asistencia:', err);
    alert('❌ Error al guardar la asistencia');
  }
}

// ========================================
// CU-33: CONSULTAR Y MODIFICAR ASISTENCIA
// ========================================

async function consultarAsistencia() {
  const curso = document.getElementById('consultaCurso').value;
  const fecha = document.getElementById('consultaFecha').value;

  if (!curso || !fecha) {
    alert('Selecciona curso y fecha');
    return;
  }

  try {
    const res = await fetch(`${asistenciaUrl}?curso=${encodeURIComponent(curso)}&fecha=${fecha}`);

    if (!res.ok) throw new Error('Error al consultar');

    const registros = await res.json();

    if (registros.length === 0) {
      document.getElementById('tablaAsistenciaConsulta').innerHTML =
        '<p style="text-align: center; color: #666;">No hay registros de asistencia para esta fecha</p>';
      return;
    }

    // Crear tabla con registros editables
    let html = `
      <div class="card">
        <h4>Asistencia del ${fecha} - ${curso}</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Estado</th>
              <th>Observación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    registros.forEach(reg => {
      html += `
        <tr data-id="${reg.id}">
          <td>${reg.nombreAlumno}</td>
          <td>
            <select class="estado-edit" data-id="${reg.id}" style="padding: 5px;">
              <option value="presente" ${reg.estado === 'presente' ? 'selected' : ''}>Presente</option>
              <option value="ausente" ${reg.estado === 'ausente' ? 'selected' : ''}>Ausente</option>
              <option value="atrasado" ${reg.estado === 'atrasado' ? 'selected' : ''}>Atrasado</option>
            </select>
          </td>
          <td>
            <input type="text" class="observacion-edit" data-id="${reg.id}"
                   value="${reg.observacion || ''}"
                   placeholder="Observación"
                   style="width: 100%; padding: 5px;">
          </td>
          <td>
            <button class="btn btn-sm btn-success" onclick="actualizarAsistencia('${reg.id}')">
              <i class="fas fa-save"></i>
            </button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('tablaAsistenciaConsulta').innerHTML = html;

  } catch (err) {
    console.error('Error consultando asistencia:', err);
    alert('❌ Error al consultar asistencia');
  }
}

async function actualizarAsistencia(id) {
  const estadoSelect = document.querySelector(`.estado-edit[data-id="${id}"]`);
  const observacionInput = document.querySelector(`.observacion-edit[data-id="${id}"]`);

  const estado = estadoSelect.value;
  const observacion = observacionInput.value;

  try {
    const res = await fetch(`${asistenciaUrl}?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, observacion })
    });

    if (!res.ok) throw new Error('Error al actualizar');

    alert('✅ Asistencia actualizada correctamente');

  } catch (err) {
    console.error('Error actualizando asistencia:', err);
    alert('❌ Error al actualizar asistencia');
  }
}

// ========================================
// CU-34: REPORTE DE ASISTENCIA Y ALERTAS
// ========================================

async function generarReporteAsistencia() {
  const curso = document.getElementById('reporteCurso').value;
  const fechaInicio = document.getElementById('reporteFechaInicio').value;
  const fechaFin = document.getElementById('reporteFechaFin').value;

  if (!curso || !fechaInicio || !fechaFin) {
    alert('Completa todos los campos del reporte');
    return;
  }

  if (fechaInicio > fechaFin) {
    alert('La fecha de inicio no puede ser mayor a la fecha de fin');
    return;
  }

  try {
    // Obtener todos los registros del curso en el rango de fechas
    // Como no tenemos un endpoint específico, hacemos múltiples consultas por fecha
    const fechas = obtenerRangoFechas(fechaInicio, fechaFin);
    let todosRegistros = [];

    for (const fecha of fechas) {
      const res = await fetch(`${asistenciaUrl}?curso=${encodeURIComponent(curso)}&fecha=${fecha}`);
      if (res.ok) {
        const registros = await res.json();
        todosRegistros = todosRegistros.concat(registros);
      }
    }

    if (todosRegistros.length === 0) {
      document.getElementById('reporteAsistencia').innerHTML =
        '<p style="text-align: center; color: #666;">No hay datos para generar el reporte</p>';
      return;
    }

    // Agrupar por alumno y calcular estadísticas
    const estadisticas = {};

    todosRegistros.forEach(reg => {
      if (!estadisticas[reg.rutAlumno]) {
        estadisticas[reg.rutAlumno] = {
          nombre: reg.nombreAlumno,
          presente: 0,
          ausente: 0,
          atrasado: 0,
          total: 0
        };
      }
      estadisticas[reg.rutAlumno][reg.estado]++;
      estadisticas[reg.rutAlumno].total++;
    });

    // Generar reporte HTML
    let html = `
      <div class="card">
        <h4>📊 Reporte de Asistencia</h4>
        <p><strong>Curso:</strong> ${curso} | <strong>Periodo:</strong> ${fechaInicio} al ${fechaFin}</p>
        <p><strong>Total de días:</strong> ${fechas.length}</p>

        <table class="data-table" style="margin-top: 15px;">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Presentes</th>
              <th>Ausentes</th>
              <th>Atrasados</th>
              <th>% Asistencia</th>
              <th>Alerta</th>
            </tr>
          </thead>
          <tbody>
    `;

    Object.values(estadisticas).forEach(est => {
      const porcentajeAsistencia = ((est.presente / est.total) * 100).toFixed(1);
      const tieneAlerta = porcentajeAsistencia < 85;
      const colorAlerta = tieneAlerta ? 'background: #ffebee; color: #c62828;' : '';

      html += `
        <tr style="${colorAlerta}">
          <td>${est.nombre}</td>
          <td>${est.presente}</td>
          <td>${est.ausente}</td>
          <td>${est.atrasado}</td>
          <td><strong>${porcentajeAsistencia}%</strong></td>
          <td>
            ${tieneAlerta ? '<span style="color: #c62828;">⚠️ AUSENTISMO</span>' : '✅'}
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <p style="margin-top: 15px; color: #666; font-size: 0.9em;">
          <strong>Nota:</strong> Se genera alerta de ausentismo cuando la asistencia es menor al 85%
        </p>
      </div>
    `;

    document.getElementById('reporteAsistencia').innerHTML = html;

  } catch (err) {
    console.error('Error generando reporte:', err);
    alert('❌ Error al generar reporte de asistencia');
  }
}

// Función auxiliar para obtener rango de fechas
function obtenerRangoFechas(inicio, fin) {
  const fechas = [];
  let fechaActual = new Date(inicio);
  const fechaFinal = new Date(fin);

  while (fechaActual <= fechaFinal) {
    fechas.push(fechaActual.toISOString().split('T')[0]);
    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  return fechas;
}

// ========================================
// GESTIÓN DE NOTAS - Commit 2.2.4
// ========================================

let alumnosDisponibles = [];

async function cargarAlumnosPorCurso() {
  const curso = document.getElementById('notaCurso').value;
  const selectAlumno = document.getElementById('notaAlumno');

  if (!curso) {
    selectAlumno.disabled = true;
    selectAlumno.innerHTML = '<option value="">Primero selecciona un curso</option>';
    return;
  }

  try {
    const res = await fetch(`${PREFIX}/usuarios`);
    const usuarios = await res.json();

    // Filtrar alumnos (en producción filtrar por curso también)
    alumnosDisponibles = usuarios.filter(u => u.rol === 'alumno');

    selectAlumno.disabled = false;
    selectAlumno.innerHTML = '<option value="">Seleccionar alumno</option>' +
      alumnosDisponibles.map(a =>
        `<option value="${a.rut}" data-nombre="${a.nombre}">${a.nombre} - ${a.rut}</option>`
      ).join('');

  } catch (err) {
    console.error('Error cargando alumnos:', err);
    alert('Error al cargar lista de alumnos');
  }
}

async function guardarNota(event) {
  event.preventDefault();

  const rutAlumno = document.getElementById('notaAlumno').value;
  const selectAlumno = document.getElementById('notaAlumno');
  const nombreAlumno = selectAlumno.options[selectAlumno.selectedIndex].dataset.nombre;

  const evaluacion = {
    rutAlumno,
    nombreAlumno,
    curso: document.getElementById('notaCurso').value,
    asignatura: document.getElementById('notaAsignatura').value,
    ambito: document.getElementById('notaAmbito').value,
    objetivoAprendizaje: document.getElementById('notaObjetivo').value,
    nivelLogro: document.getElementById('notaNivel').value,
    fecha: document.getElementById('notaFecha').value,
    observacion: document.getElementById('notaObservacion').value
  };

  try {
    // ✅ CORREGIDO: usar /notas en lugar de /recursos-academicos/notas
    const res = await fetch(notasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evaluacion)
    });

    if (!res.ok) throw new Error('Error al guardar evaluación');

    alert('✅ Evaluación registrada correctamente');
    document.getElementById('formNota').reset();
    document.getElementById('notaAlumno').disabled = true;

    // Recargar consulta si hay filtros activos
    consultarNotas();

  } catch (err) {
    console.error('Error guardando evaluación:', err);
    alert('❌ Error al guardar la evaluación');
  }
}

async function consultarNotas() {
  const curso = document.getElementById('consultaCurso').value;
  const asignatura = document.getElementById('consultaAsignatura').value;

  // ✅ CORREGIDO: usar /notas en lugar de /recursos-academicos/notas
  let url = `${notasUrl}?`;
  if (curso) url += `curso=${curso}&`;
  if (asignatura) url += `asignatura=${asignatura}`;

  try {
    const res = await fetch(url);
    const evaluaciones = await res.json();

    if (!evaluaciones || evaluaciones.length === 0) {
      document.getElementById('listaNotas').innerHTML =
        '<div class="card"><p>No se encontraron evaluaciones con los filtros seleccionados.</p></div>';
      return;
    }

    // Agrupar por alumno
    const porAlumno = {};
    evaluaciones.forEach(ev => {
      const key = ev.rutAlumno;
      if (!porAlumno[key]) {
        porAlumno[key] = {
          nombre: ev.nombreAlumno,
          rut: ev.rutAlumno,
          evaluaciones: []
        };
      }
      porAlumno[key].evaluaciones.push(ev);
    });

    const html = Object.values(porAlumno).map(alumno => {
      // Calcular resumen de niveles de logro
      const resumen = { L: 0, NL: 0, OD: 0, NT: 0 };
      alumno.evaluaciones.forEach(ev => {
        if (ev.nivelLogro) resumen[ev.nivelLogro]++;
      });

      return `
        <div class="card">
          <h4><i class="fas fa-user"></i> ${alumno.nombre} (${alumno.rut})</h4>
          <div style="margin: 15px 0; display: flex; gap: 15px;">
            <span class="nivel-badge logrado">L: ${resumen.L}</span>
            <span class="nivel-badge no-logrado">NL: ${resumen.NL}</span>
            <span class="nivel-badge en-desarrollo">OD: ${resumen.OD}</span>
            <span class="nivel-badge no-trabajado">NT: ${resumen.NT}</span>
          </div>

          <table style="width: 100%; margin-top: 10px;">
            <thead>
              <tr>
                <th>Asignatura/Ámbito</th>
                <th>Objetivo de Aprendizaje</th>
                <th>Nivel</th>
                <th>Fecha</th>
                <th>Observación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${alumno.evaluaciones.map(ev => `
                <tr>
                  <td>${ev.asignatura || ev.ambito}</td>
                  <td>${ev.objetivoAprendizaje || '-'}</td>
                  <td><span class="nivel-badge ${getNivelClass(ev.nivelLogro)}">${ev.nivelLogro || 'NT'}</span></td>
                  <td>${new Date(ev.fecha).toLocaleDateString()}</td>
                  <td>${ev.observacion || '-'}</td>
                  <td>
                    <button class="btn-sm btn-danger" onclick="eliminarEvaluacion('${ev.id}')">
                      <i class="fas fa-trash"></i> Eliminar
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    document.getElementById('listaNotas').innerHTML = html;

  } catch (err) {
    console.error('Error consultando evaluaciones:', err);
    document.getElementById('listaNotas').innerHTML =
      '<div class="card"><p>Error al cargar las evaluaciones.</p></div>';
  }
}

function getNivelClass(nivel) {
  const map = {
    'L': 'logrado',
    'NL': 'no-logrado',
    'OD': 'en-desarrollo',
    'NT': 'no-trabajado'
  };
  return map[nivel] || 'no-trabajado';
}

// Establecer fecha de hoy por defecto
document.addEventListener('DOMContentLoaded', function() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('notaFecha').value = today;
});

// ========================================
// GESTIÓN DE MATERIALES - Commit 2.3.4
// ========================================

async function subirMaterial(event) {
  event.preventDefault();

  const curso = document.getElementById('materialCurso').value;
  const asignatura = document.getElementById('materialAsignatura').value;
  const titulo = document.getElementById('materialTitulo').value;
  const descripcion = document.getElementById('materialDescripcion').value;
  const unidad = document.getElementById('materialUnidad')?.value || ''; // CU-37: Capturar unidad
  const archivoInput = document.getElementById('materialArchivo');
  const archivo = archivoInput.files[0];

  if (!archivo) {
    alert('Selecciona un archivo');
    return;
  }

  try {
    // Convertir archivo a base64
    const reader = new FileReader();

    reader.onload = async function(e) {
      const base64 = e.target.result.split(',')[1]; // Quitar prefijo data:...

      const materialData = {
        curso,
        asignatura,
        titulo,
        descripcion,
        unidad, // CU-37: Incluir unidad
        nombreArchivo: archivo.name,
        tipoArchivo: archivo.type,
        archivoBase64: base64, // ✅ AGREGADO: Enviar archivo en base64
        profesor: 'Profesor' // TODO: Obtener del usuario logueado
      };

      // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
      const res = await fetch(materialesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materialData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear material');
      }

      alert('✅ Material subido correctamente');
      document.getElementById('formMaterial').reset();
      cargarMateriales(); // Recargar lista
    };

    reader.onerror = function() {
      alert('Error al leer el archivo');
    };

    reader.readAsDataURL(archivo);

    // Recargar lista de materiales
    consultarMateriales();

  } catch (err) {
    console.error('Error subiendo material:', err);
    alert('❌ Error al subir el material');
  }
}

async function consultarMateriales() {
  const curso = document.getElementById('consultaMaterialCurso').value;
  const asignatura = document.getElementById('consultaMaterialAsignatura').value;

  // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
  let url = `${materialesUrl}?`;
  if (curso) url += `curso=${curso}&`;
  if (asignatura) url += `asignatura=${asignatura}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    // ✅ CORREGIDO: Backend retorna {materiales: [], total}, no array directo
    const materiales = data.materiales || data;

    if (!materiales || materiales.length === 0) {
      document.getElementById('listaMateriales').innerHTML =
        '<div class="card"><p>No se encontraron materiales con los filtros seleccionados.</p></div>';
      return;
    }

    const html = materiales.map(m => {
      const icon = getFileIcon(m.nombreArchivo);
      const fecha = new Date(m.fechaSubida).toLocaleDateString();
      const tamanio = formatBytes(m.tamanio);

      return `
        <div class="card material-item">
          <div class="material-header">
            <div>
              <i class="${icon}" style="font-size: 2em; color: var(--purple-main);"></i>
              <h4>${m.titulo}</h4>
            </div>
            <button class="btn btn-danger btn-sm" onclick="eliminarMaterial('${m.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <p><strong>Curso:</strong> ${m.curso} | <strong>Asignatura:</strong> ${m.asignatura}</p>
          <p>${m.descripcion || 'Sin descripción'}</p>
          <p style="font-size: 0.9em; color: #666;">
            <strong>Archivo:</strong> ${m.nombreArchivo} (${tamanio}) |
            <strong>Subido:</strong> ${fecha} por ${m.profesor}
          </p>
          <button class="btn btn-primary btn-sm" onclick="descargarMaterial('${m.id}')">
            <i class="fas fa-download"></i> Descargar
          </button>
        </div>
      `;
    }).join('');

    document.getElementById('listaMateriales').innerHTML = html;

  } catch (err) {
    console.error('Error consultando materiales:', err);
    document.getElementById('listaMateriales').innerHTML =
      '<div class="card"><p>Error al cargar los materiales.</p></div>';
  }
}

async function descargarMaterial(id) {
  try {
    // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
    const res = await fetch(`${materialesUrl}?id=${id}`);
    const material = await res.json();

    if (!material.downloadURL) {
      throw new Error('No se pudo obtener URL de descarga');
    }

    // Abrir en nueva ventana para descargar
    window.open(material.downloadURL, '_blank');

  } catch (err) {
    console.error('Error descargando material:', err);
    alert('❌ Error al descargar el material');
  }
}

async function eliminarMaterial(id) {
  if (!confirm('¿Estás seguro de eliminar este material?')) return;

  try {
    // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
    const res = await fetch(`${materialesUrl}?id=${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Error al eliminar');

    alert('✅ Material eliminado correctamente');
    consultarMateriales();

  } catch (err) {
    console.error('Error eliminando material:', err);
    alert('❌ Error al eliminar el material');
  }
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const iconMap = {
    'pdf': 'fas fa-file-pdf',
    'doc': 'fas fa-file-word',
    'docx': 'fas fa-file-word',
    'xls': 'fas fa-file-excel',
    'xlsx': 'fas fa-file-excel',
    'ppt': 'fas fa-file-powerpoint',
    'pptx': 'fas fa-file-powerpoint',
    'jpg': 'fas fa-file-image',
    'jpeg': 'fas fa-file-image',
    'png': 'fas fa-file-image',
    'gif': 'fas fa-file-image',
    'mp4': 'fas fa-file-video',
    'avi': 'fas fa-file-video',
    'mov': 'fas fa-file-video'
  };
  return iconMap[ext] || 'fas fa-file';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Eliminar evaluación
async function eliminarEvaluacion(id) {
  if (!confirm('¿Estás seguro de eliminar esta evaluación? Esta acción no se puede deshacer.')) return;

  try {
    // ✅ CORREGIDO: usar /notas en lugar de /recursos-academicos/notas
    const res = await fetch(`${notasUrl}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Error al eliminar evaluación');

    alert('✅ Evaluación eliminada correctamente');
    consultarNotas(); // Recargar la lista

  } catch (err) {
    console.error('Error eliminando evaluación:', err);
    alert('❌ Error al eliminar la evaluación');
  }
}

// ========================================
// CU-36: BITÁCORA DE CLASES
// ========================================

async function guardarBitacora(event) {
  event.preventDefault();

  const bitacora = {
    curso: document.getElementById('bitacoraCurso').value,
    asignatura: document.getElementById('bitacoraAsignatura').value,
    fecha: document.getElementById('bitacoraFecha').value,
    unidad: document.getElementById('bitacoraUnidad').value,
    tema: document.getElementById('bitacoraTema').value,
    contenido: document.getElementById('bitacoraContenido').value,
    objetivosAprendizaje: document.getElementById('bitacoraObjetivos').value.split('\n').filter(o => o.trim()),
    observaciones: document.getElementById('bitacoraObservaciones').value,
    profesor: 'Profesor' // TODO: Obtener del usuario logueado
  };

  try {
    // ✅ CORREGIDO: usar /bitacora en lugar de /bitacora-clases
    const res = await fetch(bitacoraUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bitacora)
    });

    if (!res.ok) throw new Error('Error al guardar bitácora');

    alert('✅ Bitácora de clase registrada correctamente');
    document.getElementById('formBitacora').reset();
    consultarBitacora();

  } catch (err) {
    console.error('Error guardando bitácora:', err);
    alert('❌ Error al guardar la bitácora de clase');
  }
}

async function consultarBitacora() {
  const curso = document.getElementById('consultaBitacoraCurso').value;
  const asignatura = document.getElementById('consultaBitacoraAsignatura').value;

  if (!curso) {
    document.getElementById('listaBitacora').innerHTML =
      '<div class="card"><p>Selecciona un curso para ver la bitácora</p></div>';
    return;
  }

  // ✅ CORREGIDO: usar /bitacora en lugar de /bitacora-clases
  let url = `${bitacoraUrl}?curso=${encodeURIComponent(curso)}`;
  if (asignatura) {
    url += `&asignatura=${encodeURIComponent(asignatura)}`;
  }

  try {
    const res = await fetch(url);
    const registros = await res.json();

    if (!registros || registros.length === 0) {
      document.getElementById('listaBitacora').innerHTML =
        '<div class="card"><p>No hay registros de bitácora para este curso/asignatura</p></div>';
      return;
    }

    // Ordenar por fecha descendente
    registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const html = registros.map(reg => {
      const fecha = new Date(reg.fecha).toLocaleDateString('es-CL');
      return `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h4>${reg.tema || 'Sin tema'}</h4>
              <p><strong>Fecha:</strong> ${fecha} | <strong>Unidad:</strong> ${reg.unidad || '-'}</p>
              <p><strong>Contenido:</strong> ${reg.contenido}</p>
              ${reg.objetivosAprendizaje && reg.objetivosAprendizaje.length > 0 ? `
                <p><strong>Objetivos de Aprendizaje:</strong></p>
                <ul>
                  ${reg.objetivosAprendizaje.map(oa => `<li>${oa}</li>`).join('')}
                </ul>
              ` : ''}
              ${reg.observaciones ? `<p><strong>Observaciones:</strong> ${reg.observaciones}</p>` : ''}
              <p style="font-size: 0.9em; color: #666;"><strong>Profesor:</strong> ${reg.profesor}</p>
            </div>
            <div>
              <button class="btn-sm btn-danger" onclick="eliminarBitacora('${reg.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('listaBitacora').innerHTML = html;

  } catch (err) {
    console.error('Error consultando bitácora:', err);
    document.getElementById('listaBitacora').innerHTML =
      '<div class="card"><p>Error al cargar la bitácora</p></div>';
  }
}

async function eliminarBitacora(id) {
  if (!confirm('¿Eliminar este registro de bitácora?')) return;

  try {
    // ✅ CORREGIDO: usar /bitacora en lugar de /bitacora-clases
    const res = await fetch(`${bitacoraUrl}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Error al eliminar');

    alert('✅ Registro eliminado correctamente');
    consultarBitacora();

  } catch (err) {
    console.error('Error eliminando bitácora:', err);
    alert('❌ Error al eliminar el registro');
  }
}

// ========================================
// CU-37: ORGANIZAR MATERIALES POR UNIDADES
// ========================================

async function actualizarUnidadMaterial(materialId, nuevaUnidad) {
  try {
    // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
    const res = await fetch(`${materialesUrl}?id=${encodeURIComponent(materialId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidad: nuevaUnidad })
    });

    if (!res.ok) throw new Error('Error al actualizar unidad');

    alert('✅ Material asignado a ' + (nuevaUnidad || 'Sin unidad'));
    consultarMateriales();

  } catch (err) {
    console.error('Error actualizando unidad:', err);
    alert('❌ Error al asignar unidad');
  }
}

async function consultarMaterialesPorUnidad() {
  const curso = document.getElementById('consultaMaterialCurso').value;
  const asignatura = document.getElementById('consultaMaterialAsignatura').value;
  const unidad = document.getElementById('filtroUnidad').value;

  if (!curso) {
    alert('Selecciona un curso primero');
    return;
  }

  // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
  let url = `${materialesUrl}?curso=${encodeURIComponent(curso)}`;
  if (asignatura) {
    url += `&asignatura=${encodeURIComponent(asignatura)}`;
  }
  if (unidad) {
    url += `&unidad=${encodeURIComponent(unidad)}`;
  }

  try {
    const res = await fetch(url);
    const materiales = await res.json();

    if (!materiales || materiales.length === 0) {
      document.getElementById('listaMateriales').innerHTML =
        '<div class="card"><p>No se encontraron materiales</p></div>';
      return;
    }

    // Agrupar por unidad
    const porUnidad = {};
    materiales.forEach(m => {
      const unidadKey = m.unidad || 'Sin unidad';
      if (!porUnidad[unidadKey]) {
        porUnidad[unidadKey] = [];
      }
      porUnidad[unidadKey].push(m);
    });

    let html = '';
    Object.keys(porUnidad).sort().forEach(unidadNombre => {
      html += `
        <div class="card">
          <h4><i class="fas fa-folder"></i> ${unidadNombre} (${porUnidad[unidadNombre].length})</h4>
          <table style="width: 100%; margin-top: 10px;">
            <thead>
              <tr>
                <th>Título</th>
                <th>Archivo</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${porUnidad[unidadNombre].map(m => {
                const fecha = new Date(m.fechaSubida).toLocaleDateString();
                return `
                  <tr>
                    <td><strong>${m.titulo}</strong></td>
                    <td>${m.nombreArchivo}</td>
                    <td>${fecha}</td>
                    <td>
                      <button class="btn-sm btn-primary" onclick="descargarMaterial('${m.id}')">
                        <i class="fas fa-download"></i>
                      </button>
                      <button class="btn-sm btn-warning" onclick="cambiarUnidad('${m.id}', '${m.unidad || ''}')">
                        <i class="fas fa-folder-open"></i> Mover
                      </button>
                      <button class="btn-sm btn-danger" onclick="eliminarMaterial('${m.id}')">
                        <i class="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    document.getElementById('listaMateriales').innerHTML = html;

  } catch (err) {
    console.error('Error consultando materiales:', err);
    document.getElementById('listaMateriales').innerHTML =
      '<div class="card"><p>Error al cargar materiales</p></div>';
  }
}

function cambiarUnidad(materialId, unidadActual) {
  const nuevaUnidad = prompt('Ingresa la nueva unidad (ej: Unidad 1, Unidad 2):', unidadActual);
  if (nuevaUnidad !== null) {
    actualizarUnidadMaterial(materialId, nuevaUnidad);
  }
}

// ==============================================
// PROMEDIOS (CU-31)
// ==============================================

async function cargarAlumnosPorCurso() {
  const curso = document.getElementById('promedioCurso').value;
  const selectAlumno = document.getElementById('promedioAlumno');

  // Limpiar contenedor de promedios
  document.getElementById('contenedorPromedios').innerHTML = '';

  if (!curso) {
    selectAlumno.innerHTML = '<option value="">-- Primero seleccione un curso --</option>';
    return;
  }

  try {
    // Buscar alumnos del curso seleccionado
    const res = await fetch(`${PREFIX}/usuarios`);
    const usuarios = await res.json();
    const data = { resultados: usuarios.filter(u => u.rol === 'alumno') };

    if (!data.resultados || data.resultados.length === 0) {
      selectAlumno.innerHTML = '<option value="">-- No hay alumnos en este curso --</option>';
      return;
    }

    selectAlumno.innerHTML = '<option value="">-- Seleccionar alumno --</option>';

    data.resultados.forEach(alumno => {
      const option = document.createElement('option');
      option.value = alumno.rut;
      option.textContent = `${alumno.nombre} (${alumno.rut})`;
      option.dataset.nombre = alumno.nombre;
      selectAlumno.appendChild(option);
    });

  } catch (err) {
    console.error('Error cargando alumnos:', err);
    selectAlumno.innerHTML = '<option value="">-- Error al cargar alumnos --</option>';
  }
}

async function cargarPromediosAlumno() {
  const selectAlumno = document.getElementById('promedioAlumno');
  const rutAlumno = selectAlumno.value;

  if (!rutAlumno) {
    document.getElementById('contenedorPromedios').innerHTML = '';
    return;
  }

  const nombreAlumno = selectAlumno.options[selectAlumno.selectedIndex].dataset.nombre;

  try {
    // ✅ CORREGIDO: usar /notas/promedios en lugar de /recursos-academicos/promedios
    const res = await fetch(`${notasUrl}/promedios?rutAlumno=${encodeURIComponent(rutAlumno)}`);
    const data = await res.json();

    if (!data.promediosPorAsignatura || data.promediosPorAsignatura.length === 0) {
      document.getElementById('contenedorPromedios').innerHTML = `
        <div class="card" style="margin-top: 20px;">
          <p style="text-align: center; color: #666;">No hay evaluaciones registradas para este alumno</p>
        </div>
      `;
      return;
    }

    renderPromedios(data, nombreAlumno);

  } catch (err) {
    console.error('Error cargando promedios:', err);
    document.getElementById('contenedorPromedios').innerHTML = `
      <div class="card" style="margin-top: 20px;">
        <p style="text-align: center; color: #f44336;">Error al cargar promedios</p>
      </div>
    `;
  }
}

function renderPromedios(data, nombreAlumno) {
  const container = document.getElementById('contenedorPromedios');

  let html = `
    <div class="card" style="margin-top: 20px;">
      <h3 style="margin-bottom: 20px;">
        <i class="fas fa-user-graduate"></i> Promedios de ${nombreAlumno || data.nombreAlumno}
      </h3>

      <div class="promedio-general">
        <div class="promedio-general-content">
          <i class="fas fa-star fa-3x"></i>
          <div>
            <h2>${data.promedioGeneral}</h2>
            <p>Promedio General</p>
            <small>${data.totalNotas} evaluaciones totales</small>
          </div>
        </div>
      </div>

      <div class="promedios-grid">
  `;

  data.promediosPorAsignatura.forEach(asig => {
    const porcentaje = (parseFloat(asig.promedio) / 4) * 100;
    const color = getColorPromedio(asig.promedio);
    const nivelLabel = getNivelLabel(asig.promedio);

    html += `
      <div class="promedio-card">
        <div class="promedio-card-header">
          <h4><i class="fas fa-book"></i> ${asig.asignatura}</h4>
          <span class="nivel-badge" style="background: ${color};">${nivelLabel}</span>
        </div>

        <div class="promedio-bar-container">
          <div class="promedio-bar">
            <div class="promedio-fill" style="width: ${porcentaje}%; background: ${color};"></div>
          </div>
          <span class="promedio-porcentaje">${porcentaje.toFixed(0)}%</span>
        </div>

        <div class="promedio-info">
          <div class="promedio-valor">
            <span class="numero">${asig.promedio}</span>
            <span class="total">/ 4.0</span>
          </div>
          <span class="promedio-evaluaciones">
            <i class="fas fa-clipboard-check"></i> ${asig.totalNotas} evaluaciones
          </span>
        </div>
      </div>
    `;
  });

  html += `
      </div>

      <div class="promedio-footer">
        <small><i class="fas fa-info-circle"></i> Los promedios se calculan convirtiendo los niveles de logro a escala numérica: L=4.0, OD=3.0, NT=2.0, NL=1.0</small>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function getColorPromedio(promedio) {
  const p = parseFloat(promedio);
  if (p >= 3.5) return '#4caf50'; // Verde - Excelente
  if (p >= 3.0) return '#8bc34a'; // Verde claro - Bueno
  if (p >= 2.5) return '#ff9800'; // Naranja - Regular
  return '#f44336'; // Rojo - Necesita apoyo
}

function getNivelLabel(promedio) {
  const p = parseFloat(promedio);
  if (p >= 3.5) return 'Excelente';
  if (p >= 3.0) return 'Bueno';
  if (p >= 2.5) return 'Regular';
  return 'Necesita Apoyo';
}

// Establecer fecha de hoy por defecto en bitácora
document.addEventListener('DOMContentLoaded', function() {
  const bitacoraFecha = document.getElementById('bitacoraFecha');
  if (bitacoraFecha) {
    bitacoraFecha.value = new Date().toISOString().split('T')[0];
  }
});
