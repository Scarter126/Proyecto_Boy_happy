exports.handler = async () => {
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Evaluación Fonoaudiológica - Colegio Boy Happy</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #f4f6f9; }
      header { background:#004080; color:white; padding:1em; text-align:center; }
      h1 { margin: 0; }
      form { max-width: 520px; margin: 20px auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
      label { display: block; margin: 12px 0 5px; font-weight: 600; }
      input, select { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc; }
      button { margin-top: 20px; padding: 12px; width: 100%; background: #007a33; color: white; border: none; border-radius: 8px; cursor: pointer; }
      button:hover { background: #016528; }
      .back { text-align:center; margin: 20px; }
      .link { text-decoration:none; color:white; background:#004080; padding:10px 20px; border-radius:8px; }
      .link:hover { background:#0066cc; }
    </style>
  </head>
  <body>
    <header><h1>Solicitar Evaluación Fonoaudiológica</h1></header>

    <form id="evaluacionForm">
      <label>Nombre del alumno</label>
      <input type="text" name="nombreAlumno" required>

      <label>RUT del alumno</label>
      <input type="text" name="rutAlumno" required>

      <label>Fecha de nacimiento</label>
      <input type="date" name="fechaNacimiento" required>

      <label>Teléfono de contacto</label>
      <input type="tel" name="telefono" required placeholder="+56 9 1234 5678">

      <label>Correo electrónico</label>
      <input type="email" name="correo" required placeholder="ejemplo@correo.com">

      <label>Nombre del apoderado</label>
      <input type="text" name="nombreApoderado" required>

      <label>RUT del apoderado</label>
      <input type="text" name="rutApoderado" required>

      <label>Seleccione fecha y hora para la evaluación</label>
      <select name="fechaHora" id="horarios" required>
        <option>Cargando horarios disponibles...</option>
      </select>

      <button type="submit">Reservar Evaluación</button>
    </form>

    <div class="back">
      <a class="link" href="./">Volver al inicio</a>
    </div>

    <script>
      async function cargarHorariosDisponibles() {
        const res = await fetch('/prod/horarios-disponibles');
        const data = await res.json();
        const select = document.getElementById('horarios');
        select.innerHTML = ''; // Limpiar

        if (data.length === 0) {
          select.innerHTML = '<option disabled>No hay horarios disponibles</option>';
          return;
        }

        data.forEach(hora => {
          const option = document.createElement('option');
          option.value = hora;
          option.textContent = hora;
          select.appendChild(option);
        });
      }

      document.addEventListener('DOMContentLoaded', cargarHorariosDisponibles);

      const form = document.getElementById('evaluacionForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
          nombreAlumno: form.nombreAlumno.value,
          rutAlumno: form.rutAlumno.value,
          fechaNacimiento: form.fechaNacimiento.value,
          telefono: form.telefono.value,
          correo: form.correo.value,
          nombreApoderado: form.nombreApoderado.value,
          rutApoderado: form.rutApoderado.value,
          fechaHora: form.fechaHora.value
        };

        try {
          const res = await fetch('/prod/reservar-evaluacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          const resultHtml = await res.text();
          document.body.innerHTML = resultHtml;
        } catch (err) {
          alert('Error al reservar: ' + err.message);
          console.error(err);
        }
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
