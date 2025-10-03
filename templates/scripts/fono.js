// Configuración de prefijo de callback
const PREFIX = window.APP_CONFIG?.CALLBACK_PREFIX ?? '';
const apiUrl = `${PREFIX}/reservar-evaluacion`;

function showSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
  event.target.classList.add('active');
}

function cerrarSesion() {
  window.location.href = PREFIX;
}

// Cargar agendados
async function loadAgendados() {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    const tbody = document.querySelector("#agendadosTable tbody");
    tbody.innerHTML = '';
    data.forEach(p => {
      if (p.nombreAlumno === 'Ocupado') return; // No mostrar bloqueos aquí
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.nombreAlumno}</td>
        <td>${p.rutAlumno}</td>
        <td>${p.fechaNacimiento}</td>
        <td>${p.nombreApoderado}</td>
        <td>${p.telefono}<br>${p.correo}</td>
        <td>${p.fechaHora}</td>
        <td>
          <button class="btn btn-danger" onclick="cancelarReserva('${p.id}')">
            <i class="fas fa-times"></i> Cancelar
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch(err) {
    console.error('Error loading agendados:', err);
  }
}

async function cancelarReserva(id) {
  if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
  try {
    const res = await fetch(`${apiUrl}?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('Reserva cancelada');
      loadAgendados();
    } else {
      alert('Error al cancelar');
    }
  } catch(err) {
    console.error(err);
    alert('Error al cancelar');
  }
}

// Disponibilidad
async function loadDisponibilidad() {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    const bloqueados = data.filter(p => p.nombreAlumno === 'Ocupado');
    const ul = document.getElementById('dispLista');
    ul.innerHTML = bloqueados.map(b => `
      <li class="card" style="padding: 15px; margin-bottom: 10px;">
        <strong>${b.fechaHora}</strong>
        <button class="btn btn-danger btn-sm" onclick="desbloquear('${b.id}')" style="float: right;">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </li>
    `).join('') || '<li class="card">No hay horarios bloqueados.</li>';
  } catch(err) {
    console.error(err);
  }
}

async function desbloquear(id) {
  if (!confirm('¿Desbloquear este horario?')) return;
  try {
    const res = await fetch(`${apiUrl}?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('Horario desbloqueado');
      loadDisponibilidad();
    } else {
      alert('Error');
    }
  } catch(err) {
    console.error(err);
  }
}

document.getElementById('dispForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fecha = document.getElementById('dispFecha').value;
  const hora = document.getElementById('dispHora').value;
  const fechaHora = `${fecha} ${hora}`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreAlumno: 'Ocupado',
        rutAlumno: '00000000-0',
        fechaNacimiento: '2000-01-01',
        telefono: 'N/A',
        correo: 'N/A',
        nombreApoderado: 'Sistema',
        rutApoderado: '00000000-0',
        fechaHora: fechaHora
      })
    });

    if (res.ok) {
      alert('Horario bloqueado exitosamente');
      document.getElementById('dispForm').reset();
      loadDisponibilidad();
    } else {
      alert('Error al bloquear horario');
    }
  } catch(err) {
    console.error(err);
    alert('Error al bloquear horario');
  }
});

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', () => {
  loadAgendados();
  loadDisponibilidad();
});
