// Configuración de prefijo de callback
const PREFIX = window.APP_CONFIG?.CALLBACK_PREFIX ?? '';

function showSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
  event.target.classList.add('active');
}

function cerrarSesion() {
  window.location.href = PREFIX;
}

function closeModal() {
  document.getElementById('eventModal').style.display = 'none';
  document.getElementById('eventModal').classList.remove('show');
}

// Cargar anuncios
async function cargarAnunciosPortal() {
  try {
    const res = await fetch(`${PREFIX}/anuncios`);
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
      right: 'dayGridMonth,timeGridWeek'
    },
    events: async function(fetchInfo, successCallback, failureCallback) {
      try {
        const res = await fetch(`${PREFIX}/eventos`);
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
