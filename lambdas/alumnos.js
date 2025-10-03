exports.handler = async () => {
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Portal Alumnos</title>
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
      #calendar { max-width: 900px; margin: 0 auto; height: 600px; background:white; border-radius:8px; padding:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1); }
      .logout-btn { float: right; margin-bottom: 10px; padding: 5px 10px; background: #004080; color: white; border: none; cursor: pointer; border-radius: 4px; }
      .logout-btn:hover { background: #0066cc; }
      .modal { display: none; position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.5); z-index: 9999; }
      .modal-content { background: white; padding: 20px; margin: 10% auto; width: 400px; border-radius: 8px; box-shadow:0 4px 10px rgba(0,0,0,0.3); }
      .modal-content h3 { margin-top:0; }
      .close-btn { float:right; cursor:pointer; color:#c00; font-weight:bold; }
    </style>
  </head>
  <body>
    <aside>
      <h2>Menú Alumno</h2>
      <ul>
        <li onclick="showSection('anuncios')">📢 Anuncios</li>
        <li onclick="showSection('calendario')">📅 Calendario</li>
        <li onclick="showSection('horario')">📖 Horario</li>
        <li onclick="showSection('companeros')">👥 Compañeros</li>
        <li onclick="showSection('notas')">📝 Notas</li>
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
        <h1>Calendario de Pruebas</h1>
        <div id="calendar"></div>
      </div>
      <div id="horario" class="section">
        <h1>Horario</h1>
        <p>Horario del alumno.</p>
      </div>
      <div id="companeros" class="section">
        <h1>Compañeros</h1>
        <p>Lista de compañeros.</p>
      </div>
      <div id="notas" class="section">
        <h1>Notas</h1>
        <p>Notas de las materias.</p>
      </div>
    </main>

    <!-- Modal de evento -->
    <div id="eventModal" class="modal">
      <div class="modal-content">
        <span class="close-btn" onclick="closeModal()">&times;</span>
        <h3 id="eventTitle"></h3>
        <p><strong>Fecha:</strong> <span id="eventDate"></span></p>
        <p><strong>Hora:</strong> <span id="eventTime"></span></p>
        <p><strong>Curso:</strong> <span id="eventCurso"></span></p>
        <p><strong>Tipo:</strong> <span id="eventTipo"></span></p>
        <p id="eventDesc"></p>
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

      function closeModal() {
        document.getElementById('eventModal').style.display = 'none';
      }

      // Función para cargar anuncios (Commit 1.1.5)
      async function cargarAnunciosPortal() {
        try {
          const res = await fetch(basePath + '/anuncios');
          const anuncios = await res.json();

          // Filtrar solo anuncios para todos o alumnos
          const filtered = anuncios.filter(a => a.destinatarios === 'todos' || a.destinatarios === 'alumnos');

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
          headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
          events: async function(fetchInfo, successCallback, failureCallback) {
            try {
              const apiUrl = basePath + '/eventos';
              const res = await fetch(apiUrl);
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
          editable: false,
          selectable: false,
          eventClick: function(info) {
            const e = info.event;
            document.getElementById('eventTitle').textContent = e.title;
            const dt = new Date(e.start);
            document.getElementById('eventDate').textContent = dt.toLocaleDateString();
            document.getElementById('eventTime').textContent = e.startStr.includes('T') ? dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-';
            document.getElementById('eventCurso').textContent = e.extendedProps.curso || '-';
            document.getElementById('eventTipo').textContent = e.extendedProps.tipo || '-';
            document.getElementById('eventDesc').textContent = e.extendedProps.description || e.description || '-';
            document.getElementById('eventModal').style.display = 'block';
          }
        });
        calendar.render();
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
