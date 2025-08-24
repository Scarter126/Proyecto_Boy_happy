exports.handler = async () => {
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Matrícula - Colegio Boy Happy</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #f4f6f9; }
      header { background:#004080; color:white; padding:1em; text-align:center; }
      h1 { margin: 0; }
      form { max-width: 520px; margin: 20px auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
      label { display: block; margin: 12px 0 5px; font-weight: 600; }
      input { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc; }
      button { margin-top: 20px; padding: 12px; width: 100%; background: #007a33; color: white; border: none; border-radius: 8px; cursor: pointer; }
      button:hover { background: #016528; }
      .requisitos { margin: 20px auto; max-width: 520px; font-size: 0.95rem; background:white; padding:16px; border-radius:12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      .back { text-align:center; margin: 20px; }
      .link { text-decoration:none; color:white; background:#004080; padding:10px 20px; border-radius:8px; }
      .link:hover { background:#0066cc; }
    </style>
  </head>
  <body>
    <header><h1>Formulario de Matrícula</h1></header>

    <form id="matriculaForm">
      <label>Nombre completo</label>
      <input type="text" name="nombre" required>

      <label>RUT</label>
      <input type="text" name="rut" required placeholder="12.345.678-9">

      <label>Fecha de nacimiento</label>
      <input type="date" name="fechaNacimiento" required>

      <label>Último curso cursado</label>
      <input type="text" name="ultimoCurso" required>

      <label>Correo electrónico</label>
      <input type="email" name="correo" required placeholder="ejemplo@correo.com">

      <label>Teléfono</label>
      <input type="tel" name="telefono" required placeholder="+56 9 1234 5678">

      <button type="submit">Enviar Matrícula</button>
    </form>

    <div class="requisitos">
      <h3>Requisitos de ingreso</h3>
      <ul>
        <li>Nivel Medio Mayor: 3 años cumplidos al 30 de marzo.</li>
        <li>I Nivel Transición (Pre-kínder): 4 años cumplidos al 30 de marzo.</li>
        <li>II Nivel Transición (Kínder): 5 años cumplidos al 30 de marzo.</li>
      </ul>
    </div>

    <div class="back">
      <a class="link" href="./">Volver al inicio</a>
    </div>

    <script>
      const form = document.getElementById('matriculaForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
          nombre: form.nombre.value,
          rut: form.rut.value,
          fechaNacimiento: form.fechaNacimiento.value,
          ultimoCurso: form.ultimoCurso.value,
          correo: form.correo.value,
          telefono: form.telefono.value
        };

        try {
          const res = await fetch('/prod/subir-matricula', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          const resultHtml = await res.text();
          document.body.innerHTML = resultHtml;
        } catch (err) {
          alert('Error al enviar la matrícula: ' + err.message);
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
