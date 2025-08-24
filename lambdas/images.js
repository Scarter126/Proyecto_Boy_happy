exports.handler = async () => {
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Galería - Colegio Boy Happy</title>
    <style>
      body { font-family: Arial, sans-serif; text-align: center; margin:0; background:#f4f8fb; }
      header { background:#004080; color:white; padding:1em; }
      .gallery {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px;
      }
      .gallery img { width: 100%; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
      a.btn { display:inline-block; margin:20px; text-decoration:none; color:white; background:#004080; padding:10px 20px; border-radius:8px; }
      a.btn:hover { background:#0066cc; }
    </style>
  </head>
  <body>
    <header><h1>Galería Colegio Boy Happy</h1></header>
    <div class="gallery">
      <img src="https://placekitten.com/300/200" alt="Foto 1">
      <img src="https://placekitten.com/301/200" alt="Foto 2">
      <img src="https://placekitten.com/302/200" alt="Foto 3">
    </div>
    <a class="btn" href="./">Volver al inicio</a>
  </body>
  </html>
  `;
  return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html };
};
