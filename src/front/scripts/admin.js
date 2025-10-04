// Proteger la página - verificar autenticación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  if (typeof requireAuth === 'function' && !requireAuth()) {
    // requireAuth ya redirige si no está autenticado, detener ejecución
    return;
  }
});

let calendar;
// Obtener el prefijo de configuración (inyectado por el servidor)
const PREFIX = window.APP_CONFIG?.API_URL || '';

// Endpoints V3.0 - Lambdas consolidados
const anunciosUrl = `${PREFIX}/anuncios`; // ✅ CORREGIDO: era /comunicaciones
const eventosUrl = `${PREFIX}/eventos`; // ✅ CORREGIDO: era /comunicaciones
const matriculasUrl = `${PREFIX}/matriculas`; // ✅ Usado para aceptados con ?estado=aprobada
const galeriaUrl = `${PREFIX}/imagenes`; // ✅ CORREGIDO: era /galeria
const notificacionesUrl = `${PREFIX}/notificaciones`;
const usuariosUrl = `${PREFIX}/usuarios`; // ✅ Usado para profesores con ?rol=profesor
const categoriasUrl = `${PREFIX}/categorias`; // ✅ CORREGIDO: era /recursos-academicos/categorias
const materialesUrl = `${PREFIX}/materiales`; // ✅ CORREGIDO: era /recursos-academicos/materiales
const notasUrl = `${PREFIX}/notas`; // ✅ CORREGIDO: era /recursos-academicos/notas
const configuracionUrl = `${PREFIX}/configuracion`;
const retroalimentacionUrl = `${PREFIX}/retroalimentacion`;
const asistenciaUrl = `${PREFIX}/asistencia`;

// ==============================================
// BÚSQUEDA GLOBAL (CU-38, 39, 40)
// ==============================================

let searchTimeout;

// Inicializar búsqueda global
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();

      if (query.length < 2) {
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('searchResults').style.display = 'none';
        return;
      }

      searchTimeout = setTimeout(() => {
        busquedaGlobal(query);
      }, 300); // Debounce 300ms
    });

    // Cerrar resultados al hacer click fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.global-search')) {
        document.getElementById('searchResults').style.display = 'none';
      }
    });
  }
});

async function busquedaGlobal(query) {
  try {
    // Admin puede buscar en todas las categorías
    const resultados = [];

    // ✅ CORREGIDO: Búsqueda implementada localmente (endpoint /busqueda no existe)
    try {
      // Buscar en usuarios
      const resUsuarios = await fetch(usuariosUrl);
      const usuarios = await resUsuarios.json();
      const usuariosFiltrados = usuarios.filter(u =>
        u.nombre?.toLowerCase().includes(query.toLowerCase()) ||
        u.rut?.includes(query) ||
        u.correo?.toLowerCase().includes(query.toLowerCase())
      );

      if (usuariosFiltrados.length > 0) {
        resultados.push({
          tipo: 'usuarios',
          items: usuariosFiltrados.slice(0, 5)
        });
      }

      // Buscar en materiales
      const resMateriales = await fetch(materialesUrl);
      const dataMateriales = await resMateriales.json();
      const materiales = dataMateriales.materiales || dataMateriales; // ✅ CORREGIDO: Backend retorna wrapper
      const materialesFiltrados = materiales.filter(m =>
        m.titulo?.toLowerCase().includes(query.toLowerCase()) ||
        m.descripcion?.toLowerCase().includes(query.toLowerCase())
      );

      if (materialesFiltrados.length > 0) {
        resultados.push({
          tipo: 'materiales',
          items: materialesFiltrados.slice(0, 5)
        });
      }
    } catch (err) {
      console.warn('Error en búsqueda global:', err);
    }

    renderSearchResults(resultados, query);
  } catch (err) {
    console.error('Error en búsqueda global:', err);
  }
}

function renderSearchResults(resultados, query) {
  const container = document.getElementById('searchResults');

  if (resultados.length === 0) {
    container.innerHTML = '<div class="search-no-results">No se encontraron resultados</div>';
    container.style.display = 'block';
    return;
  }

  let html = '<div class="search-results-container">';

  resultados.forEach(({ tipo, items }) => {
    html += `
      <div class="search-section">
        <h4>${getTipoLabel(tipo)} (${items.length})</h4>
        <ul>
    `;

    items.forEach(item => {
      html += `
        <li onclick="navigateToItem('${tipo}', '${item.id || item.rut}')">
          <i class="${getTipoIcon(tipo)}"></i>
          <div>
            <div class="search-item-title">${getItemLabel(tipo, item)}</div>
            <div class="search-item-subtitle">${getItemSubtitle(tipo, item)}</div>
          </div>
        </li>
      `;
    });

    html += `</ul></div>`;
  });

  html += '</div>';
  container.innerHTML = html;
  container.style.display = 'block';
}

function getTipoLabel(tipo) {
  const labels = {
    'usuarios': 'Usuarios',
    'alumnos': 'Alumnos',
    'materiales': 'Materiales',
    'notas': 'Notas'
  };
  return labels[tipo] || tipo;
}

function getTipoIcon(tipo) {
  const icons = {
    'usuarios': 'fas fa-user',
    'alumnos': 'fas fa-user-graduate',
    'materiales': 'fas fa-file',
    'notas': 'fas fa-star'
  };
  return icons[tipo] || 'fas fa-circle';
}

function getItemLabel(tipo, item) {
  if (tipo === 'usuarios' || tipo === 'alumnos') {
    return item.nombre;
  } else if (tipo === 'materiales') {
    return item.titulo;
  } else if (tipo === 'notas') {
    return item.nombreAlumno;
  }
  return 'Sin título';
}

function getItemSubtitle(tipo, item) {
  if (tipo === 'usuarios' || tipo === 'alumnos') {
    return `${item.rut} - ${item.rol}`;
  } else if (tipo === 'materiales') {
    return `${item.curso} - ${item.asignatura}`;
  } else if (tipo === 'notas') {
    return `${item.asignatura} - ${item.nivelLogro}`;
  }
  return '';
}

function navigateToItem(tipo, id) {
  // Cerrar dropdown
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('globalSearchInput').value = '';

  if (tipo === 'usuarios' || tipo === 'alumnos') {
    showSection('usuarios');
    setTimeout(() => {
      // Highlight el usuario en la tabla
      const rows = document.querySelectorAll('#tablaUsuarios tbody tr');
      rows.forEach(row => {
        if (row.textContent.includes(id)) {
          row.style.background = '#fff3cd';
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            row.style.background = '';
          }, 3000);
        }
      });
    }, 300);
  } else if (tipo === 'materiales') {
    showSection('materiales');
    // Podríamos cargar los materiales filtrados
  }
}

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

  // Cargar datos específicos según la sección
  if (id === 'configuracion') {
    cargarConfiguracion();
  }
  if (id === 'materiales') {
    cargarMateriales();
  }
  if (id === 'matriculas') {
    cargarMatriculas();
  }
  if (id === 'usuarios') {
    // Mostrar por defecto el tab de usuarios
    showEntityTab('usuarios-tab');
  }
}

// Función para manejar tabs dentro de Gestión de Entidades
function showEntityTab(tabId) {
  // Ocultar todos los tabs
  document.querySelectorAll('.entity-tab').forEach(tab => tab.classList.remove('active'));

  // Mostrar el tab seleccionado
  const tab = document.getElementById(tabId);
  if (tab) {
    tab.classList.add('active');
  }

  // Actualizar botones de tabs
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  // Cargar datos según el tab
  if (tabId === 'usuarios-tab') {
    cargarUsuarios();
  } else if (tabId === 'cursos-tab') {
    cargarCursos();
  } else if (tabId === 'profesores-tab') {
    cargarProfesores();
  } else if (tabId === 'aceptados-tab') {
    cargarAceptados();
  }
}

// cerrarSesion() is now defined in auth.js (shared)

// ----------------------
// Carga inicial
// ----------------------
async function loadAceptados() {
  // ✅ CORREGIDO: usar /matriculas con filtro de estado
  const res = await fetch(`${matriculasUrl}?estado=aprobada`);
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
  // ✅ CORREGIDO: endpoint /cursos no existe, usar datos estáticos o configuración
  const data = [
    '1° Básico', '2° Básico', '3° Básico', '4° Básico',
    '5° Básico', '6° Básico', '7° Básico', '8° Básico'
  ];
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
  // ✅ CORREGIDO: usar /usuarios con filtro por rol
  const res = await fetch(`${usuariosUrl}?rol=profesor`);
  const allUsers = await res.json();
  const data = allUsers.filter(u => u.rol === 'profesor');
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
  const tipoEvento = document.getElementById('tipo').value;
  const curso = document.getElementById('curso').value;

  // Migrado a /comunicaciones?tipo=evento
  const eventoData = {
    tipo: 'evento',
    titulo,
    descripcion,
    fecha,
    hora,
    tipoEvento,
    curso
  };

  try {
    let res;
    if (eventId) {
      // ✅ CORREGIDO: usar /eventos en lugar de /comunicaciones (timestamp eliminado - no usado por backend)
      res = await fetch(`${eventosUrl}?id=${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventoData)
      });
    } else {
      // ✅ CORREGIDO: usar /eventos en lugar de /comunicaciones
      res = await fetch(eventosUrl, {
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
    // ✅ CORREGIDO: usar /eventos en lugar de /comunicaciones (timestamp eliminado - no usado por backend)
    const res = await fetch(`${eventosUrl}?id=${eventId}`, {
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
        // ✅ CORREGIDO: usar /eventos en lugar de /comunicaciones
        const res = await fetch(eventosUrl);
        const eventos = await res.json();
        successCallback(eventos.map(e => ({
          id: e.id || `${e.tipo}#${e.timestamp}`,
          title: e.titulo,
          start: e.fecha + (e.hora ? 'T' + e.hora : ''),
          extendedProps: {
            curso: e.curso,
            tipo: e.tipoEvento || e.tipo,
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
        // ✅ CORREGIDO: usar /eventos en lugar de /comunicaciones (timestamp eliminado - no usado por backend)
        const res = await fetch(`${eventosUrl}?id=${eventoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'evento',
            titulo: info.event.title,
            descripcion: info.event.extendedProps.description || '',
            fecha: nuevaFecha,
            hora: info.event.startStr.split('T')[1]?.substring(0, 5) || '',
            tipoEvento: info.event.extendedProps.tipo,
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
    // ✅ CORREGIDO: usar /anuncios en lugar de /comunicaciones
    const res = await fetch(anunciosUrl);
    const anuncios = await res.json();

    document.getElementById('listaAnuncios').innerHTML = anuncios.map(a => `
      <div class="card">
        <h3>${a.titulo}</h3>
        <p>${a.contenido}</p>
        <small style="color: #666;">
          Para: <strong>${a.destinatarios}</strong> |
          Fecha: ${new Date(a.fecha).toLocaleDateString()} |
          Autor: ${a.autor || 'Admin'}
        </small>
        <div style="margin-top: 15px;">
          <button class="btn btn-danger" onclick="eliminarAnuncio('${a.id || a.timestamp}')">
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
    // ✅ CORREGIDO: usar /anuncios en lugar de /comunicaciones
    await fetch(anunciosUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'anuncio',
        titulo: document.getElementById('titulo').value,
        contenido: document.getElementById('contenido').value,
        destinatarios: document.getElementById('destinatarios').value,
        autor: 'Admin',
        fecha: new Date().toISOString().split('T')[0]
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
    // ✅ CORREGIDO: usar /anuncios en lugar de /comunicaciones (timestamp eliminado - no usado por backend)
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
        <td>
          <span class="badge" style="background: var(--purple-main); color: white; padding: 4px 12px; border-radius: 12px;">
            ${u.rol}
          </span>
        </td>
        <td>
          <button class="btn-sm btn-primary" onclick="cambiarRolUsuario('${u.rut}', '${u.nombre}', '${u.rol}')" title="Cambiar Rol">
            <i class="fas fa-user-tag"></i>
          </button>
          <button class="btn-sm btn-secondary" onclick="editarUsuario('${u.rut}')" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-sm btn-danger" onclick="eliminarUsuario('${u.rut}')" title="Eliminar">
            <i class="fas fa-trash"></i>
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

// CU-04: Cambiar rol de usuario
async function cambiarRolUsuario(rut, nombre, rolActual) {
  const roles = ['admin', 'profesor', 'fono', 'alumno'];
  const rolesDisponibles = roles.filter(r => r !== rolActual);

  const nuevoRol = prompt(
    `Cambiar rol de ${nombre}\nRol actual: ${rolActual}\n\nSeleccione nuevo rol:\n` +
    rolesDisponibles.map((r, i) => `${i + 1}. ${r}`).join('\n') +
    '\n\nIngrese el número del rol:'
  );

  if (!nuevoRol) return;

  const index = parseInt(nuevoRol) - 1;
  if (isNaN(index) || index < 0 || index >= rolesDisponibles.length) {
    alert('Selección inválida');
    return;
  }

  const rolSeleccionado = rolesDisponibles[index];

  if (!confirm(`¿Confirmar cambio de rol de ${nombre}?\n${rolActual} → ${rolSeleccionado}`)) return;

  try {
    const res = await fetch(`${usuariosUrl}?rut=${encodeURIComponent(rut)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rol: rolSeleccionado })
    });

    if (res.ok) {
      alert(`✅ Rol actualizado: ${rolActual} → ${rolSeleccionado}\n\nEl usuario ahora tiene permisos de: ${rolSeleccionado}`);
      cargarUsuarios();
    } else {
      const error = await res.json();
      alert('Error al cambiar rol: ' + (error.error || error.message));
    }
  } catch(err) {
    console.error('Error cambiando rol:', err);
    alert('Error al cambiar rol: ' + err.message);
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
// Matrículas (COMENTADO - NO HAY RF EXPLÍCITO)
// ----------------------
// NOTA: Esta funcionalidad fue comentada porque no tiene RF explícito en el documento de requisitos.
// Si se decide implementar, agregar RF correspondiente primero.
/*
async function cargarMatriculas() {
  try {
    // Nuevo endpoint unificado: GET /matriculas
    const res = await fetch(matriculasUrl);
    const matriculas = await res.json();

    const container = document.getElementById('listaMatriculas');
    container.innerHTML = matriculas.map(m => `
      <div class="card" style="border-left: 4px solid ${m.estado === 'pendiente' ? 'orange' : m.estado === 'aprobada' ? 'green' : 'red'};">
        <h3>${m.nombre}</h3>
        <p><strong>RUT:</strong> ${m.rut}</p>
        <p><strong>Fecha Nacimiento:</strong> ${m.fechaNacimiento || 'N/A'}</p>
        <p><strong>Último Curso:</strong> ${m.ultimoCurso}</p>
        <p><strong>Email:</strong> ${m.correo} | <strong>Tel:</strong> ${m.telefono}</p>
        <p><strong>Fecha Registro:</strong> ${new Date(m.fechaRegistro || m.timestamp).toLocaleDateString()}</p>
        <p><strong>Estado:</strong> <span class="badge ${m.estado}">${(m.estado || 'pendiente').toUpperCase()}</span></p>
        ${m.motivo ? `<p><strong>Motivo:</strong> ${m.motivo}</p>` : ''}
        ${(m.estado === 'pendiente' || !m.estado) ? `
          <div style="margin-top: 15px;">
            <button class="btn btn-success" onclick="aprobarMatricula('${m.id || m.timestamp}')">
              <i class="fas fa-check"></i> Aprobar
            </button>
            <button class="btn btn-danger" onclick="rechazarMatricula('${m.id || m.timestamp}')">
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
    const res = await fetch(`${matriculasUrl}?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'aprobada', motivo: 'Aprobada por administración' })
    });

    if (res.ok) {
      alert('Matrícula aprobada correctamente. Se enviará email automático.');
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
    const res = await fetch(`${matriculasUrl}?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'rechazada',
        motivo
      })
    });

    if (res.ok) {
      alert('Matrícula rechazada. Se enviará email automático.');
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
*/

// ----------------------
// Subida de imágenes a S3 (COMENTADO - NO HAY RF EXPLÍCITO)
// ----------------------
// NOTA: Esta funcionalidad fue comentada porque no tiene RF explícito en el documento de requisitos.
// Los RF de documentos (RF-TRV-*) se refieren a archivos pedagógicos, no a galería de imágenes.
/*
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
          const res = await fetch(galeriaUrl, {
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
*/

// ========================================
// SUPERVISIÓN DE ASISTENCIA - Admin
// ========================================

async function cargarAsistenciaAdmin() {
  const curso = document.getElementById('adminAsistenciaCurso').value;
  const fechaInicio = document.getElementById('adminAsistenciaFechaInicio').value;
  const fechaFin = document.getElementById('adminAsistenciaFechaFin').value;

  try {
    let url = `${PREFIX}/asistencia?`;

    // Si hay curso, filtrar por curso
    if (curso) {
      url += `curso=${encodeURIComponent(curso)}&`;
    }

    const res = await fetch(url.slice(0, -1)); // Quitar último &
    let registros = await res.json();

    // Filtrar por rango de fechas en front
    if (fechaInicio || fechaFin) {
      registros = registros.filter(r => {
        const fecha = new Date(r.fecha);
        const inicio = fechaInicio ? new Date(fechaInicio) : null;
        const fin = fechaFin ? new Date(fechaFin) : null;

        if (inicio && fin) {
          return fecha >= inicio && fecha <= fin;
        } else if (inicio) {
          return fecha >= inicio;
        } else if (fin) {
          return fecha <= fin;
        }
        return true;
      });
    }

    if (!registros || registros.length === 0) {
      document.getElementById('listaAsistenciaAdmin').innerHTML =
        '<div class="card"><p style="text-align: center;">No hay registros de asistencia para los filtros seleccionados.</p></div>';

      // Resetear resumen
      document.getElementById('adminTotalPresente').textContent = '0';
      document.getElementById('adminTotalAusente').textContent = '0';
      document.getElementById('adminTotalAtrasado').textContent = '0';
      document.getElementById('adminPorcentajeAsistencia').textContent = '0%';
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
    document.getElementById('adminTotalPresente').textContent = totales.presente;
    document.getElementById('adminTotalAusente').textContent = totales.ausente;
    document.getElementById('adminTotalAtrasado').textContent = totales.atrasado;
    document.getElementById('adminPorcentajeAsistencia').textContent = porcentaje + '%';

    // Agrupar por alumno para detectar ausentismo
    const porAlumno = {};
    registros.forEach(r => {
      if (!porAlumno[r.rutAlumno]) {
        porAlumno[r.rutAlumno] = {
          nombre: r.nombreAlumno,
          rut: r.rutAlumno,
          curso: r.curso,
          presente: 0,
          ausente: 0,
          atrasado: 0,
          total: 0
        };
      }
      porAlumno[r.rutAlumno][r.estado]++;
      porAlumno[r.rutAlumno].total++;
    });

    // Mostrar tabla agrupada por alumno
    const html = `
      <div class="card" style="margin-top: 20px;">
        <h3>Detalle por Alumno</h3>
        <table style="width: 100%; margin-top: 15px;">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>RUT</th>
              <th>Curso</th>
              <th>Presente</th>
              <th>Ausente</th>
              <th>Atrasado</th>
              <th>% Asistencia</th>
              <th>Alerta</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(porAlumno).map(a => {
              const porcAsist = a.total > 0 ? ((a.presente / a.total) * 100).toFixed(1) : 0;
              const tieneAlerta = porcAsist < 85; // Alerta si menos de 85%

              return `
                <tr style="${tieneAlerta ? 'background-color: #ffe6e6;' : ''}">
                  <td>${a.nombre}</td>
                  <td>${a.rut}</td>
                  <td>${a.curso}</td>
                  <td><span class="badge-presente">${a.presente}</span></td>
                  <td><span class="badge-ausente">${a.ausente}</span></td>
                  <td><span class="badge-atrasado">${a.atrasado}</span></td>
                  <td><strong>${porcAsist}%</strong></td>
                  <td>${tieneAlerta ? '<span style="color: red;">⚠️ Bajo</span>' : '✅'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('listaAsistenciaAdmin').innerHTML = html;

    // Agregar botones de exportación (CU-18, CU-25)
    agregarBotonesExportacion('listaAsistenciaAdmin', registros, 'asistencia');

  } catch (err) {
    console.error('Error cargando asistencia:', err);
    document.getElementById('listaAsistenciaAdmin').innerHTML =
      '<div class="card"><p style="text-align: center; color: #666;">Error al cargar la asistencia.</p></div>';
  }
}

// CU-18, CU-25: Agregar botones de exportación a reportes
function agregarBotonesExportacion(containerId, datos, tipo) {
  const container = document.getElementById(containerId);
  if (!container || !datos || datos.length === 0) return;

  const botonesHTML = `
    <div class="card" style="margin-top: 20px; background: #f8f9fa;">
      <h4><i class="fas fa-download"></i> Exportar Datos</h4>
      <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
        <button class="btn btn-sm btn-success" onclick="exportarDatos('${tipo}', 'csv')">
          <i class="fas fa-file-csv"></i> CSV
        </button>
        <button class="btn btn-sm btn-success" onclick="exportarDatos('${tipo}', 'excel')">
          <i class="fas fa-file-excel"></i> Excel
        </button>
        <button class="btn btn-sm btn-danger" onclick="exportarDatos('${tipo}', 'pdf')">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', botonesHTML);

  // Guardar datos en variable global para exportación
  window._datosParaExportar = window._datosParaExportar || {};
  window._datosParaExportar[tipo] = datos;
}

// Función global para manejar exportaciones
window.exportarDatos = function(tipo, formato) {
  const datos = window._datosParaExportar?.[tipo];

  if (!datos || datos.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  const filename = `${tipo}_${new Date().toISOString().split('T')[0]}`;

  switch(tipo) {
    case 'asistencia':
      exportarAsistencia(datos, formato, filename);
      break;
    case 'materiales':
      exportarMaterialesAdmin(datos, formato, filename);
      break;
    case 'retroalimentacion':
      exportarRetroalimentacionAdmin(datos, formato, filename);
      break;
    default:
      alert('Tipo de exportación no reconocido');
  }
};

function exportarAsistencia(registros, formato, filename) {
  const data = registros.map(r => ({
    'Alumno': r.nombre || r.nombreAlumno || 'N/A',
    'RUT': r.rut || r.rutAlumno || 'N/A',
    'Curso': r.curso || 'N/A',
    'Fecha': r.fecha || 'N/A',
    'Estado': r.estado || 'N/A',
    'Presente': r.presente || 0,
    'Ausente': r.ausente || 0,
    'Atrasado': r.atrasado || 0,
    'Total': r.total || 0,
    '% Asistencia': r.total > 0 ? ((r.presente / r.total) * 100).toFixed(1) + '%' : '0%'
  }));

  if (formato === 'csv') {
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';
    data.forEach(row => {
      const values = headers.map(h => `"${row[h]}"`);
      csv += values.join(',') + '\n';
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } else if (formato === 'excel') {
    if (window.XLSX) {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } else {
      alert('Librería XLSX no disponible');
    }
  } else if (formato === 'pdf') {
    window.print();
  }
}

function exportarMaterialesAdmin(materiales, formato, filename) {
  const data = materiales.map(m => ({
    'Título': m.titulo || 'N/A',
    'Curso': m.curso || 'N/A',
    'Asignatura': m.asignatura || 'N/A',
    'Profesor': m.profesor || 'N/A',
    'Fecha': new Date(m.fechaSubida).toLocaleDateString('es-CL'),
    'Estado': m.estado || 'N/A'
  }));

  if (formato === 'excel' && window.XLSX) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Materiales');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } else if (formato === 'csv') {
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';
    data.forEach(row => {
      const values = headers.map(h => `"${row[h]}"`);
      csv += values.join(',') + '\n';
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  }
}

function exportarRetroalimentacionAdmin(items, formato, filename) {
  const data = items.map(r => ({
    'Usuario': r.nombreUsuario || 'N/A',
    'Tipo': r.tipo || 'N/A',
    'Contenido': r.contenido || 'N/A',
    'Fecha': new Date(r.timestamp || r.fecha).toLocaleDateString('es-CL'),
    'Creado Por': r.creadoPor || 'N/A'
  }));

  if (formato === 'excel' && window.XLSX) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Retroalimentación');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
}

// Inicializar fechas por defecto (último mes)
document.addEventListener('DOMContentLoaded', function() {
  const hoy = new Date();
  const mesAtras = new Date();
  mesAtras.setMonth(mesAtras.getMonth() - 1);

  document.getElementById('adminAsistenciaFechaInicio').value = mesAtras.toISOString().split('T')[0];
  document.getElementById('adminAsistenciaFechaFin').value = hoy.toISOString().split('T')[0];

  // Cargar asistencia al abrir la sección
  if (window.location.hash === '#asistencia') {
    cargarAsistenciaAdmin();
  }

  // Cargar categorías al abrir la sección
  if (window.location.hash === '#categorias') {
    cargarCategorias();
  }
});

// ========================================
// GESTIÓN DE CATEGORÍAS - CU-08, 09, 10
// ========================================

async function cargarCategorias() {
  try {
    // ✅ CORREGIDO: usar /categorias en lugar de /recursos-academicos/categorias
    const res = await fetch(categoriasUrl);
    const categorias = await res.json();

    if (!categorias || categorias.length === 0) {
      document.getElementById('listaCategorias').innerHTML =
        '<p style="text-align: center; color: #666; grid-column: 1 / -1;">No hay categorías creadas.</p>';
      return;
    }

    const html = categorias.map(cat => `
      <div class="card" style="border-left: 4px solid ${cat.color};">
        <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 10px;">
          <div style="display: flex; gap: 10px; align-items: center; flex: 1;">
            <i class="fas fa-${cat.icono}" style="font-size: 2em; color: ${cat.color};"></i>
            <div>
              <h4 style="margin: 0;">${cat.nombre}</h4>
              <p style="margin: 0; font-size: 0.85em; color: #666;">${cat.descripcion || 'Sin descripción'}</p>
            </div>
          </div>
          <div style="display: flex; gap: 5px;">
            <button class="btn-sm btn-primary" onclick="editarCategoria('${cat.id}')" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-sm btn-danger" onclick="eliminarCategoriaConConfirmacion('${cat.id}', '${cat.nombre}', ${cat.cantidadMateriales || 0})" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #eee;">
          <span style="font-size: 0.85em; color: #666;">
            <i class="fas fa-file"></i> ${cat.cantidadMateriales || 0} materiales
          </span>
          <span style="font-size: 0.75em; color: #999;">
            Creado: ${new Date(cat.fechaCreacion).toLocaleDateString()}
          </span>
        </div>
      </div>
    `).join('');

    document.getElementById('listaCategorias').innerHTML = html;

  } catch (err) {
    console.error('Error cargando categorías:', err);
    document.getElementById('listaCategorias').innerHTML =
      '<p style="text-align: center; color: red; grid-column: 1 / -1;">Error al cargar categorías.</p>';
  }
}

function mostrarFormularioCategoria() {
  document.getElementById('formCategoria').style.display = 'block';
  document.getElementById('tituloFormCategoria').textContent = 'Crear Nueva Categoría';
  document.getElementById('categoriaIdEditar').value = '';
  document.getElementById('nombreCategoria').value = '';
  document.getElementById('descripcionCategoria').value = '';
  document.getElementById('colorCategoria').value = '#4A90E2';
  document.getElementById('iconoCategoria').value = 'folder';
}

function ocultarFormularioCategoria() {
  document.getElementById('formCategoria').style.display = 'none';
}

async function guardarCategoria() {
  const id = document.getElementById('categoriaIdEditar').value;
  const nombre = document.getElementById('nombreCategoria').value.trim();
  const descripcion = document.getElementById('descripcionCategoria').value.trim();
  const color = document.getElementById('colorCategoria').value;
  const icono = document.getElementById('iconoCategoria').value.trim();

  if (!nombre) {
    alert('⚠️ El nombre de la categoría es requerido');
    return;
  }

  const categoria = { nombre, descripcion, color, icono };

  try {
    let res;
    if (id) {
      // Actualizar - Migrado: PUT /recursos-academicos/categorias
      // ✅ CORREGIDO: usar /categorias en lugar de /recursos-academicos/categorias
      res = await fetch(`${categoriasUrl}?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoria)
      });
    } else {
      // Crear - Migrado: POST /recursos-academicos/categorias
      // ✅ CORREGIDO: usar /categorias en lugar de /recursos-academicos/categorias
      res = await fetch(categoriasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoria)
      });
    }

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al guardar categoría');
    }

    alert(`✅ Categoría ${id ? 'actualizada' : 'creada'} correctamente`);
    ocultarFormularioCategoria();
    cargarCategorias();

  } catch (err) {
    console.error('Error guardando categoría:', err);
    alert(`❌ ${err.message}`);
  }
}

async function editarCategoria(id) {
  try {
    // ✅ CORREGIDO: usar /categorias en lugar de /recursos-academicos/categorias
    const res = await fetch(`${categoriasUrl}?id=${encodeURIComponent(id)}`);
    const categoria = await res.json();

    if (!categoria) {
      alert('❌ Categoría no encontrada');
      return;
    }

    document.getElementById('formCategoria').style.display = 'block';
    document.getElementById('tituloFormCategoria').textContent = 'Editar Categoría';
    document.getElementById('categoriaIdEditar').value = categoria.id;
    document.getElementById('nombreCategoria').value = categoria.nombre;
    document.getElementById('descripcionCategoria').value = categoria.descripcion || '';
    document.getElementById('colorCategoria').value = categoria.color;
    document.getElementById('iconoCategoria').value = categoria.icono;

    // Scroll al formulario
    document.getElementById('formCategoria').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error('Error cargando categoría:', err);
    alert('❌ Error al cargar la categoría');
  }
}

async function eliminarCategoriaConConfirmacion(id, nombre, cantidadMateriales) {
  if (cantidadMateriales > 0) {
    // Cargar otras categorías para reasignar
    // ✅ CORREGIDO: usar /categorias en lugar de /recursos-academicos/categorias
    const res = await fetch(categoriasUrl);
    const categorias = await res.json();
    const otras = categorias.filter(c => c.id !== id);

    if (otras.length === 0) {
      if (!confirm(`⚠️ La categoría "${nombre}" tiene ${cantidadMateriales} materiales.\n\nNo hay otras categorías para reasignar. Los materiales quedarán SIN CATEGORÍA.\n\n¿Continuar?`)) {
        return;
      }
      await eliminarCategoria(id, null);
    } else {
      // Mostrar opciones de reasignación
      let opciones = otras.map((c, i) => `${i + 1}. ${c.nombre}`).join('\n');
      const opcion = prompt(`⚠️ La categoría "${nombre}" tiene ${cantidadMateriales} materiales.\n\nSelecciona el número de la categoría destino:\n\n${opciones}\n\n0. Sin categoría\n\nIngresa el número:`);

      if (opcion === null) return; // Cancelar

      const idx = parseInt(opcion);
      if (idx === 0) {
        await eliminarCategoria(id, null);
      } else if (idx > 0 && idx <= otras.length) {
        await eliminarCategoria(id, otras[idx - 1].id);
      } else {
        alert('❌ Opción inválida');
      }
    }
  } else {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;
    await eliminarCategoria(id, null);
  }
}

async function eliminarCategoria(id, categoriaDestinoId) {
  try {
    // ✅ CORREGIDO: usar /categorias en lugar de /recursos-academicos/categorias
    let url = `${categoriasUrl}?id=${encodeURIComponent(id)}`;
    if (categoriaDestinoId) {
      url += `&categoriaDestinoId=${encodeURIComponent(categoriaDestinoId)}`;
    }

    const res = await fetch(url, { method: 'DELETE' });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al eliminar categoría');
    }

    const result = await res.json();
    alert(`✅ ${result.message}\nMateriales reasignados: ${result.materialesReasignados}`);
    cargarCategorias();

  } catch (err) {
    console.error('Error eliminando categoría:', err);
    alert(`❌ ${err.message}`);
  }
}

// =====================================================
// CONFIGURACIÓN DEL SISTEMA (CU-11, 12)
// =====================================================

let configuracionActual = null;

async function cargarConfiguracion() {
  try {
    const res = await fetch(configuracionUrl);
    if (!res.ok) throw new Error('Error al cargar configuración');

    configuracionActual = await res.json();

    // Cargar datos básicos
    document.getElementById('nombreJardin').value = configuracionActual.nombreJardin || '';
    document.getElementById('direccionJardin').value = configuracionActual.direccion || '';
    document.getElementById('telefonoJardin').value = configuracionActual.telefono || '';
    document.getElementById('emailJardin').value = configuracionActual.email || '';
    document.getElementById('anoEscolar').value = configuracionActual.anoEscolar || new Date().getFullYear();

    // Cargar cursos
    const cursos = configuracionActual.cursos || [];
    const listaCursos = document.getElementById('listaCursos');
    listaCursos.innerHTML = cursos.map((curso, i) => `
      <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
        <input type="text" value="${curso}" onchange="actualizarCurso(${i}, this.value)" style="flex: 1;">
        <button class="btn btn-sm btn-danger" onclick="eliminarCurso(${i})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');

    // Cargar asignaturas
    const asignaturas = configuracionActual.asignaturas || [];
    const listaAsignaturas = document.getElementById('listaAsignaturas');
    listaAsignaturas.innerHTML = asignaturas.map((asig, i) => `
      <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
        <input type="text" value="${asig}" onchange="actualizarAsignatura(${i}, this.value)" style="flex: 1;">
        <button class="btn btn-sm btn-danger" onclick="eliminarAsignatura(${i})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error cargando configuración:', err);
    alert('Error al cargar configuración: ' + err.message);
  }
}

function actualizarCurso(index, valor) {
  if (!configuracionActual.cursos) configuracionActual.cursos = [];
  configuracionActual.cursos[index] = valor;
}

function eliminarCurso(index) {
  if (!confirm('¿Eliminar este curso?')) return;
  configuracionActual.cursos.splice(index, 1);
  cargarConfiguracion();
}

function agregarCurso() {
  const nombre = prompt('Nombre del nuevo curso:');
  if (!nombre) return;
  if (!configuracionActual.cursos) configuracionActual.cursos = [];
  configuracionActual.cursos.push(nombre);
  cargarConfiguracion();
}

function actualizarAsignatura(index, valor) {
  if (!configuracionActual.asignaturas) configuracionActual.asignaturas = [];
  configuracionActual.asignaturas[index] = valor;
}

function eliminarAsignatura(index) {
  if (!confirm('¿Eliminar esta asignatura?')) return;
  configuracionActual.asignaturas.splice(index, 1);
  cargarConfiguracion();
}

function agregarAsignatura() {
  const nombre = prompt('Nombre de la nueva asignatura/núcleo:');
  if (!nombre) return;
  if (!configuracionActual.asignaturas) configuracionActual.asignaturas = [];
  configuracionActual.asignaturas.push(nombre);
  cargarConfiguracion();
}

async function guardarConfiguracion() {
  try {
    const config = {
      nombreJardin: document.getElementById('nombreJardin').value,
      direccion: document.getElementById('direccionJardin').value,
      telefono: document.getElementById('telefonoJardin').value,
      email: document.getElementById('emailJardin').value,
      anoEscolar: parseInt(document.getElementById('anoEscolar').value),
      cursos: configuracionActual.cursos || [],
      asignaturas: configuracionActual.asignaturas || []
    };

    const res = await fetch(configuracionUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    if (!res.ok) throw new Error('Error al guardar configuración');

    alert('✅ Configuración guardada correctamente');
    cargarConfiguracion();

  } catch (err) {
    console.error('Error guardando configuración:', err);
    alert('Error al guardar configuración: ' + err.message);
  }
}

// =====================================================
// SUPERVISIÓN DE MATERIALES (CU-13, 14, 15, 16)
// =====================================================

async function cargarMateriales() {
  try {
    const estado = document.getElementById('filtroEstadoMaterial').value;
    const curso = document.getElementById('filtroCursoMaterial').value;

    // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
    let url = materialesUrl;
    if (curso) {
      url += `?curso=${encodeURIComponent(curso)}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al cargar materiales');

    const data = await res.json();
    let materiales = data.materiales || data; // ✅ CORREGIDO: Backend retorna wrapper

    // Filtrar por estado si se seleccionó
    if (estado) {
      materiales = materiales.filter(m => m.estado === estado);
    }

    if (materiales.length === 0) {
      document.getElementById('listaMateriales').innerHTML =
        '<p style="text-align: center; color: #666;">No se encontraron materiales</p>';
      return;
    }

    // Generar tabla
    let html = `
      <div class="card">
        <h3>Materiales Encontrados (${materiales.length})</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Curso</th>
              <th>Asignatura</th>
              <th>Profesor</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    materiales.forEach(mat => {
      const estadoBadge = getEstadoBadge(mat.estado);
      const fecha = new Date(mat.fechaSubida).toLocaleDateString('es-CL');

      html += `
        <tr>
          <td><strong>${mat.titulo}</strong></td>
          <td>${mat.curso}</td>
          <td>${mat.asignatura}</td>
          <td>${mat.profesor}</td>
          <td>${fecha}</td>
          <td>${estadoBadge}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="verDetalleMaterial('${mat.id}')" title="Ver Detalle">
              <i class="fas fa-eye"></i>
            </button>
            ${mat.estado === 'pendiente' || mat.estado === 'requiere_correccion' ? `
              <button class="btn btn-sm btn-success" onclick="aprobarMaterial('${mat.id}')" title="Aprobar">
                <i class="fas fa-check"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="rechazarMaterial('${mat.id}')" title="Rechazar">
                <i class="fas fa-times"></i>
              </button>
              <button class="btn btn-sm btn-warning" onclick="solicitarCorreccion('${mat.id}')" title="Solicitar Corrección">
                <i class="fas fa-edit"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('listaMateriales').innerHTML = html;

    // Agregar botones de exportación (CU-18, CU-25)
    agregarBotonesExportacion('listaMateriales', materiales, 'materiales');

  } catch (err) {
    console.error('Error cargando materiales:', err);
    alert('Error al cargar materiales: ' + err.message);
  }
}

function getEstadoBadge(estado) {
  const badges = {
    'pendiente': '<span style="background: #ffa726; color: white; padding: 4px 12px; border-radius: 12px;">Pendiente</span>',
    'aprobado': '<span style="background: #66bb6a; color: white; padding: 4px 12px; border-radius: 12px;">Aprobado</span>',
    'rechazado': '<span style="background: #ef5350; color: white; padding: 4px 12px; border-radius: 12px;">Rechazado</span>',
    'requiere_correccion': '<span style="background: #ff9800; color: white; padding: 4px 12px; border-radius: 12px;">Requiere Corrección</span>'
  };
  return badges[estado] || estado;
}

// CU-13: Ver detalle del material
async function verDetalleMaterial(id) {
  try {
    // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
    const res = await fetch(`${materialesUrl}?id=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Error al obtener material');

    const material = await res.json();

    const detalles = `
📄 Título: ${material.titulo}
📚 Curso: ${material.curso}
📖 Asignatura: ${material.asignatura}
👨‍🏫 Profesor: ${material.profesor}
📅 Fecha: ${new Date(material.fechaSubida).toLocaleString('es-CL')}
📝 Descripción: ${material.descripcion || 'Sin descripción'}
📁 Archivo: ${material.nombreArchivo}
⚙️ Estado: ${material.estado}
${material.observaciones ? `\n💬 Observaciones: ${material.observaciones}` : ''}
    `;

    alert(detalles);

  } catch (err) {
    console.error('Error:', err);
    alert('Error al ver detalle: ' + err.message);
  }
}

// CU-14: Aprobar material
async function aprobarMaterial(id) {
  if (!confirm('¿Aprobar este material?')) return;

  try {
    // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
    const res = await fetch(`${materialesUrl}?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'aprobado',
        fechaRevision: new Date().toISOString(),
        revisadoPor: 'Admin' // TODO: Obtener del usuario actual
      })
    });

    if (!res.ok) throw new Error('Error al aprobar');

    alert('✅ Material aprobado correctamente');
    cargarMateriales();

  } catch (err) {
    console.error('Error aprobando material:', err);
    alert('❌ Error al aprobar material: ' + err.message);
  }
}

// CU-15: Rechazar material
async function rechazarMaterial(id) {
  const motivo = prompt('Indica el motivo del rechazo:');
  if (!motivo) return;

  try {
    // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
    const res = await fetch(`${materialesUrl}?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'rechazado',
        observaciones: motivo,
        fechaRevision: new Date().toISOString(),
        revisadoPor: 'Admin'
      })
    });

    if (!res.ok) throw new Error('Error al rechazar');

    alert('✅ Material rechazado correctamente');
    cargarMateriales();

  } catch (err) {
    console.error('Error rechazando material:', err);
    alert('❌ Error al rechazar material: ' + err.message);
  }
}

// CU-16: Solicitar correcciones
async function solicitarCorreccion(id) {
  const correcciones = prompt('Indica las correcciones solicitadas:');
  if (!correcciones) return;

  try {
    // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
    const res = await fetch(`${materialesUrl}?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'requiere_correccion',
        observaciones: correcciones,
        fechaRevision: new Date().toISOString(),
        revisadoPor: 'Admin'
      })
    });

    if (!res.ok) throw new Error('Error al solicitar corrección');

    alert('✅ Correcciones solicitadas. Se notificará al profesor.');
    cargarMateriales();

  } catch (err) {
    console.error('Error solicitando corrección:', err);
    alert('❌ Error al solicitar corrección: ' + err.message);
  }
}

// ==============================================
// RETROALIMENTACIÓN (CU-20, 21, 22)
// ==============================================

// Cargar usuarios en los selectores de retroalimentación
async function cargarUsuariosParaRetro() {
  try {
    const res = await fetch(usuariosUrl);
    const usuarios = await res.json();

    const selectRetro = document.getElementById('retroUsuario');
    const selectHistorial = document.getElementById('historialUsuario');

    if (selectRetro) {
      selectRetro.innerHTML = '<option value="">-- Seleccionar usuario --</option>';
      usuarios.forEach(u => {
        if (u.activo) {
          const option = new Option(`${u.nombre} (${u.rol})`, u.rut);
          option.dataset.nombre = u.nombre;
          selectRetro.add(option);
        }
      });
    }

    if (selectHistorial) {
      selectHistorial.innerHTML = '<option value="">-- Todos los usuarios --</option>';
      usuarios.forEach(u => {
        if (u.activo) {
          const option = new Option(`${u.nombre} (${u.rol})`, u.rut);
          option.dataset.nombre = u.nombre;
          selectHistorial.add(option);
        }
      });
    }

  } catch (err) {
    console.error('Error cargando usuarios para retroalimentación:', err);
  }
}

// CU-20: Enviar retroalimentación
async function enviarRetroalimentacion(event) {
  event.preventDefault();

  const selectUsuario = document.getElementById('retroUsuario');
  const selectedOption = selectUsuario.options[selectUsuario.selectedIndex];

  const data = {
    rutUsuario: selectUsuario.value,
    nombreUsuario: selectedOption.dataset.nombre || selectedOption.text.split(' (')[0],
    tipo: document.getElementById('retroTipo').value,
    contenido: document.getElementById('retroContenido').value,
    visibilidad: document.getElementById('retroVisibilidad').value,
    ambito: document.getElementById('retroAmbito').value || undefined,
    curso: document.getElementById('retroCurso').value || undefined,
    creadoPor: 'Admin', // TODO: Obtener del usuario autenticado
    fecha: new Date().toISOString().split('T')[0]
  };

  try {
    const res = await fetch(retroalimentacionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al enviar retroalimentación');
    }

    alert('✅ Retroalimentación enviada correctamente');
    document.getElementById('formRetroalimentacion').reset();

    // Si hay un usuario seleccionado en historial, recargar
    if (document.getElementById('historialUsuario').value) {
      cargarHistorialRetro();
    }

  } catch (err) {
    console.error('Error:', err);
    alert('❌ Error al enviar retroalimentación: ' + err.message);
  }
}

// CU-22: Cargar historial de retroalimentación
async function cargarHistorialRetro() {
  const rutUsuario = document.getElementById('historialUsuario').value;
  const tipo = document.getElementById('filtroTipoRetro').value;
  const ambito = document.getElementById('filtroAmbitoRetro').value;

  try {
    let url = `${retroalimentacionUrl}?`;

    if (rutUsuario) {
      url += `rutUsuario=${encodeURIComponent(rutUsuario)}&`;
    }
    if (tipo) {
      url += `tipo=${tipo}&`;
    }

    const res = await fetch(url);
    const items = await res.json();

    if (!items || items.length === 0) {
      document.getElementById('historialRetroalimentacion').innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox fa-3x" style="color: #ccc;"></i>
          <p style="margin-top: 15px; color: #666;">No hay retroalimentación registrada</p>
        </div>
      `;
      document.getElementById('estadisticasRetro').innerHTML = '';
      return;
    }

    // Filtrar por ámbito en el cliente (si está especificado)
    let itemsFiltrados = items;
    if (ambito) {
      itemsFiltrados = items.filter(item => item.ambito === ambito);
    }

    // Generar estadísticas
    renderEstadisticasRetro(itemsFiltrados);

    // Renderizar historial
    renderHistorialRetro(itemsFiltrados);

  } catch (err) {
    console.error('Error cargando historial:', err);
    document.getElementById('historialRetroalimentacion').innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle fa-3x" style="color: #f44336;"></i>
        <p style="margin-top: 15px; color: #666;">Error al cargar el historial</p>
      </div>
    `;
  }
}

function renderEstadisticasRetro(items) {
  const stats = {
    total: items.length,
    tipos: {},
    ambitos: {},
    publicas: 0,
    privadas: 0
  };

  items.forEach(item => {
    // Contar por tipo
    stats.tipos[item.tipo] = (stats.tipos[item.tipo] || 0) + 1;

    // Contar por ámbito
    if (item.ambito) {
      stats.ambitos[item.ambito] = (stats.ambitos[item.ambito] || 0) + 1;
    }

    // Contar por visibilidad
    if (item.visibilidad === 'publica') {
      stats.publicas++;
    } else {
      stats.privadas++;
    }
  });

  const container = document.getElementById('estadisticasRetro');
  container.innerHTML = `
    <div class="stat-card">
      <i class="fas fa-comments fa-2x"></i>
      <div>
        <h3>${stats.total}</h3>
        <p>Total</p>
      </div>
    </div>
    <div class="stat-card">
      <i class="fas fa-globe fa-2x" style="color: var(--blue-main);"></i>
      <div>
        <h3>${stats.publicas}</h3>
        <p>Públicas</p>
      </div>
    </div>
    <div class="stat-card">
      <i class="fas fa-lock fa-2x" style="color: var(--purple-main);"></i>
      <div>
        <h3>${stats.privadas}</h3>
        <p>Privadas</p>
      </div>
    </div>
    <div class="stat-card">
      <i class="fas fa-star fa-2x" style="color: var(--gold-main);"></i>
      <div>
        <h3>${stats.tipos['logro_destacado'] || 0}</h3>
        <p>Logros</p>
      </div>
    </div>
  `;
}

function renderHistorialRetro(items) {
  const container = document.getElementById('historialRetroalimentacion');

  let html = '<div class="timeline">';

  items.forEach((item, index) => {
    const tipoLabel = getTipoRetroLabel(item.tipo);
    const tipoColor = getTipoRetroColor(item.tipo);
    const tipoIcon = getTipoRetroIcon(item.tipo);
    const fecha = new Date(item.timestamp || item.fecha).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    html += `
      <div class="timeline-item" style="animation-delay: ${index * 0.1}s;">
        <div class="timeline-marker" style="background: ${tipoColor};">
          <i class="${tipoIcon}" style="color: white; font-size: 12px;"></i>
        </div>
        <div class="timeline-content">
          <div class="timeline-header">
            <div>
              <span class="timeline-badge" style="background: ${tipoColor};">
                ${tipoIcon ? `<i class="${tipoIcon}"></i>` : ''} ${tipoLabel}
              </span>
              ${item.ambito ? `<span class="timeline-ambito">${getAmbitoLabel(item.ambito)}</span>` : ''}
            </div>
            <span class="timeline-date"><i class="fas fa-clock"></i> ${fecha}</span>
          </div>

          <div class="timeline-usuario">
            <strong><i class="fas fa-user"></i> ${item.nombreUsuario || 'Usuario'}</strong>
            ${item.curso ? `<span class="curso-badge">${item.curso}</span>` : ''}
          </div>

          <p class="timeline-contenido">${item.contenido}</p>

          <div class="timeline-footer">
            <small>
              <i class="fas fa-user-shield"></i> <strong>Por:</strong> ${item.creadoPor || 'Sistema'} |
              <i class="fas fa-eye${item.visibilidad === 'privada' ? '-slash' : ''}"></i>
              <strong>Visibilidad:</strong> ${item.visibilidad === 'privada' ? 'Privada' : 'Pública'}
            </small>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  // Agregar botones de exportación (CU-18, CU-25)
  if (items && items.length > 0) {
    agregarBotonesExportacion('historialRetroalimentacion', items, 'retroalimentacion');
  }
}

function getTipoRetroLabel(tipo) {
  const labels = {
    'desempeno_general': 'Desempeño General',
    'conducta': 'Conducta',
    'logro_destacado': 'Logro Destacado',
    'area_mejora': 'Área de Mejora',
    'observacion_general': 'Observación',
    'retroalimentacion_padres': 'Retroalimentación a Padres'
  };
  return labels[tipo] || tipo;
}

function getTipoRetroColor(tipo) {
  const colors = {
    'desempeno_general': '#2196f3',
    'conducta': '#ff9800',
    'logro_destacado': '#4caf50',
    'area_mejora': '#f44336',
    'observacion_general': '#9c27b0',
    'retroalimentacion_padres': '#00bcd4'
  };
  return colors[tipo] || '#757575';
}

function getTipoRetroIcon(tipo) {
  const icons = {
    'desempeno_general': 'fas fa-chart-line',
    'conducta': 'fas fa-theater-masks',
    'logro_destacado': 'fas fa-star',
    'area_mejora': 'fas fa-arrow-up',
    'observacion_general': 'fas fa-sticky-note',
    'retroalimentacion_padres': 'fas fa-users'
  };
  return icons[tipo] || 'fas fa-comment';
}

function getAmbitoLabel(ambito) {
  const labels = {
    'academico': '📚 Académico',
    'conductual': '🎯 Conductual',
    'socioemocional': '❤️ Socioemocional',
    'psicomotor': '🤸 Psicomotor'
  };
  return labels[ambito] || ambito;
}

// Inicializar retroalimentación al cargar la página
document.addEventListener('DOMContentLoaded', function() {
  cargarUsuariosParaRetro();
  // Cargar dashboard al iniciar si es la sección activa
  if (window.location.hash === '#dashboard' || !window.location.hash) {
    cargarDashboard();
  }
});

// ==============================================
// CU-24: DASHBOARD DE INDICADORES CON SEMÁFOROS
// ==============================================

async function cargarDashboard() {
  try {
    // Cargar datos de múltiples fuentes en paralelo
    const [usuarios, asistencia, dataMateriales] = await Promise.all([
      fetch(usuariosUrl).then(r => r.json()),
      fetch(`${PREFIX}/asistencia`).then(r => r.json()).catch(() => []),
      // ✅ CORREGIDO: usar /materiales en lugar de /recursos-academicos/materiales
      fetch(materialesUrl).then(r => r.json()).catch(() => ({ materiales: [] }))
      // NOTA: Removido fetch de matrículas (no hay RF)
    ]);

    const materiales = dataMateriales.materiales || dataMateriales; // ✅ CORREGIDO: Backend retorna wrapper

    // Calcular indicadores
    calcularIndicadorUsuarios(usuarios);
    calcularIndicadorAsistencia(asistencia);
    calcularIndicadorMateriales(materiales);
    // NOTA: Comentado indicador de matrículas (no hay RF)
    // calcularIndicadorMatriculas(matriculas);

    // Generar alertas críticas
    generarAlertasCriticas({ usuarios, asistencia, materiales });

    // Generar resumen por curso
    generarResumenCursos({ asistencia, materiales });

  } catch (err) {
    console.error('Error cargando dashboard:', err);
    alert('Error al cargar el dashboard');
  }
}

function calcularIndicadorUsuarios(usuarios) {
  const activos = usuarios.filter(u => u.activo !== false).length;
  document.getElementById('totalUsuarios').textContent = activos;
  document.getElementById('trendUsuarios').innerHTML = `
    <small style="color: #4caf50;">
      <i class="fas fa-arrow-up"></i> ${usuarios.length} total
    </small>
  `;
}

function calcularIndicadorAsistencia(registros) {
  if (!registros || registros.length === 0) {
    document.getElementById('promedioAsistencia').textContent = 'N/A';
    actualizarSemaforo('semaforoAsistencia', 'gray');
    return;
  }

  const presentes = registros.filter(r => r.estado === 'presente').length;
  const promedio = ((presentes / registros.length) * 100).toFixed(1);

  document.getElementById('promedioAsistencia').textContent = promedio + '%';

  // Semáforo: Verde >= 90%, Amarillo >= 80%, Rojo < 80%
  let color = 'red';
  if (promedio >= 90) color = 'green';
  else if (promedio >= 80) color = 'yellow';

  actualizarSemaforo('semaforoAsistencia', color);
}

function calcularIndicadorMateriales(materiales) {
  const pendientes = materiales.filter(m =>
    m.estado === 'pendiente' || m.estado === 'requiere_correccion'
  ).length;

  document.getElementById('materialesPendientes').textContent = pendientes;

  // Semáforo: Verde = 0-2, Amarillo = 3-5, Rojo > 5
  let color = 'green';
  if (pendientes > 5) color = 'red';
  else if (pendientes > 2) color = 'yellow';

  actualizarSemaforo('semaforoMateriales', color);
}

// COMENTADO: No hay RF para matrículas
/*
function calcularIndicadorMatriculas(matriculas) {
  const pendientes = matriculas.filter(m =>
    !m.estado || m.estado === 'pendiente'
  ).length;

  document.getElementById('matriculasPendientes').textContent = pendientes;

  // Semáforo: Verde = 0-3, Amarillo = 4-7, Rojo > 7
  let color = 'green';
  if (pendientes > 7) color = 'red';
  else if (pendientes > 3) color = 'yellow';

  actualizarSemaforo('semaforoMatriculas', color);
}
*/

function actualizarSemaforo(elementId, color) {
  const semaforo = document.getElementById(elementId);
  if (!semaforo) return;

  const colors = {
    green: '#4caf50',
    yellow: '#ff9800',
    red: '#f44336',
    gray: '#9e9e9e'
  };

  semaforo.innerHTML = `
    <div class="semaphore-lights">
      <div class="semaphore-light ${color === 'red' ? 'active' : ''}" style="background: ${color === 'red' ? colors.red : '#ddd'};"></div>
      <div class="semaphore-light ${color === 'yellow' ? 'active' : ''}" style="background: ${color === 'yellow' ? colors.yellow : '#ddd'};"></div>
      <div class="semaphore-light ${color === 'green' ? 'active' : ''}" style="background: ${color === 'green' ? colors.green : '#ddd'};"></div>
    </div>
  `;
}

function generarAlertasCriticas(datos) {
  const alertas = [];

  // Alerta: Asistencia baja
  if (datos.asistencia && datos.asistencia.length > 0) {
    const porAlumno = {};
    datos.asistencia.forEach(r => {
      if (!porAlumno[r.rutAlumno]) {
        porAlumno[r.rutAlumno] = { nombre: r.nombreAlumno, presente: 0, total: 0 };
      }
      if (r.estado === 'presente') porAlumno[r.rutAlumno].presente++;
      porAlumno[r.rutAlumno].total++;
    });

    Object.values(porAlumno).forEach(alumno => {
      const porcentaje = (alumno.presente / alumno.total) * 100;
      if (porcentaje < 85) {
        alertas.push({
          tipo: 'danger',
          icono: 'fas fa-exclamation-circle',
          mensaje: `Ausentismo crítico: ${alumno.nombre} (${porcentaje.toFixed(1)}% asistencia)`,
          accion: 'Ver detalles de asistencia',
          onClick: "showSection('asistencia')"
        });
      }
    });
  }

  // Alerta: Materiales pendientes de revisión
  const materialesPendientes = datos.materiales.filter(m => m.estado === 'pendiente').length;
  if (materialesPendientes > 5) {
    alertas.push({
      tipo: 'warning',
      icono: 'fas fa-folder-open',
      mensaje: `${materialesPendientes} materiales pendientes de revisión`,
      accion: 'Revisar materiales',
      onClick: "showSection('materiales')"
    });
  }

  // COMENTADO: Alerta de matrículas (no hay RF)
  /*
  const matriculasPendientes = datos.matriculas.filter(m => !m.estado || m.estado === 'pendiente').length;
  if (matriculasPendientes > 0) {
    alertas.push({
      tipo: 'info',
      icono: 'fas fa-file-alt',
      mensaje: `${matriculasPendientes} solicitudes de matrícula pendientes`,
      accion: 'Gestionar matrículas',
      onClick: "showSection('matriculas')"
    });
  }
  */

  // Renderizar alertas
  const container = document.getElementById('alertasCriticas');
  if (alertas.length === 0) {
    container.innerHTML = '<p style="color: #4caf50; text-align: center;"><i class="fas fa-check-circle"></i> No hay alertas críticas</p>';
  } else {
    container.innerHTML = alertas.map(alerta => `
      <div class="alert alert-${alerta.tipo}" style="padding: 15px; margin-bottom: 10px; border-radius: 8px; background: ${getAlertColor(alerta.tipo)}; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <i class="${alerta.icono}"></i>
          <strong>${alerta.mensaje}</strong>
        </div>
        <button class="btn btn-sm btn-primary" onclick="${alerta.onClick}">
          ${alerta.accion}
        </button>
      </div>
    `).join('');
  }
}

function getAlertColor(tipo) {
  const colors = {
    danger: '#ffebee',
    warning: '#fff3e0',
    info: '#e3f2fd',
    success: '#e8f5e9'
  };
  return colors[tipo] || '#f5f5f5';
}

function generarResumenCursos(datos) {
  const cursos = ['medio-mayor', 'prekinder-a', 'prekinder-b', 'kinder', 'extension'];
  const container = document.getElementById('resumenCursos');

  const resumen = cursos.map(curso => {
    // Calcular asistencia
    const asistenciaCurso = datos.asistencia.filter(r => r.curso === curso);
    const presentes = asistenciaCurso.filter(r => r.estado === 'presente').length;
    const promedioAsistencia = asistenciaCurso.length > 0
      ? ((presentes / asistenciaCurso.length) * 100).toFixed(1)
      : 0;

    // Contar materiales
    const materialesCurso = datos.materiales.filter(m => m.curso === curso).length;

    return {
      nombre: getNombreCurso(curso),
      asistencia: promedioAsistencia,
      materiales: materialesCurso,
      color: getColorAsistencia(promedioAsistencia)
    };
  });

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">
      ${resumen.map(r => `
        <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px;">
          <h4 style="margin: 0 0 15px 0;">${r.nombre}</h4>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.9em; opacity: 0.9;">Asistencia</div>
              <div style="font-size: 1.8em; font-weight: bold;">${r.asistencia}%</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.9em; opacity: 0.9;">Materiales</div>
              <div style="font-size: 1.8em; font-weight: bold;">${r.materiales}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function getNombreCurso(codigo) {
  const nombres = {
    'medio-mayor': 'Medio Mayor',
    'prekinder-a': 'Prekínder A',
    'prekinder-b': 'Prekínder B',
    'kinder': 'Kínder',
    'extension': 'Extensión'
  };
  return nombres[codigo] || codigo;
}

function getColorAsistencia(porcentaje) {
  if (porcentaje >= 90) return '#4caf50';
  if (porcentaje >= 80) return '#ff9800';
  return '#f44336';
}

// ==============================================
// CU-23: COMPARATIVO MULTI-CURSO CON GRÁFICOS
// ==============================================

let chartInstances = {
  asistencia: null,
  evolucion: null,
  niveles: null
};

// Inicializar fechas por defecto
document.addEventListener('DOMContentLoaded', function() {
  const hoy = new Date();
  const hace30Dias = new Date();
  hace30Dias.setDate(hoy.getDate() - 30);

  document.getElementById('comparativoFechaInicio').value = hace30Dias.toISOString().split('T')[0];
  document.getElementById('comparativoFechaFin').value = hoy.toISOString().split('T')[0];
});

async function generarComparativo() {
  // Obtener cursos seleccionados
  const cursosSeleccionados = Array.from(document.querySelectorAll('.curso-checkbox:checked'))
    .map(cb => cb.value);

  if (cursosSeleccionados.length === 0) {
    alert('⚠️ Selecciona al menos un curso para comparar');
    return;
  }

  // Obtener rango de fechas
  const fechaInicio = document.getElementById('comparativoFechaInicio').value;
  const fechaFin = document.getElementById('comparativoFechaFin').value;

  if (!fechaInicio || !fechaFin) {
    alert('⚠️ Selecciona el período a comparar');
    return;
  }

  if (fechaInicio > fechaFin) {
    alert('⚠️ La fecha de inicio no puede ser mayor a la fecha fin');
    return;
  }

  try {
    // Cargar datos en paralelo
    const [asistencia, evaluaciones, dataMateriales] = await Promise.all([
      fetch(`${PREFIX}/asistencia`).then(r => r.json()).catch(() => []),
      // ✅ CORREGIDO: usar /notas en lugar de /recursos-academicos/notas
      fetch(notasUrl).then(r => r.json()).catch(() => []),
      // ✅ CORREGIDO: usar /materiales directamente
      fetch(materialesUrl).then(r => r.json()).catch(() => ({ materiales: [] }))
    ]);

    const materiales = dataMateriales.materiales || dataMateriales; // ✅ CORREGIDO: Backend retorna wrapper

    // Filtrar datos por rango de fechas
    const asistenciaFiltrada = filtrarPorFechas(asistencia, fechaInicio, fechaFin);
    const evaluacionesFiltradas = filtrarPorFechas(evaluaciones, fechaInicio, fechaFin);

    // Generar gráficos
    generarGraficoAsistencia(cursosSeleccionados, asistenciaFiltrada);
    generarGraficoEvolucion(cursosSeleccionados, asistenciaFiltrada, fechaInicio, fechaFin);
    generarGraficoNiveles(cursosSeleccionados, evaluacionesFiltradas);
    generarTablaComparativaHTML(cursosSeleccionados, asistenciaFiltrada, evaluacionesFiltradas, materiales);

  } catch (err) {
    console.error('Error generando comparativo:', err);
    alert('❌ Error al generar el comparativo');
  }
}

function filtrarPorFechas(datos, fechaInicio, fechaFin) {
  return datos.filter(item => {
    const fecha = item.fecha || item.fechaSubida;
    if (!fecha) return false;
    return fecha >= fechaInicio && fecha <= fechaFin;
  });
}

// Gráfico 1: Asistencia Promedio por Curso (Barras)
function generarGraficoAsistencia(cursos, asistencia) {
  const datos = cursos.map(curso => {
    const registrosCurso = asistencia.filter(r => r.curso === curso);
    if (registrosCurso.length === 0) return 0;

    const presentes = registrosCurso.filter(r => r.estado === 'presente').length;
    return ((presentes / registrosCurso.length) * 100).toFixed(1);
  });

  const ctx = document.getElementById('chartAsistencia').getContext('2d');

  // Destruir gráfico anterior si existe
  if (chartInstances.asistencia) {
    chartInstances.asistencia.destroy();
  }

  chartInstances.asistencia = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cursos.map(c => getNombreCurso(c)),
      datasets: [{
        label: 'Asistencia Promedio (%)',
        data: datos,
        backgroundColor: [
          'rgba(74, 144, 226, 0.8)',
          'rgba(80, 227, 194, 0.8)',
          'rgba(245, 166, 35, 0.8)',
          'rgba(126, 87, 194, 0.8)',
          'rgba(255, 99, 132, 0.8)'
        ],
        borderColor: [
          'rgba(74, 144, 226, 1)',
          'rgba(80, 227, 194, 1)',
          'rgba(245, 166, 35, 1)',
          'rgba(126, 87, 194, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Asistencia: ${context.parsed.y}%`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          },
          title: {
            display: true,
            text: 'Porcentaje de Asistencia'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Cursos'
          }
        }
      }
    }
  });
}

// Gráfico 2: Evolución Temporal de Asistencia (Líneas)
function generarGraficoEvolucion(cursos, asistencia, fechaInicio, fechaFin) {
  // Generar array de fechas
  const fechas = [];
  let fecha = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  while (fecha <= fin) {
    fechas.push(fecha.toISOString().split('T')[0]);
    fecha.setDate(fecha.getDate() + 1);
  }

  // Calcular datos por curso
  const datasets = cursos.map((curso, index) => {
    const colores = [
      'rgba(74, 144, 226, 1)',
      'rgba(80, 227, 194, 1)',
      'rgba(245, 166, 35, 1)',
      'rgba(126, 87, 194, 1)',
      'rgba(255, 99, 132, 1)'
    ];

    const datos = fechas.map(fecha => {
      const registrosDia = asistencia.filter(r => r.curso === curso && r.fecha === fecha);
      if (registrosDia.length === 0) return null;

      const presentes = registrosDia.filter(r => r.estado === 'presente').length;
      return ((presentes / registrosDia.length) * 100).toFixed(1);
    });

    return {
      label: getNombreCurso(curso),
      data: datos,
      borderColor: colores[index % colores.length],
      backgroundColor: colores[index % colores.length].replace('1)', '0.2)'),
      tension: 0.3,
      fill: false,
      spanGaps: true
    };
  });

  const ctx = document.getElementById('chartEvolucion').getContext('2d');

  if (chartInstances.evolucion) {
    chartInstances.evolucion.destroy();
  }

  chartInstances.evolucion = new Chart(ctx, {
    type: 'line',
    data: {
      labels: fechas.map(f => {
        const d = new Date(f);
        return `${d.getDate()}/${d.getMonth() + 1}`;
      }),
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          },
          title: {
            display: true,
            text: 'Asistencia (%)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Fecha'
          }
        }
      }
    }
  });
}

// Gráfico 3: Distribución de Niveles de Logro (Pastel/Dona)
function generarGraficoNiveles(cursos, evaluaciones) {
  const niveles = { L: 0, OD: 0, NL: 0, NT: 0 };

  // Filtrar evaluaciones de cursos seleccionados
  const evaluacionesFiltradas = evaluaciones.filter(ev => cursos.includes(ev.curso));

  evaluacionesFiltradas.forEach(ev => {
    if (ev.nivelLogro && niveles.hasOwnProperty(ev.nivelLogro)) {
      niveles[ev.nivelLogro]++;
    }
  });

  const ctx = document.getElementById('chartNiveles').getContext('2d');

  if (chartInstances.niveles) {
    chartInstances.niveles.destroy();
  }

  chartInstances.niveles = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Logrado (L)', 'En Desarrollo (OD)', 'No Logrado (NL)', 'No Trabajado (NT)'],
      datasets: [{
        data: [niveles.L, niveles.OD, niveles.NL, niveles.NT],
        backgroundColor: [
          'rgba(76, 175, 80, 0.8)',
          'rgba(255, 193, 7, 0.8)',
          'rgba(244, 67, 54, 0.8)',
          'rgba(158, 158, 158, 0.8)'
        ],
        borderColor: [
          'rgba(76, 175, 80, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(244, 67, 54, 1)',
          'rgba(158, 158, 158, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'right'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const porcentaje = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
              return `${context.label}: ${context.parsed} (${porcentaje}%)`;
            }
          }
        }
      }
    }
  });
}

// Tabla Comparativa con Resumen Numérico
function generarTablaComparativaHTML(cursos, asistencia, evaluaciones, materiales) {
  const datos = cursos.map(curso => {
    // Asistencia
    const asistenciaCurso = asistencia.filter(r => r.curso === curso);
    const presentes = asistenciaCurso.filter(r => r.estado === 'presente').length;
    const promedioAsistencia = asistenciaCurso.length > 0
      ? ((presentes / asistenciaCurso.length) * 100).toFixed(1)
      : 0;

    // Evaluaciones
    const evaluacionesCurso = evaluaciones.filter(ev => ev.curso === curso);
    const nivelesLogro = { L: 0, OD: 0, NL: 0, NT: 0 };
    evaluacionesCurso.forEach(ev => {
      if (ev.nivelLogro && nivelesLogro.hasOwnProperty(ev.nivelLogro)) {
        nivelesLogro[ev.nivelLogro]++;
      }
    });

    const promedioNumerico = calcularPromedioNumerico(nivelesLogro);

    // Materiales
    const materialesCurso = materiales.filter(m => m.curso === curso);

    return {
      curso: getNombreCurso(curso),
      asistencia: promedioAsistencia,
      totalEvaluaciones: evaluacionesCurso.length,
      logrado: nivelesLogro.L,
      enDesarrollo: nivelesLogro.OD,
      noLogrado: nivelesLogro.NL,
      noTrabajado: nivelesLogro.NT,
      promedioNumerico: promedioNumerico,
      materiales: materialesCurso.length
    };
  });

  // Guardar datos para exportación
  window._datosComparativos = datos;

  const html = `
    <table class="data-table" id="tablaComparativaData">
      <thead>
        <tr>
          <th>Curso</th>
          <th>Asistencia (%)</th>
          <th>Total Evaluaciones</th>
          <th>Logrado (L)</th>
          <th>En Desarrollo (OD)</th>
          <th>No Logrado (NL)</th>
          <th>No Trabajado (NT)</th>
          <th>Promedio</th>
          <th>Materiales</th>
        </tr>
      </thead>
      <tbody>
        ${datos.map(d => `
          <tr>
            <td><strong>${d.curso}</strong></td>
            <td style="background: ${getColorFondo(d.asistencia, 'asistencia')};">${d.asistencia}%</td>
            <td>${d.totalEvaluaciones}</td>
            <td>${d.logrado}</td>
            <td>${d.enDesarrollo}</td>
            <td>${d.noLogrado}</td>
            <td>${d.noTrabajado}</td>
            <td style="background: ${getColorFondo(d.promedioNumerico, 'promedio')};">${d.promedioNumerico}</td>
            <td>${d.materiales}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background: #f5f5f5; font-weight: bold;">
          <td>PROMEDIO GENERAL</td>
          <td>${calcularPromedioArray(datos.map(d => parseFloat(d.asistencia)))}%</td>
          <td>${sumarArray(datos.map(d => d.totalEvaluaciones))}</td>
          <td>${sumarArray(datos.map(d => d.logrado))}</td>
          <td>${sumarArray(datos.map(d => d.enDesarrollo))}</td>
          <td>${sumarArray(datos.map(d => d.noLogrado))}</td>
          <td>${sumarArray(datos.map(d => d.noTrabajado))}</td>
          <td>${calcularPromedioArray(datos.map(d => parseFloat(d.promedioNumerico)))}</td>
          <td>${sumarArray(datos.map(d => d.materiales))}</td>
        </tr>
      </tfoot>
    </table>
  `;

  document.getElementById('tablaComparativa').innerHTML = html;
}

function calcularPromedioNumerico(niveles) {
  const total = niveles.L + niveles.OD + niveles.NL + niveles.NT;
  if (total === 0) return '0.0';

  const suma = (niveles.L * 4) + (niveles.OD * 3) + (niveles.NT * 2) + (niveles.NL * 1);
  return (suma / total).toFixed(1);
}

function getColorFondo(valor, tipo) {
  const v = parseFloat(valor);

  if (tipo === 'asistencia') {
    if (v >= 90) return 'rgba(76, 175, 80, 0.2)';
    if (v >= 80) return 'rgba(255, 193, 7, 0.2)';
    return 'rgba(244, 67, 54, 0.2)';
  } else if (tipo === 'promedio') {
    if (v >= 3.5) return 'rgba(76, 175, 80, 0.2)';
    if (v >= 3.0) return 'rgba(139, 195, 74, 0.2)';
    if (v >= 2.5) return 'rgba(255, 193, 7, 0.2)';
    return 'rgba(244, 67, 54, 0.2)';
  }

  return 'transparent';
}

function calcularPromedioArray(arr) {
  if (arr.length === 0) return '0.0';
  const suma = arr.reduce((a, b) => a + b, 0);
  return (suma / arr.length).toFixed(1);
}

function sumarArray(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

// Exportar Gráfico como Imagen PNG
function exportarGrafico(chartId, filename) {
  const canvas = document.getElementById(chartId);
  if (!canvas) {
    alert('❌ Gráfico no encontrado');
    return;
  }

  // Convertir canvas a blob
  canvas.toBlob(function(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// Exportar Tabla Comparativa a Excel
function exportarTablaComparativa() {
  const datos = window._datosComparativos;

  if (!datos || datos.length === 0) {
    alert('⚠️ No hay datos para exportar');
    return;
  }

  if (!window.XLSX) {
    alert('❌ Librería XLSX no disponible');
    return;
  }

  const dataExcel = datos.map(d => ({
    'Curso': d.curso,
    'Asistencia (%)': d.asistencia,
    'Total Evaluaciones': d.totalEvaluaciones,
    'Logrado (L)': d.logrado,
    'En Desarrollo (OD)': d.enDesarrollo,
    'No Logrado (NL)': d.noLogrado,
    'No Trabajado (NT)': d.noTrabajado,
    'Promedio Numérico': d.promedioNumerico,
    'Materiales': d.materiales
  }));

  const ws = XLSX.utils.json_to_sheet(dataExcel);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comparativo Cursos');

  const filename = `comparativo_cursos_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}
