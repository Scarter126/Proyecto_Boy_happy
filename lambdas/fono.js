exports.handler = async () => {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Panel Fonoaudióloga - Colegio Boy Happy</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; display: flex; }
  aside { width: 220px; background: #f4f4f4; padding: 20px; height: 100vh; box-sizing: border-box; }
  main { flex: 1; padding: 20px; }
  h1 { color: #004080; }
  .section { display: none; }
  .active { display: block; }
  ul { list-style: none; padding: 0; }
  li { margin: 10px 0; cursor: pointer; }
  li:hover { text-decoration: underline; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  .btn { background: #0078d7; color: white; border: none; padding: 6px 10px; margin: 2px; cursor: pointer; border-radius: 6px; }
  .btn.red { background: #c00; }
  .logout-btn { background: #c00; color: #fff; border: none; padding: 8px 12px; cursor: pointer; }
</style>
</head>
<body>
<aside>
  <h2>Menú Fonoaudióloga</h2>
  <ul>
    <li onclick="showSection('agendados')">📋 Agendados</li>
    <li onclick="showSection('disponibilidad')">📅 Disponibilidad</li>
  </ul>
</aside>
<main>
  <button class="logout-btn" onclick="cerrarSesion()">🔒 Cerrar Sesión</button>

  <!-- Pacientes agendados -->
  <div id="agendados" class="section active">
    <h1>Pacientes Agendados</h1>
    <table id="agendadosTable">
      <thead>
        <tr>
          <th>Alumno</th>
          <th>RUT</th>
          <th>Fecha Nac.</th>
          <th>Apoderado</th>
          <th>Contacto</th>
          <th>Fecha Hora</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>

  <!-- Disponibilidad -->
  <div id="disponibilidad" class="section">
    <h1>Disponibilidad</h1>
    <p>Marca los horarios en los que no podrás trabajar:</p>
    <form id="dispForm">
      <label>Fecha</label>
      <input type="date" id="dispFecha" required>
      <label>Hora</label>
      <input type="time" id="dispHora" required>
      <button type="submit" class="btn">➕ Bloquear</button>
    </form>
    <h3>Horarios Bloqueados</h3>
    <ul id="dispLista"></ul>
  </div>
</main>

<script>
const apiUrl = '/prod/reservar-evaluacion';

function showSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function cerrarSesion() { window.location.href = '/prod'; }

// ----------------------
// Agendados
// ----------------------
async function loadAgendados() {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    const tbody = document.querySelector("#agendadosTable tbody");
    tbody.innerHTML = '';
    data.forEach(p => {
      if (p.nombreAlumno === 'Ocupado') return; // No mostrar bloqueos aquí
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${p.nombreAlumno}</td>
        <td>\${p.rutAlumno}</td>
        <td>\${p.fechaNacimiento}</td>
        <td>\${p.nombreApoderado}</td>
        <td>\${p.telefono} / \${p.correo}</td>
        <td>\${p.fechaHora}</td>
        <td>
          <button class="btn" onclick="aceptarPaciente('\${p.fechaHora}')">Aceptar</button>
          <button class="btn red" onclick="rechazarPaciente('\${p.fechaHora}')">Rechazar</button>
        </td>
      \`;
      tbody.appendChild(tr);
    });
  } catch(err) { console.error('Error cargando agendados:', err); }
}

async function aceptarPaciente(fechaHora) {
  await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'aceptar', fechaHora })
  });
  loadAgendados();
}

async function rechazarPaciente(fechaHora) {
  await fetch(apiUrl, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fechaHora })
  });
  loadAgendados();
}

// ----------------------
// Disponibilidad
// ----------------------
async function loadDisponibilidad() {
  const res = await fetch(apiUrl);
  const data = await res.json();
  const lista = document.getElementById("dispLista");
  lista.innerHTML = '';
  data.forEach(h => {
    if (h.nombreAlumno !== 'Ocupado') return;
    const li = document.createElement('li');
    li.textContent = h.fechaHora;
    const btn = document.createElement('button');
    btn.textContent = '❌';
    btn.classList.add('btn','red');
    btn.onclick = async () => {
      await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaHora: h.fechaHora })
      });
      loadDisponibilidad();
    };
    li.appendChild(btn);
    lista.appendChild(li);
  });
}

document.getElementById("dispForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fecha = document.getElementById("dispFecha").value;
  const hora = document.getElementById("dispHora").value;
  await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombreAlumno: 'Ocupado', fechaHora: \`\${fecha} \${hora}\` })
  });
  loadDisponibilidad();
});

document.addEventListener('DOMContentLoaded', () => {
  loadAgendados();
  loadDisponibilidad();
});
</script>
</body>
</html>
  `;
  return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html };
};
