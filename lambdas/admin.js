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
    <li onclick="showSection('anuncios')">📢 Anuncios</li>
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

  <!-- Anuncios (Commit 1.1.4) -->
  <div id="anuncios" class="section">
    <h1>📢 Gestión de Anuncios</h1>
    <form id="anuncioForm" style="margin-bottom: 20px;">
      <input type="text" id="titulo" placeholder="Título" required style="width: 100%; padding: 8px; margin-bottom: 10px;">
      <textarea id="contenido" placeholder="Contenido del anuncio" required style="width: 100%; padding: 8px; margin-bottom: 10px; height: 100px;"></textarea>
      <select id="destinatarios" style="padding: 8px; margin-right: 10px;">
        <option value="todos">Todos</option>
        <option value="profesores">Solo Profesores</option>
        <option value="alumnos">Solo Alumnos</option>
      </select>
      <button type="submit" class="btn">Publicar Anuncio</button>
    </form>

    <h2>Anuncios Publicados</h2>
    <div id="listaAnuncios"></div>
  </div>

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

  <!-- Usuarios (Commit 1.2.4) -->
  <div id="usuarios" class="section">
    <h1>👥 Gestión de Usuarios</h1>
    <button class="btn" onclick="mostrarFormularioUsuario()">➕ Nuevo Usuario</button>

    <div id="formUsuario" style="display:none; background: #f9f9f9; padding: 15px; margin: 15px 0; border-radius: 5px;">
      <h3>Crear Nuevo Usuario</h3>
      <input type="text" id="rutUsuario" placeholder="RUT (ej: 12345678-9)" required style="width: 100%; padding: 8px; margin-bottom: 10px;">
      <input type="text" id="nombreUsuario" placeholder="Nombre completo" required style="width: 100%; padding: 8px; margin-bottom: 10px;">
      <input type="email" id="correoUsuario" placeholder="Email" required style="width: 100%; padding: 8px; margin-bottom: 10px;">
      <input type="tel" id="telefonoUsuario" placeholder="Teléfono" style="width: 100%; padding: 8px; margin-bottom: 10px;">
      <select id="rolUsuario" style="width: 100%; padding: 8px; margin-bottom: 10px;">
        <option value="admin">Administrador</option>
        <option value="profesor">Profesor</option>
        <option value="fono">Fonoaudiólogo</option>
        <option value="alumno">Alumno/Apoderado</option>
      </select>
      <button class="btn" onclick="crearUsuario()">Guardar Usuario</button>
      <button class="btn" style="background: #999;" onclick="ocultarFormularioUsuario()">Cancelar</button>
    </div>

    <h2>Lista de Usuarios</h2>
    <table id="tablaUsuarios">
      <thead>
        <tr>
          <th>RUT</th>
          <th>Nombre</th>
          <th>Email</th>
          <th>Teléfono</th>
          <th>Rol</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
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

// Commit 1.3.3: Handler para crear/editar eventos
document.getElementById('eventForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const eventId = document.getElementById('eventId').value;
  const titulo = document.getElementById('titulo').value;
  const descripcion = document.getElementById('descripcion').value;
  const fecha = document.getElementById('fecha').value;
  const hora = document.getElementById('hora').value;
  const tipo = document.getElementById('tipo').value;
  const curso = document.getElementById('curso').value;

  const eventoData = { titulo, descripcion, fecha, hora, tipo, curso };

  try {
    let res;
    if (eventId) {
      // Editar evento existente
      res = await fetch(\`\${apiUrl}?id=\${eventId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventoData)
      });
    } else {
      // Crear nuevo evento
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventoData)
      });
    }

    if (res.ok) {
      alert(eventId ? 'Evento actualizado correctamente' : 'Evento creado correctamente');
      closeModal();
      calendar.refetchEvents();
    } else {
      const error = await res.json();
      alert('Error: ' + (error.error || 'No se pudo guardar el evento'));
    }
  } catch(err) {
    console.error('Error guardando evento:', err);
    alert('Error al guardar el evento');
  }
});

async function deleteEvent() {
  const eventId = document.getElementById('eventId').value;
  if (!eventId) {
    alert('No hay evento seleccionado para eliminar');
    return;
  }

  if (!confirm('¿Estás seguro de eliminar este evento?')) return;

  try {
    const res = await fetch(\`\${apiUrl}?id=\${eventId}\`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('Evento eliminado correctamente');
      closeModal();
      calendar.refetchEvents();
    } else {
      alert('Error al eliminar el evento');
    }
  } catch(err) {
    console.error('Error eliminando evento:', err);
    alert('Error al eliminar el evento');
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    height: 600,
    editable: true,  // Commit 1.3.3: Permitir arrastrar eventos
    selectable: true,  // Commit 1.3.3: Permitir seleccionar rango de fechas
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
    // Commit 1.3.3: Seleccionar rango para crear evento
    select: function(info) {
      document.getElementById('eventId').value = '';
      document.getElementById('titulo').value = '';
      document.getElementById('descripcion').value = '';
      document.getElementById('fecha').value = info.startStr;
      document.getElementById('hora').value = '';
      document.getElementById('tipo').value = 'evento';
      document.getElementById('curso').value = 'todos';
      document.getElementById('modalTitle').innerText = 'Nuevo Evento/Evaluación';
      openModal();
    },
    // Commit 1.3.3: Click en evento para editar
    eventClick: function(info) {
      const e = info.event;
      document.getElementById('eventId').value = e.id;
      document.getElementById('titulo').value = e.title;
      document.getElementById('descripcion').value = e.extendedProps.description || '';
      document.getElementById('fecha').value = e.startStr.split('T')[0];
      document.getElementById('hora').value = e.startStr.split('T')[1]?.substring(0, 5) || '';
      document.getElementById('tipo').value = e.extendedProps.tipo || 'evento';
      document.getElementById('curso').value = e.extendedProps.curso || 'todos';
      document.getElementById('modalTitle').innerText = 'Editar Evento/Evaluación';
      openModal();
    },
    // Commit 1.3.3: Arrastrar evento para cambiar fecha
    eventDrop: async function(info) {
      const eventoId = info.event.id;
      const nuevaFecha = info.event.startStr.split('T')[0];

      if (!confirm('¿Mover este evento a ' + nuevaFecha + '?')) {
        info.revert();
        return;
      }

      try {
        const res = await fetch(\`\${apiUrl}?id=\${eventoId}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: info.event.title,
            descripcion: info.event.extendedProps.description || '',
            fecha: nuevaFecha,
            hora: info.event.startStr.split('T')[1]?.substring(0, 5) || '',
            tipo: info.event.extendedProps.tipo,
            curso: info.event.extendedProps.curso
          })
        });

        if (res.ok) {
          alert('Evento actualizado correctamente');
        } else {
          alert('Error al actualizar evento');
          info.revert();
        }
      } catch(err) {
        console.error('Error moviendo evento:', err);
        alert('Error al mover el evento');
        info.revert();
      }
    }
  });
  calendar.render();
  loadAceptados();
  loadCursos();
  loadProfesores();
  cargarAnuncios(); // Cargar anuncios al iniciar
});

// ----------------------
// Gestión de Anuncios (Commit 1.1.4)
// ----------------------
const anunciosUrl = window.location.origin + '/anuncios';

async function cargarAnuncios() {
  try {
    const res = await fetch(anunciosUrl);
    const anuncios = await res.json();

    document.getElementById('listaAnuncios').innerHTML = anuncios.map(a => \`
      <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px;">
        <h3 style="margin-top: 0;">\${a.titulo}</h3>
        <p>\${a.contenido}</p>
        <small style="color: #666;">
          Para: <strong>\${a.destinatarios}</strong> |
          Fecha: \${new Date(a.fecha).toLocaleDateString()} |
          Autor: \${a.autor}
        </small>
        <button class="btn" style="background: #c00; margin-top: 10px;" onclick="eliminarAnuncio('\${a.id}')">🗑️ Eliminar</button>
      </div>
    \`).join('');
  } catch(err) {
    console.error('Error cargando anuncios:', err);
  }
}

document.getElementById('anuncioForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    await fetch(anunciosUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: document.getElementById('titulo').value,
        contenido: document.getElementById('contenido').value,
        destinatarios: document.getElementById('destinatarios').value,
        autor: 'Admin'
      })
    });

    document.getElementById('anuncioForm').reset();
    cargarAnuncios();
    alert('Anuncio publicado exitosamente');
  } catch(err) {
    console.error('Error publicando anuncio:', err);
    alert('Error al publicar el anuncio');
  }
});

async function eliminarAnuncio(id) {
  if (!confirm('¿Estás seguro de eliminar este anuncio?')) return;

  try {
    await fetch(\`\${anunciosUrl}?id=\${id}\`, { method: 'DELETE' });
    cargarAnuncios();
    alert('Anuncio eliminado');
  } catch(err) {
    console.error('Error eliminando anuncio:', err);
    alert('Error al eliminar el anuncio');
  }
}

// ----------------------
// Gestión de Usuarios (Commit 1.2.4)
// ----------------------
const usuariosUrl = window.location.origin + '/usuarios';

function mostrarFormularioUsuario() {
  document.getElementById('formUsuario').style.display = 'block';
}

function ocultarFormularioUsuario() {
  document.getElementById('formUsuario').style.display = 'none';
  document.getElementById('rutUsuario').value = '';
  document.getElementById('nombreUsuario').value = '';
  document.getElementById('correoUsuario').value = '';
  document.getElementById('telefonoUsuario').value = '';
  document.getElementById('rolUsuario').value = 'alumno';
}

async function cargarUsuarios() {
  try {
    const res = await fetch(usuariosUrl);
    const usuarios = await res.json();

    const tbody = document.querySelector('#tablaUsuarios tbody');
    tbody.innerHTML = usuarios.map(u => `
      <tr>
        <td>${u.rut}</td>
        <td>${u.nombre}</td>
        <td>${u.correo}</td>
        <td>${u.telefono || '-'}</td>
        <td>${u.rol}</td>
        <td>
          <button class="btn" onclick="editarUsuario('${u.rut}')">✏️ Editar</button>
          <button class="btn" style="background: #c00;" onclick="eliminarUsuario('${u.rut}')">🗑️ Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch(err) {
    console.error('Error cargando usuarios:', err);
  }
}

async function crearUsuario() {
  const rut = document.getElementById('rutUsuario').value;
  const nombre = document.getElementById('nombreUsuario').value;
  const correo = document.getElementById('correoUsuario').value;
  const telefono = document.getElementById('telefonoUsuario').value;
  const rol = document.getElementById('rolUsuario').value;

  if (!rut || !nombre || !correo) {
    alert('Por favor completa todos los campos obligatorios');
    return;
  }

  try {
    // Generar password temporal de 8 caracteres
    const passwordTemporal = Math.random().toString(36).slice(-8).toUpperCase();

    const res = await fetch(usuariosUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rut,
        nombre,
        correo,
        telefono,
        rol,
        passwordTemporal
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert(\`Usuario creado exitosamente.\\n\\nPassword temporal: \${passwordTemporal}\\n\\nNOTA: Guarda este password, el usuario debe cambiarlo en su primer inicio de sesión.\`);
      ocultarFormularioUsuario();
      cargarUsuarios();
    } else {
      alert('Error al crear usuario: ' + (data.error || 'Error desconocido'));
    }
  } catch(err) {
    console.error('Error creando usuario:', err);
    alert('Error al crear usuario: ' + err.message);
  }
}

async function editarUsuario(rut) {
  const nuevoNombre = prompt('Nuevo nombre:');
  const nuevoTelefono = prompt('Nuevo teléfono:');

  if (!nuevoNombre) return;

  try {
    const res = await fetch(\`\${usuariosUrl}?rut=\${encodeURIComponent(rut)}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nuevoNombre,
        telefono: nuevoTelefono || '',
        rol: 'alumno' // Por simplicidad, mantener rol actual
      })
    });

    if (res.ok) {
      alert('Usuario actualizado correctamente');
      cargarUsuarios();
    } else {
      alert('Error al actualizar usuario');
    }
  } catch(err) {
    console.error('Error editando usuario:', err);
    alert('Error al editar usuario: ' + err.message);
  }
}

async function eliminarUsuario(rut) {
  if (!confirm(\`¿Estás seguro de eliminar el usuario con RUT \${rut}?\\n\\nEsto desactivará el usuario.\`)) return;

  try {
    const res = await fetch(\`\${usuariosUrl}?rut=\${encodeURIComponent(rut)}\`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('Usuario desactivado correctamente');
      cargarUsuarios();
    } else {
      alert('Error al eliminar usuario');
    }
  } catch(err) {
    console.error('Error eliminando usuario:', err);
    alert('Error al eliminar usuario: ' + err.message);
  }
}

// Cargar usuarios al mostrar la sección
if (document.getElementById('usuarios')) {
  cargarUsuarios();
}

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
