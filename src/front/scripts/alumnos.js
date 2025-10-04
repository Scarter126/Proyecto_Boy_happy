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
const asistenciaUrl = `${PREFIX}/asistencia`;

function showSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
  event.target.classList.add('active');
}

// cerrarSesion() is now defined in auth.js (shared)

function closeModal() {
  document.getElementById('eventModal').style.display = 'none';
  document.getElementById('eventModal').classList.remove('show');
}

// Cargar anuncios
async function cargarAnunciosPortal() {
  try {
    // ✅ CORREGIDO: usar /anuncios en lugar de /comunicaciones
    const res = await fetch(anunciosUrl);
    const anuncios = await res.json();

    // Filtrar solo anuncios para todos o alumnos
    const filtered = anuncios.filter(a => a.destinatarios === 'todos' || a.destinatarios === 'alumnos');

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

// Obtener RUT del alumno desde sessionStorage (se guarda en callback)
function getRutAlumno() {
  // TODO: Obtener del token JWT o session storage
  // Por ahora retornar un RUT de prueba
  return sessionStorage.getItem('rutAlumno') || 'DEMO-RUT';
}

// Cargar evaluaciones del alumno
async function cargarEvaluaciones() {
  const rutAlumno = getRutAlumno();

  try {
    // ✅ CORREGIDO: usar /notas/agrupadas para obtener estructura correcta
    const res = await fetch(`${notasUrl}/agrupadas?rutAlumno=${encodeURIComponent(rutAlumno)}`);
    const data = await res.json();
    const asignaturas = data.asignaturas || [];

    if (!asignaturas || asignaturas.length === 0) {
      document.getElementById('listaEvaluaciones').innerHTML =
        '<div class="card"><p>No hay evaluaciones registradas aún.</p></div>';
      return;
    }

    // Calcular totales para resumen
    let totales = { L: 0, NL: 0, OD: 0, NT: 0 };
    asignaturas.forEach(asig => {
      if (asig.resumen) {
        totales.L += asig.resumen.L || 0;
        totales.NL += asig.resumen.NL || 0;
        totales.OD += asig.resumen.OD || 0;
        totales.NT += asig.resumen.NT || 0;
      }
    });

    // Actualizar resumen
    document.getElementById('totalL').textContent = totales.L;
    document.getElementById('totalNL').textContent = totales.NL;
    document.getElementById('totalOD').textContent = totales.OD;
    document.getElementById('totalNT').textContent = totales.NT;

    // Mostrar evaluaciones por asignatura
    const html = asignaturas.map(asig => `
      <div class="card" style="margin-top: 20px;">
        <h3><i class="fas fa-book"></i> ${asig.nombre}</h3>
        <div style="display: flex; gap: 15px; margin: 15px 0;">
          <span class="nivel-badge logrado">L: ${asig.resumen?.L || 0}</span>
          <span class="nivel-badge en-desarrollo">OD: ${asig.resumen?.OD || 0}</span>
          <span class="nivel-badge no-logrado">NL: ${asig.resumen?.NL || 0}</span>
          <span class="nivel-badge no-trabajado">NT: ${asig.resumen?.NT || 0}</span>
        </div>

        <table style="width: 100%; margin-top: 15px;">
          <thead>
            <tr>
              <th>Objetivo de Aprendizaje</th>
              <th>Nivel</th>
              <th>Fecha</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            ${asig.evaluaciones.map(ev => `
              <tr>
                <td>${ev.objetivoAprendizaje || '-'}</td>
                <td><span class="nivel-badge ${getNivelClass(ev.nivelLogro)}">${ev.nivelLogro || 'NT'}</span></td>
                <td>${new Date(ev.fecha).toLocaleDateString()}</td>
                <td>${ev.observacion || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    document.getElementById('listaEvaluaciones').innerHTML = html;

  } catch (err) {
    console.error('Error cargando evaluaciones:', err);
    document.getElementById('listaEvaluaciones').innerHTML =
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

// Cargar asistencia del alumno
async function cargarAsistencia() {
  const rutAlumno = getRutAlumno();

  try {
    const res = await fetch(`${asistenciaUrl}?rutAlumno=${encodeURIComponent(rutAlumno)}`);
    const registros = await res.json();

    if (!registros || registros.length === 0) {
      document.getElementById('listaAsistencia').innerHTML =
        '<p style="text-align: center; color: #666;">No hay registros de asistencia.</p>';
      return;
    }

    // Calcular resumen
    const totales = { presente: 0, ausente: 0, atrasado: 0 };
    registros.forEach(r => {
      totales[r.estado]++;
    });

    const total = registros.length;
    const porcentaje = total > 0 ? ((totales.presente / total) * 100).toFixed(1) : 0;

    // Actualizar resumen
    document.getElementById('totalPresente').textContent = totales.presente;
    document.getElementById('totalAusente').textContent = totales.ausente;
    document.getElementById('totalAtrasado').textContent = totales.atrasado;
    document.getElementById('porcentajeAsistencia').textContent = porcentaje + '%';

    // Mostrar tabla
    const html = `
      <table style="width: 100%; margin-top: 15px;">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Curso</th>
            <th>Estado</th>
            <th>Observación</th>
          </tr>
        </thead>
        <tbody>
          ${registros.map(r => `
            <tr>
              <td>${new Date(r.fecha).toLocaleDateString()}</td>
              <td>${r.curso}</td>
              <td><span class="badge-${r.estado}">${getEstadoLabel(r.estado)}</span></td>
              <td>${r.observacion || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('listaAsistencia').innerHTML = html;

  } catch (err) {
    console.error('Error cargando asistencia:', err);
    document.getElementById('listaAsistencia').innerHTML =
      '<p style="text-align: center; color: #666;">Error al cargar la asistencia.</p>';
  }
}

function getEstadoLabel(estado) {
  const map = {
    'presente': '✅ Presente',
    'ausente': '❌ Ausente',
    'atrasado': '⏰ Atrasado'
  };
  return map[estado] || estado;
}

// ==============================================
// PROMEDIOS (CU-31) - Vista para Alumnos
// ==============================================

async function cargarMisPromedios() {
  const rutAlumno = getRutAlumno();

  try {
    // ✅ CORREGIDO: usar /notas/promedios en lugar de /recursos-academicos/promedios
    const res = await fetch(`${notasUrl}/promedios?rutAlumno=${encodeURIComponent(rutAlumno)}`);
    const data = await res.json();

    if (!data.promediosPorAsignatura || data.promediosPorAsignatura.length === 0) {
      // Si no hay promedios, no mostrar nada (puede que no tenga evaluaciones aún)
      return;
    }

    // Agregar sección de promedios después de evaluaciones
    const notasSection = document.getElementById('notas');
    if (notasSection && !document.getElementById('misPromedios')) {
      const promediosHTML = `
        <div id="misPromedios" class="card" style="margin-top: 25px;">
          <h3 style="margin-bottom: 20px;">
            <i class="fas fa-chart-line"></i> Mis Promedios
          </h3>

          <div class="promedio-general">
            <div class="promedio-general-content">
              <i class="fas fa-trophy fa-3x"></i>
              <div>
                <h2>${data.promedioGeneral}</h2>
                <p>Mi Promedio General</p>
                <small>${data.totalNotas} evaluaciones</small>
              </div>
            </div>
          </div>

          <div class="promedios-grid">
            ${renderPromediosAlumno(data.promediosPorAsignatura)}
          </div>

          <div class="promedio-footer">
            <small><i class="fas fa-info-circle"></i> Los promedios representan tu desempeño: L=4.0 (Excelente), OD=3.0 (Bueno), NT=2.0, NL=1.0</small>
          </div>
        </div>
      `;

      notasSection.insertAdjacentHTML('beforeend', promediosHTML);
    }

  } catch (err) {
    console.error('Error cargando mis promedios:', err);
  }
}

function renderPromediosAlumno(promediosPorAsignatura) {
  return promediosPorAsignatura.map(asig => {
    const porcentaje = (parseFloat(asig.promedio) / 4) * 100;
    const color = getColorPromedio(asig.promedio);
    const nivelLabel = getNivelLabel(asig.promedio);

    return `
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
  }).join('');
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

document.addEventListener('DOMContentLoaded', async function() {
  // Cargar anuncios al iniciar
  cargarAnunciosPortal();

  // Cargar evaluaciones, asistencia y promedios
  cargarEvaluaciones();
  cargarAsistencia();
  cargarMisPromedios();

  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    height: 600,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek'
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
    eventClick: function(info) {
      const e = info.event;
      document.getElementById('eventTitle').textContent = e.title;
      document.getElementById('eventDate').textContent = e.startStr.split('T')[0];
      document.getElementById('eventTime').textContent = e.startStr.split('T')[1]?.substring(0, 5) || 'Todo el día';
      document.getElementById('eventCurso').textContent = e.extendedProps.curso || 'Todos';
      document.getElementById('eventTipo').textContent = e.extendedProps.tipo || 'Evento';
      document.getElementById('eventDesc').textContent = e.extendedProps.description || '';

      document.getElementById('eventModal').style.display = 'flex';
      document.getElementById('eventModal').classList.add('show');
    }
  });
  calendar.render();
});
