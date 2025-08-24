exports.handler = async () => {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Portal Admin</title>
<link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
<style>
  body { font-family: Arial, sans-serif; margin: 0; display: flex; }
  aside { width: 220px; background: #f4f4f4; padding: 20px; height: 100vh; box-sizing: border-box; }
  main { flex: 1; padding: 20px; }
  h1 { color: #004080; }
  .section { margin-bottom: 20px; display: none; }
  .active { display: block; }
  ul { list-style: none; padding: 0; }
  li { margin: 10px 0; cursor: pointer; }
  li:hover { text-decoration: underline; }
  #calendar { max-width: 900px; margin: 20px auto; }
  .logout-btn { background: #c00; color: #fff; border: none; padding: 8px 12px; cursor: pointer; }
  .btn { background: #0078d7; color: white; border: none; padding: 10px 15px; margin: 10px 0; cursor: pointer; }
  .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; }
  .modal-content { background: #fff; padding: 20px; margin: 5% auto; width: 420px; border-radius: 8px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
  .modal-content h2 { margin-top: 0; }
  label { display: block; margin: 10px 0 5px; }
  input, select, textarea { width: 100%; padding: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
</style>
</head>
<body>
<aside>
  <h2>Menú Admin</h2>
  <ul>
    <li onclick="showSection('calendario')">📅 Calendario</li>
    <li onclick="showSection('matriculas')">📝 Matrículas</li>
    <li onclick="showSection('cursos')">📚 Cursos</li>
    <li onclick="showSection('profesores')">👩‍🏫 Profesores</li>
  </ul>
</aside>
<main>
  <button class="logout-btn" onclick="cerrarSesion()">🔒 Cerrar Sesión</button>

  <div id="calendario" class="section active">
    <h1>Calendario General</h1>
    <button class="btn" onclick="openModal()">➕ Añadir Evento/Evaluación</button>
    <div id="calendar"></div>
  </div>

  <div id="matriculas" class="section">
    <h1>Matrículas</h1>
    <table id="matriculasTable">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>RUT</th>
          <th>Fecha Nacimiento</th>
          <th>Último Curso</th>
          <th>Correo</th>
          <th>Teléfono</th>
          <th>Estado</th>
          <th>Fecha Registro</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>

  <div id="cursos" class="section">
    <h1>Cursos</h1>
    <p>Lista de cursos del colegio</p>
  </div>
  <div id="profesores" class="section">
    <h1>Profesores</h1>
    <p>Lista y gestión de profesores.</p>
  </div>
</main>

<div id="modal" class="modal">
  <div class="modal-content">
    <h2 id="modalTitle">Nuevo Evento/Evaluación</h2>
    <form id="eventForm">
      <input type="hidden" id="eventId">
      <label for="titulo">Título</label>
      <input id="titulo" type="text" name="titulo" required>
      <label for="descripcion">Descripción</label>
      <textarea id="descripcion" name="descripcion"></textarea>
      <label for="fecha">Fecha</label>
      <input id="fecha" type="date" name="fecha" required>
      <label for="hora">Hora</label>
      <input id="hora" type="time" name="hora">
      <label for="tipo">Tipo</label>
      <select id="tipo" name="tipo">
        <option value="evento">Evento</option>
        <option value="evaluacion">Evaluación</option>
      </select>
      <label for="curso">Curso</label>
      <select id="curso" name="curso">
        <option value="todos">Todos</option>
        <option value="1A">1°A</option>
        <option value="1B">1°B</option>
        <option value="2A">2°A</option>
      </select>
      <div style="text-align:center; margin-top:15px;">
        <button type="submit" class="btn">Guardar</button>
        <button type="button" class="btn" onclick="closeModal()">Cancelar</button>
        <button type="button" class="btn" onclick="deleteEvent()" style="background:#c00;">Eliminar</button>
      </div>
    </form>
  </div>
</div>

<script>
let calendar;
const apiUrl = '/prod/eventos';
const matriculasUrl = '/prod/subir-matricula';

function showSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function cerrarSesion() { window.location.href = '/prod'; }
function openModal() { document.getElementById('modal').style.display = 'block'; }
function closeModal() { 
  document.getElementById('modal').style.display = 'none'; 
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('modalTitle').innerText = 'Nuevo Evento/Evaluación';
}

function deleteEvent() {
  const id = document.getElementById('eventId').value;
  if (!id) return alert('No hay evento seleccionado');
  if (!confirm('¿Deseas eliminar este evento?')) return;
  fetch(\`\${apiUrl}?id=\${id}\`, { method: 'DELETE', mode: 'cors' })
    .then(res => { if(!res.ok) throw new Error('Error al eliminar'); alert('✅ Evento eliminado'); closeModal(); calendar.refetchEvents(); })
    .catch(err => { alert('❌ Error al eliminar'); console.error(err); });
}

async function loadMatriculas() {
  try {
    const res = await fetch(matriculasUrl);
    const data = await res.json();
    const tbody = document.querySelector("#matriculasTable tbody");
    tbody.innerHTML = '';
    data.forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${m.nombre}</td>
        <td>\${m.rut}</td>
        <td>\${m.fechaNacimiento}</td>
        <td>\${m.ultimoCurso}</td>
        <td>\${m.correo}</td>
        <td>\${m.telefono}</td>
        <td>\${m.estado}</td>
        <td>\${new Date(m.fechaRegistro).toLocaleString()}</td>
      \`;
      tbody.appendChild(tr);
    });
  } catch(err) {
    console.error('Error cargando matrículas:', err);
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    height: 600,
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    events: async function(fetchInfo, successCallback, failureCallback) {
      try {
        const res = await fetch(apiUrl);
        const eventos = await res.json();
        successCallback(eventos.map(e => ({
          id: e.id,
          title: e.titulo,
          start: e.fecha + (e.hora ? 'T' + e.hora : ''),
          description: e.descripcion,
          extendedProps: { curso: e.curso, tipo: e.tipo }
        })));
      } catch(err) { console.error(err); failureCallback(err); }
    },
    eventClick: function(info) {
      const e = info.event;
      document.getElementById('eventId').value = e.id;
      document.getElementById('titulo').value = e.title;
      document.getElementById('descripcion').value = e.extendedProps.description || '';
      document.getElementById('fecha').value = e.startStr.split('T')[0];
      document.getElementById('hora').value = e.startStr.split('T')[1] || '';
      document.getElementById('tipo').value = e.extendedProps.tipo || 'evento';
      document.getElementById('curso').value = e.extendedProps.curso || 'todos';
      document.getElementById('modalTitle').innerText = 'Editar Evento/Evaluación';
      openModal();
    }
  });
  calendar.render();
  loadMatriculas();

  document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('eventId').value;
    const data = {
      titulo: document.getElementById('titulo').value,
      descripcion: document.getElementById('descripcion').value,
      fecha: document.getElementById('fecha').value,
      hora: document.getElementById('hora').value,
      tipo: document.getElementById('tipo').value,
      curso: document.getElementById('curso').value
    };
    const method = id ? 'PUT' : 'POST';
    const url = id ? \`\${apiUrl}?id=\${id}\` : apiUrl;
    try {
      const res = await fetch(url, { method, mode:'cors', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
      if(!res.ok) throw new Error('Error al guardar');
      alert(id ? '✅ Evento editado' : '✅ Evento guardado');
      closeModal();
      calendar.refetchEvents();
    } catch(err) { alert('❌ No se pudo guardar el evento'); console.error(err); }
  });
});
</script>
</body>
</html>
  `;

  return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html };
};
