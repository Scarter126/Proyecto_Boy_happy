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
    const res = await fetch(`${PREFIX}/anuncios`);
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
    editable: true,
    eventClick: function(info) {
      if (confirm('¿Deseas eliminar este evento?')) {
        fetch(`${PREFIX}/eventos?id=` + info.event.id, {
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
      const data = {
        titulo: e.title,
        descripcion: e.extendedProps.description || '',
        fecha: e.startStr.split('T')[0],
        hora: e.startStr.split('T')[1] || '',
        tipo: e.extendedProps.tipo,
        curso: e.extendedProps.curso
      };
      fetch(`${PREFIX}/eventos?id=` + e.id, {
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
      titulo: document.getElementById('titulo').value,
      descripcion: document.getElementById('descripcion').value,
      fecha: document.getElementById('fecha').value,
      hora: document.getElementById('hora').value,
      tipo: document.getElementById('tipo').value,
      curso: document.getElementById('curso').value
    };
    try {
      const res = await fetch(`${PREFIX}/eventos`, {
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
});
