// Configuración de prefijo de callback
const PREFIX = window.APP_CONFIG?.API_URL || '';

async function cargarHorariosDisponibles() {
  // ✅ CORREGIDO: usar /agenda-fono y filtrar horas disponibles (no bloqueadas, futuras)
  const res = await fetch(`${PREFIX}/agenda-fono`);
  const data = await res.json();
  const select = document.getElementById('horarios');
  select.innerHTML = '';

  // Filtrar solo fechas futuras y no bloqueadas
  const ahora = new Date();
  const horasDisponibles = data
    .filter(item => {
      const fechaHora = new Date(item.fechaHora);
      return fechaHora > ahora &&
             item.tipo !== 'bloqueo' &&
             item.estado !== 'reservado';
    })
    .map(item => item.fechaHora)
    .sort();

  if (horasDisponibles.length === 0) {
    select.innerHTML = '<option disabled>No hay horarios disponibles</option>';
    return;
  }

  horasDisponibles.forEach(hora => {
    const option = document.createElement('option');
    option.value = hora;
    // Formatear fecha para mostrar más legible
    const fecha = new Date(hora);
    option.textContent = fecha.toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
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
    fechaHora: form.horarios.value
  };

  try {
    const res = await fetch(`${PREFIX}/reservar-evaluacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      alert('✅ Evaluación reservada exitosamente.\n\nRecibirá un correo de confirmación.');
      form.reset();
      cargarHorariosDisponibles();
    } else {
      alert('❌ Error al reservar: ' + (result.error || 'Intente nuevamente'));
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error al procesar la reserva. Por favor intente nuevamente.');
  }
});
