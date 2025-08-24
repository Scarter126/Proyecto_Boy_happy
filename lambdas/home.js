exports.handler = async () => {
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Colegio Boy Happy</title>
    <link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
    <style>
      body { font-family: Arial, sans-serif; margin:0; background:#f4f8fb; color:#333; }
      header { background:#004080; color:white; padding:1em; text-align:center; }
      nav ul { list-style:none; display:flex; justify-content:center; gap:1.5em; padding:0; margin:0.5em 0 0 0; }
      nav a { color:white; text-decoration:none; font-weight:bold; }
      main { padding:2em; }
      h2 { color:#004080; }
      section { margin:2em 0; padding:1.5em; background:white; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.1); }
      button { margin:0.5em; padding:0.8em 1.2em; font-size:1em; border:none; border-radius:6px; background:#004080; color:white; cursor:pointer; transition:0.3s; }
      button:hover { background:#0066cc; }
      .login-group { display:flex; flex-wrap:wrap; gap:1em; justify-content:center; }
      footer { background:#004080; color:white; text-align:center; padding:1em; margin-top:2em; }
      #calendar { max-width:900px; margin:2em auto; background:white; border-radius:8px; padding:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1); }
      .modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; }
      .modal-content { background:white; padding:20px; margin:10% auto; width:400px; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.3); }
      .modal-content h3 { margin-top:0; }
      .close-btn { float:right; cursor:pointer; color:#c00; font-weight:bold; }
    </style>
  </head>
  <body>
    <header>
      <h1>Colegio Boy Happy</h1>
      <nav>
        <ul>
          <li><a href="/prod/">Inicio</a></li>
          <li><a href="/prod/imagenes">Galería</a></li>
          <li><a href="/prod/matriculas">Matrícula</a></li>
          <li><a href="/prod/login/admin">Login Admin</a></li>
        </ul>
      </nav>
    </header>

    <main>
      <section>
        <h2>Próximos Eventos</h2>
        <div id="calendar"></div>
      </section>

      <section>
        <h2>Nuestra Misión</h2>
        <p>Formar estudiantes íntegros con excelencia académica, valores y responsabilidad social.</p>
        <h2>Nuestra Visión</h2>
        <p>Ser reconocidos como un colegio líder en educación integral, innovadora y de calidad.</p>
      </section>

      <section>
        <h2>Explora más</h2>
        <a href="/prod/imagenes"><button>📷 Galería de Imágenes</button></a>
        <a href="/prod/matriculas"><button>📝 Matricúlate</button></a>
      </section>

      <section>
        <h2>Iniciar Sesión</h2>
        <div class="login-group">
          <a href="/prod/login/admin"><button>🔑 Rectora / Admin</button></a>
          <a href="/prod/login/profesores"><button>👩‍🏫 Profesores</button></a>
          <a href="/prod/login/alumnos"><button>🎓 Alumnos</button></a>
        </div>
      </section>
    </main>

    <footer>
      <p>&copy; 2025 Colegio Boy Happy</p>
    </footer>

    <!-- Modal para evento -->
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
      function closeModal() {
        document.getElementById('eventModal').style.display = 'none';
      }

      document.addEventListener('DOMContentLoaded', async function() {
        const calendarEl = document.getElementById('calendar');
        const calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          locale: 'es',
          height: 600,
          headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
          events: async function(fetchInfo, successCallback, failureCallback) {
            try {
              const apiUrl = 'https://ut3w3fmb33.execute-api.us-east-1.amazonaws.com/prod/eventos';
              const res = await fetch(apiUrl, { method: 'GET', mode: 'cors' });
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

  return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html };
};
