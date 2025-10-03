let calendar;
// Obtener el prefijo de configuración (inyectado por el servidor)
const PREFIX = window.APP_CONFIG?.CALLBACK_PREFIX ?? '';

const apiUrl = `${PREFIX}/eventos`;
const aceptadosUrl = `${PREFIX}/aceptados`;
const cursosUrl = `${PREFIX}/cursos`;
const profesoresUrl = `${PREFIX}/profesores`;
const imagenesUrl = `${PREFIX}/imagenes`;
const crearUsuarioUrl = `${PREFIX}/crear-usuario`;
const notificacionesUrl = window.location.origin + '/notificaciones';
const matriculasUrl = window.location.origin + '/matriculas';
const anunciosUrl = window.location.origin + '/anuncios';
const usuariosUrl = window.location.origin + '/usuarios';

function showSection(id) {
  // Ocultar todas las secciones
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));

  // Mostrar la sección seleccionada
  const section = document.getElementById(id);
  if (section) {
    section.classList.add('active');
  }

  // Remover clase active de todos los enlaces del menú
  document.querySelectorAll('.sidebar-menu a').forEach(link => link.classList.remove('active'));

  // Agregar clase active al enlace clickeado
  const activeLink = document.querySelector(`.sidebar-menu a[onclick*="${id}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

function cerrarSesion() {
  window.location.href = PREFIX;
}

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
    tr.innerHTML = `
      <td>${m.nombre}</td>
      <td>${m.rut}</td>
      <td>${m.fechaNacimiento}</td>
      <td>${m.correo}</td>
      <td>${m.telefono}</td>
      <td>
        <select id="curso-${m.rut}">
          <option value="medio-mayor">Medio Mayor</option>
          <option value="prekinder-a">Prekínder A</option>
          <option value="prekinder-b">Prekínder B</option>
          <option value="kinder">Kínder</option>
          <option value="extension">Extensión Horaria</option>
        </select>
      </td>
      <td><button class="btn" onclick="crearUsuarioAceptado('${m.rut}')">Crear Usuario</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function crearUsuarioAceptado(rut) {
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
    tr.innerHTML = `<td>${c.nombre}</td><td>${c.profesor || '-'}</td>`;
    tbody.appendChild(tr);
  });
}

function nuevoCurso() {
  alert("📚 Agregar curso (pendiente backend)");
}

async function loadProfesores() {
  const res = await fetch(profesoresUrl);
  const data = await res.json();
  const tbody = document.querySelector("#profesoresTable tbody");
  tbody.innerHTML = '';
  data.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.nombre}</td><td>${p.correo}</td><td>${p.telefono}</td>`;
    tbody.appendChild(tr);
  });
}

function nuevoProfesor() {
  alert("👩‍🏫 Agregar profesor (pendiente backend)");
}

// ----------------------
// FullCalendar
// ----------------------
function openModal() {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal').classList.remove('show');
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('modalTitle').innerText = 'Nuevo Evento/Evaluación';
}

document.getElementById('eventForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const eventId = document.getElementById('eventId').value;
  const titulo = document.getElementById('tituloEvento').value;
  const descripcion = document.getElementById('descripcion').value;
  const fecha = document.getElementById('fecha').value;
  const hora = document.getElementById('hora').value;
  const tipo = document.getElementById('tipo').value;
  const curso = document.getElementById('curso').value;

  const eventoData = { titulo, descripcion, fecha, hora, tipo, curso };

  try {
    let res;
    if (eventId) {
      res = await fetch(`${apiUrl}?id=${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventoData)
      });
    } else {
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
    const res = await fetch(`${apiUrl}?id=${eventId}`, {
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
    editable: true,
    selectable: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: async function(fetchInfo, successCallback, failureCallback) {
      try {
        const res = await fetch(apiUrl);
        const eventos = await res.json();
        successCallback(eventos.map(e => ({
          id: e.id,
          title: e.titulo,
          start: e.fecha + (e.hora ? 'T' + e.hora : ''),
          extendedProps: {
            curso: e.curso,
            tipo: e.tipo,
            description: e.descripcion
          }
        })));
      } catch(err) {
        console.error(err);
        failureCallback(err);
      }
    },
    select: function(info) {
      document.getElementById('eventId').value = '';
      document.getElementById('tituloEvento').value = '';
      document.getElementById('descripcion').value = '';
      document.getElementById('fecha').value = info.startStr;
      document.getElementById('hora').value = '';
      document.getElementById('tipo').value = 'evento';
      document.getElementById('curso').value = 'todos';
      document.getElementById('modalTitle').innerText = 'Nuevo Evento/Evaluación';
      openModal();
    },
    eventClick: function(info) {
      const e = info.event;
      document.getElementById('eventId').value = e.id;
      document.getElementById('tituloEvento').value = e.title;
      document.getElementById('descripcion').value = e.extendedProps.description || '';
      document.getElementById('fecha').value = e.startStr.split('T')[0];
      document.getElementById('hora').value = e.startStr.split('T')[1]?.substring(0, 5) || '';
      document.getElementById('tipo').value = e.extendedProps.tipo || 'evento';
      document.getElementById('curso').value = e.extendedProps.curso || 'todos';
      document.getElementById('modalTitle').innerText = 'Editar Evento/Evaluación';
      openModal();
    },
    eventDrop: async function(info) {
      const eventoId = info.event.id;
      const nuevaFecha = info.event.startStr.split('T')[0];

      if (!confirm('¿Mover este evento a ' + nuevaFecha + '?')) {
        info.revert();
        return;
      }

      try {
        const res = await fetch(`${apiUrl}?id=${eventoId}`, {
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
  cargarAnuncios();
});

// ----------------------
// Gestión de Anuncios
// ----------------------
async function cargarAnuncios() {
  try {
    const res = await fetch(anunciosUrl);
    const anuncios = await res.json();

    document.getElementById('listaAnuncios').innerHTML = anuncios.map(a => `
      <div class="card">
        <h3>${a.titulo}</h3>
        <p>${a.contenido}</p>
        <small style="color: #666;">
          Para: <strong>${a.destinatarios}</strong> |
          Fecha: ${new Date(a.fecha).toLocaleDateString()} |
          Autor: ${a.autor}
        </small>
        <div style="margin-top: 15px;">
          <button class="btn btn-danger" onclick="eliminarAnuncio('${a.id}')">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
      </div>
    `).join('');
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
    await fetch(`${anunciosUrl}?id=${id}`, { method: 'DELETE' });
    cargarAnuncios();
    alert('Anuncio eliminado');
  } catch(err) {
    console.error('Error eliminando anuncio:', err);
    alert('Error al eliminar el anuncio');
  }
}

// ----------------------
// Gestión de Usuarios
// ----------------------
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
          <button class="btn btn-secondary" onclick="editarUsuario('${u.rut}')">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-danger" onclick="eliminarUsuario('${u.rut}')">
            <i class="fas fa-trash"></i> Eliminar
          </button>
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
      alert(`Usuario creado exitosamente.\n\nPassword temporal: ${passwordTemporal}\n\nNOTA: Guarda este password, el usuario debe cambiarlo en su primer inicio de sesión.`);
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
    const res = await fetch(`${usuariosUrl}?rut=${encodeURIComponent(rut)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nuevoNombre,
        telefono: nuevoTelefono || '',
        rol: 'alumno'
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
  if (!confirm(`¿Estás seguro de eliminar el usuario con RUT ${rut}?\n\nEsto desactivará el usuario.`)) return;

  try {
    const res = await fetch(`${usuariosUrl}?rut=${encodeURIComponent(rut)}`, {
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

if (document.getElementById('usuarios')) {
  cargarUsuarios();
}

// ----------------------
// Notificaciones
// ----------------------
document.getElementById('notifForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const destinatarios = document.getElementById('destNotif').value;
  const asunto = document.getElementById('asuntoNotif').value;
  const mensaje = document.getElementById('mensajeNotif').value;
  const statusDiv = document.getElementById('notifStatus');

  if (!asunto || !mensaje) {
    alert('Por favor completa todos los campos');
    return;
  }

  statusDiv.style.display = 'block';
  statusDiv.style.background = '#fff3cd';
  statusDiv.style.color = '#856404';
  statusDiv.innerHTML = '📤 Enviando emails, por favor espera...';

  try {
    const res = await fetch(notificacionesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinatarios,
        asunto,
        mensaje
      })
    });

    const data = await res.json();

    if (res.ok) {
      statusDiv.style.background = '#d4edda';
      statusDiv.style.color = '#155724';
      statusDiv.innerHTML = `
        ✅ <strong>Emails enviados exitosamente</strong><br>
        📧 Enviados: ${data.enviados}<br>
        ${data.errores > 0 ? `⚠️ Errores: ${data.errores}` : ''}
      `;

      document.getElementById('notifForm').reset();

      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 10000);
    } else {
      statusDiv.style.background = '#f8d7da';
      statusDiv.style.color = '#721c24';
      statusDiv.innerHTML = `❌ <strong>Error al enviar emails:</strong><br>${data.error || 'Error desconocido'}`;
    }
  } catch(err) {
    console.error('Error enviando notificación:', err);
    statusDiv.style.background = '#f8d7da';
    statusDiv.style.color = '#721c24';
    statusDiv.innerHTML = `❌ <strong>Error al enviar emails:</strong><br>${err.message}`;
  }
});

// ----------------------
// Matrículas
// ----------------------
async function cargarMatriculas() {
  try {
    const res = await fetch(matriculasUrl);
    const matriculas = await res.json();

    const container = document.getElementById('listaMatriculas');
    container.innerHTML = matriculas.map(m => `
      <div class="card" style="border-left: 4px solid ${m.estado === 'pendiente' ? 'orange' : m.estado === 'aprobada' ? 'green' : 'red'};">
        <h3>${m.nombre}</h3>
        <p><strong>RUT:</strong> ${m.rut}</p>
        <p><strong>Fecha Nacimiento:</strong> ${m.fechaNacimiento}</p>
        <p><strong>Último Curso:</strong> ${m.ultimoCurso}</p>
        <p><strong>Email:</strong> ${m.correo} | <strong>Tel:</strong> ${m.telefono}</p>
        <p><strong>Fecha Registro:</strong> ${new Date(m.fechaRegistro).toLocaleDateString()}</p>
        <p><strong>Estado:</strong> <span class="badge ${m.estado}">${m.estado.toUpperCase()}</span></p>
        ${m.motivo ? `<p><strong>Motivo:</strong> ${m.motivo}</p>` : ''}
        ${m.estado === 'pendiente' ? `
          <div style="margin-top: 15px;">
            <button class="btn btn-success" onclick="aprobarMatricula('${m.id}')">
              <i class="fas fa-check"></i> Aprobar
            </button>
            <button class="btn btn-danger" onclick="rechazarMatricula('${m.id}')">
              <i class="fas fa-times"></i> Rechazar
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch(err) {
    console.error('Error cargando matrículas:', err);
  }
}

async function aprobarMatricula(id) {
  if (!confirm('¿Aprobar esta matrícula?')) return;

  try {
    const res = await fetch(`${matriculasUrl}?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'aprobada' })
    });

    if (res.ok) {
      alert('Matrícula aprobada correctamente');
      cargarMatriculas();
    } else {
      alert('Error al aprobar matrícula');
    }
  } catch(err) {
    console.error('Error aprobando matrícula:', err);
    alert('Error al aprobar matrícula');
  }
}

async function rechazarMatricula(id) {
  const motivo = prompt('Motivo del rechazo:');
  if (!motivo) return;

  try {
    const res = await fetch(`${matriculasUrl}?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'rechazada',
        motivo
      })
    });

    if (res.ok) {
      alert('Matrícula rechazada');
      cargarMatriculas();
    } else {
      alert('Error al rechazar matrícula');
    }
  } catch(err) {
    console.error('Error rechazando matrícula:', err);
    alert('Error al rechazar matrícula');
  }
}

if (document.getElementById('matriculas')) {
  cargarMatriculas();
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
  if (imagenesInput.files.length === 0) {
    uploadStatus.innerText = 'No seleccionaste imágenes';
    return;
  }
  const grupo = grupoSelect.value;
  const album = nuevoAlbumInput.value || albumSelect.value || null;
  if (grupo === 'private' && !album) {
    uploadStatus.innerText = 'Debes seleccionar o crear un álbum para imágenes privadas';
    return;
  }

  uploadStatus.innerText = 'Subiendo imágenes...';
  const files = Array.from(imagenesInput.files);
  const resultados = [];

  for (const file of files) {
    const reader = new FileReader();
    resultados.push(new Promise((resolve, reject) => {
      reader.onload = async function () {
        try {
          const body = {
            imageName: file.name,
            imageData: reader.result,
            grupo: grupo,
            album: album || null
          };
          const res = await fetch(imagenesUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const data = await res.json();
          resolve(file.name + ' → ' + data.message);
        } catch (err) {
          reject(file.name + ' → Error: ' + err.message);
        }
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
