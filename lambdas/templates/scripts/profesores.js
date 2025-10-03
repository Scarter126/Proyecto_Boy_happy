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
    const asistenciaRes = await fetch(`${PREFIX}/asistencia?curso=${encodeURIComponent(curso)}&fecha=${fecha}`);
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
    const res = await fetch(`${PREFIX}/asistencia`, {
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
});
