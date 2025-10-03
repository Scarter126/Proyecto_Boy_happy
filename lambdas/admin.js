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
  .btn { background: #0078d7; color: white; border: none; padding: 6px 10px; margin: 3px; cursor: pointer; font-size: 0.9rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  select, input { padding: 4px; }
  .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; }
  .modal-content { background: #fff; padding: 20px; margin: 5% auto; width: 420px; border-radius: 8px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
</style>
</head>
<body>
<aside>
  <h2>Menú Admin</h2>
  <ul>
    <li onclick="showSection('calendario')">📅 Calendario</li>
    <li onclick="showSection('aceptados')">✅ Aceptados</li>
    <li onclick="showSection('cursos')">📚 Cursos</li>
    <li onclick="showSection('profesores')">👩‍🏫 Profesores</li>
    <li onclick="showSection('imagenes')">🖼️ Imágenes</li>
    <li onclick="showSection('usuarios')">👤 Usuarios</li>
  </ul>
</aside>
<main>
  <button class="logout-btn" onclick="cerrarSesion()">🔒 Cerrar Sesión</button>

  <!-- Calendario -->
  <div id="calendario" class="section active">
    <h1>Calendario General</h1>
    <button class="btn" onclick="openModal()">➕ Añadir Evento/Evaluación</button>
    <div id="calendar"></div>
  </div>

  <!-- Aceptados -->
  <div id="aceptados" class="section">
    <h1>Alumnos Aceptados</h1>
    <table id="aceptadosTable">
      <thead>
        <tr><th>Nombre</th><th>RUT</th><th>Fecha Nacimiento</th><th>Correo</th><th>Teléfono</th><th>Curso</th><th>Acciones</th></tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>

  <!-- Cursos -->
  <div id="cursos" class="section">
    <h1>Cursos</h1>
    <button class="btn" onclick="nuevoCurso()">➕ Añadir Curso</button>
    <table id="cursosTable">
      <thead><tr><th>Nombre</th><th>Profesor a cargo</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <!-- Profesores -->
  <div id="profesores" class="section">
    <h1>Profesores</h1>
    <button class="btn" onclick="nuevoProfesor()">➕ Añadir Profesor</button>
    <table id="profesoresTable">
      <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <!-- Imágenes -->
  <div id="imagenes" class="section">
    <h1>Gestión de Imágenes</h1>
    <form id="imageUploadForm">
      <label for="grupo">Grupo:</label>
      <select id="grupo" name="grupo" onchange="toggleAlbumOptions()">
        <option value="public">Público</option>
        <option value="private">Privado</option>
      </select>

      <div id="albumOptions" style="margin-top: 10px; display: none;">
        <label for="albumSelect">Álbum existente:</label>
        <select id="albumSelect"><option value="">-- Selecciona --</option></select>
        <br>
        <label for="nuevoAlbum">O crear nuevo álbum:</label>
        <input type="text" id="nuevoAlbum" placeholder="Nombre del nuevo álbum" />
      </div>

      <div style="margin-top: 10px;">
        <label for="imagenesInput">Seleccionar imágenes:</label>
        <input type="file" id="imagenesInput" multiple accept="image/*" />
      </div>

      <button type="submit" class="btn" style="margin-top: 10px;">📤 Subir Imágenes</button>
    </form>
    <div id="uploadStatus" style="margin-top: 15px;"></div>
  </div>

  <!-- Usuarios -->
  <div id="usuarios" class="section">
    <h1>Gestión de Usuarios</h1>
    <form id="userForm">
      <label for="rut">RUT</label>
      <input type="text" id="rut" required>
      <label for="email">Correo</label>
      <input type="email" id="email" required>
      <label for="group">Grupo</label>
      <select id="group" required>
        <option value="admin">Admin</option>
        <option value="profesor">Profesor</option>
        <option value="fono">Fono</option>
        <option value="alumno">Alumno</option>
      </select>
      <button type="submit" class="btn">➕ Crear Usuario</button>
    </form>
    <div id="userStatus" style="margin-top:15px;"></div>
  </div>
</main>

<!-- Modal eventos -->
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
        <option value="medio-mayor">Medio Mayor</option>
        <option value="prekinder-a">Prekínder A</option>
        <option value="prekinder-b">Prekínder B</option>
        <option value="kinder">Kínder</option>
        <option value="extension">Extensión Horaria</option>
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
const aceptadosUrl = '/prod/aceptados';
const cursosUrl = '/prod/cursos';
const profesoresUrl = '/prod/profesores';
const imagenesUrl = '/prod/imagenes';
const crearUsuarioUrl = '/prod/crear-usuario';

function showSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function cerrarSesion() { window.location.href = '/prod'; }

// ----------------------
// Formulario usuarios
// ----------------------
document.getElementById("userForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const rut = document.getElementById("rut").value.trim();
  const email = document.getElementById("email").value.trim();
  const group = document.getElementById("group").value;
  const statusDiv = document.getElementById("userStatus");
  statusDiv.innerText = "Creando usuario...";

  try {
    const res = await fetch(crearUsuarioUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut, email, group })
    });
    const data = await res.json();
    if (res.ok) {
      statusDiv.innerText = "✅ Usuario creado con éxito en el grupo " + group;
    } else {
      statusDiv.innerText = "❌ Error: " + (data.error || data.message);
    }
  } catch(err) {
    statusDiv.innerText = "❌ Error: " + err.message;
  }
});

// ----------------------
// Carga inicial
// ----------------------
async function loadAceptados() {
  const res = await fetch(aceptadosUrl);
  const data = await res.json();
  const tbody = document.querySelector("#aceptadosTable tbody");
  tbody.innerHTML = '';
  data.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td>\${m.nombre}</td>
      <td>\${m.rut}</td>
      <td>\${m.fechaNacimiento}</td>
      <td>\${m.correo}</td>
      <td>\${m.telefono}</td>
      <td>
        <select id="curso-\${m.rut}">
          <option value="medio-mayor">Medio Mayor</option>
          <option value="prekinder-a">Prekínder A</option>
          <option value="prekinder-b">Prekínder B</option>
          <option value="kinder">Kínder</option>
          <option value="extension">Extensión Horaria</option>
        </select>
      </td>
      <td><button class="btn" onclick="crearUsuario('\${m.rut}')">Crear Usuario</button></td>
    \`;
    tbody.appendChild(tr);
  });
}
function crearUsuario(rut) {
  const curso = document.getElementById("curso-" + rut).value;
  alert("⚡ Se crearía usuario en Cognito para " + rut + " en curso: " + curso);
}

async function loadCursos() {
  const res = await fetch(cursosUrl);
  const data = await res.json();
  const tbody = document.querySelector("#cursosTable tbody");
  tbody.innerHTML = '';
  data.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = \`<td>\${c.nombre}</td><td>\${c.profesor || '-'}</td>\`;
    tbody.appendChild(tr);
  });
}
function nuevoCurso() { alert("📚 Agregar curso (pendiente backend)"); }

async function loadProfesores() {
  const res = await fetch(profesoresUrl);
  const data = await res.json();
  const tbody = document.querySelector("#profesoresTable tbody");
  tbody.innerHTML = '';
  data.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = \`<td>\${p.nombre}</td><td>\${p.correo}</td><td>\${p.telefono}</td>\`;
    tbody.appendChild(tr);
  });
}
function nuevoProfesor() { alert("👩‍🏫 Agregar profesor (pendiente backend)"); }

// ----------------------
// FullCalendar
// ----------------------
function openModal() { document.getElementById('modal').style.display = 'block'; }
function closeModal() { 
  document.getElementById('modal').style.display = 'none'; 
  document.getElementById('eventForm').reset(); 
  document.getElementById('eventId').value = ''; 
  document.getElementById('modalTitle').innerText = 'Nuevo Evento/Evaluación'; 
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
         extendedProps: { curso: e.curso, tipo: e.tipo, description: e.descripcion }
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
  loadAceptados();
  loadCursos();
  loadProfesores();
});

// ----------------------
// Subida de imágenes a S3
// ----------------------
const imageUploadForm = document.getElementById('imageUploadForm');
const imagenesInput = document.getElementById('imagenesInput');
const grupoSelect = document.getElementById('grupo');
const albumSelect = document.getElementById('albumSelect');
const nuevoAlbumInput = document.getElementById('nuevoAlbum');
const albumOptions = document.getElementById('albumOptions');
const uploadStatus = document.getElementById('uploadStatus');

function toggleAlbumOptions() {
  albumOptions.style.display = grupoSelect.value === 'private' ? 'block' : 'none';
}

imageUploadForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  if (imagenesInput.files.length === 0) { uploadStatus.innerText = 'No seleccionaste imágenes'; return; }
  const grupo = grupoSelect.value;
  const album = nuevoAlbumInput.value || albumSelect.value || null;
  if (grupo === 'private' && !album) { uploadStatus.innerText = 'Debes seleccionar o crear un álbum para imágenes privadas'; return; }

  uploadStatus.innerText = 'Subiendo imágenes...';
  const files = Array.from(imagenesInput.files);
  const resultados = [];

  for (const file of files) {
    const reader = new FileReader();
    resultados.push(new Promise((resolve, reject) => {
      reader.onload = async function () {
        try {
          const body = { imageName: file.name, imageData: reader.result, grupo: grupo, album: album || null };
          const res = await fetch(imagenesUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const data = await res.json();
          resolve(file.name + ' → ' + data.message);
        } catch (err) { reject(file.name + ' → Error: ' + err.message); }
      };
      reader.onerror = () => reject('Error leyendo archivo ' + file.name);
      reader.readAsDataURL(file);
    }));
  }

  try {
    const results = await Promise.allSettled(resultados);
    uploadStatus.innerHTML = results.map(r => r.status === 'fulfilled' ? r.value : r.reason).join('<br>');
    imageUploadForm.reset();
    toggleAlbumOptions();
  } catch (err) {
    uploadStatus.innerText = 'Error al subir las imágenes: ' + err.message;
  }
});
</script>
</body>
</html>
  `;
  return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html };
};
