exports.handler = async () => {
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Portal Profesores</title>
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
      .logout-btn { background: #c00; color: #fff; border: none; padding: 8px 12px; cursor: pointer; margin-bottom: 10px; }
      .btn { background: #0078d7; color: white; border: none; padding: 10px 15px; margin: 10px 0; cursor: pointer; }
      .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; }
      .modal-content { background: #fff; padding: 20px; margin: 5% auto; width: 420px; border-radius: 8px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
      .modal-content h2 { margin-top: 0; }
      label { display: block; margin: 10px 0 5px; }
      input, select, textarea { width: 100%; padding: 8px; }
    </style>
  </head>
  <body>
    <aside>
      <h2>Menú Profesor</h2>
      <ul>
        <li onclick="showSection('anuncios')">📢 Anuncios</li>
        <li onclick="showSection('calendario')">📅 Calendario</li>
        <li onclick="showSection('cursos')">📚 Cursos</li>
      </ul>
    </aside>
    <main>
      <button class="logout-btn" onclick="cerrarSesion()">🔒 Cerrar Sesión</button>

      <!-- Anuncios (Commit 1.1.5) -->
      <div id="anuncios" class="section active">
        <h1>📢 Anuncios</h1>
        <div id="listaAnunciosPortal"></div>
      </div>

      <div id="calendario" class="section">
        <h1>Calendario General</h1>
        <button class="btn" onclick="openModal()">➕ Añadir Evento/Evaluación</button>
        <div id="calendar"></div>
      </div>

      <div id="cursos" class="section">
        <h1>Cursos</h1>
        <p>Lista de cursos asignados.</p>
      </div>

    </main>

    <div id="modal" class="modal">
      <div class="modal-content">
        <h2>Nuevo Evento/Evaluación</h2>
        <form id="eventForm">
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
          </div>
        </form>
      </div>
    </div>

    <script>
      const basePath = window.location.pathname.includes('/prod') ? '/prod' : '';

      function showSection(id) {
        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(id).classList.add('active');
      }

      function cerrarSesion() {
        window.location.href = basePath || '/';
      }

      function openModal() {
        document.getElementById('modal').style.display = 'block';
      }

      function closeModal() {
        document.getElementById('modal').style.display = 'none';
      }

      // Función para cargar anuncios (Commit 1.1.5)
      async function cargarAnunciosPortal() {
        try {
          const res = await fetch(basePath + '/anuncios');
          const anuncios = await res.json();

          // Filtrar solo anuncios para todos o profesores
          const filtered = anuncios.filter(a => a.destinatarios === 'todos' || a.destinatarios === 'profesores');

          document.getElementById('listaAnunciosPortal').innerHTML = filtered.map(a => \`
            <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #f9f9f9;">
              <h3 style="margin-top: 0; color: #004080;">\${a.titulo}</h3>
              <p>\${a.contenido}</p>
              <small style="color: #666;">
                <strong>Fecha:</strong> \${new Date(a.fecha).toLocaleDateString()} |
                <strong>Autor:</strong> \${a.autor}
              </small>
            </div>
          \`).join('') || '<p>No hay anuncios disponibles.</p>';
        } catch (err) {
          console.error('Error cargando anuncios:', err);
          document.getElementById('listaAnunciosPortal').innerHTML = '<p>Error al cargar anuncios.</p>';
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
              const res = await fetch(basePath + '/eventos');
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
              fetch(basePath + '/eventos/' + info.event.id, {
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
            fetch(basePath + '/eventos/' + e.id, {
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
            const res = await fetch(basePath + '/eventos', {
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
    </script>
  </body>
  </html>
  `;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: html
  };
};
