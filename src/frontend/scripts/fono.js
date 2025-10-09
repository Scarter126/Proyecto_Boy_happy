// Proteger la página - verificar autenticación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  if (typeof requireAuth === 'function' && !requireAuth()) {
    return;
  }
});

// Configuración de prefijo de callback
const PREFIX = window.APP_CONFIG?.API_URL || '';

// Endpoints V3.0 - Lambdas consolidados
const agendaFonoUrl = `${PREFIX}/agenda-fono`;

function showSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
  event.target.classList.add('active');
}

// cerrarSesion() is now defined in auth.js (shared)

// Cargar agendados
async function loadAgendados() {
  try {
    const res = await fetch(agendaFonoUrl);
    const data = await res.json();
    const tbody = document.querySelector("#agendadosTable tbody");
    tbody.innerHTML = '';

    data.forEach(p => {
      if (p.nombreAlumno === 'Ocupado' || p.bloqueadoPorFono) return; // No mostrar bloqueos aquí

      const tr = document.createElement('tr');

      // Badge de estado
      let estadoBadge = '';
      if (p.aceptado) {
        estadoBadge = '<span class="badge-aceptado">✅ Aceptado</span>';
      } else {
        estadoBadge = '<span class="badge-pendiente">⏳ Pendiente</span>';
      }

      tr.innerHTML = `
        <td>${p.nombreAlumno}</td>
        <td>${p.rutAlumno}</td>
        <td>${p.fechaNacimiento || 'N/A'}</td>
        <td>${p.nombreApoderado || 'N/A'}</td>
        <td>${p.telefono || 'N/A'}<br>${p.correo || 'N/A'}</td>
        <td>${p.fechaHora}</td>
        <td>${estadoBadge}</td>
        <td>
          ${!p.aceptado ? `
            <button class="btn btn-success btn-sm" onclick="aceptarPaciente('${p.fechaHora}')">
              <i class="fas fa-check"></i> Aceptar
            </button>
          ` : ''}
          <button class="btn btn-danger btn-sm" onclick="cancelarReserva('${p.fechaHora}')">
            <i class="fas fa-times"></i> Cancelar
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (tbody.children.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px; color: #666;">No hay pacientes agendados</td></tr>';
    }
  } catch(err) {
    console.error('Error loading agendados:', err);
    alert('Error al cargar agendados');
  }
}

// Nueva función para aceptar paciente
async function aceptarPaciente(fechaHora) {
  if (!confirm('¿Confirmas que deseas aceptar a este paciente?')) return;

  try {
    const res = await fetch(agendaFonoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fechaHora,
        tipo: 'aceptar'
      })
    });

    if (res.ok) {
      alert('✅ Paciente aceptado correctamente');
      loadAgendados(); // Recargar lista
    } else {
      const error = await res.json();
      alert('❌ Error: ' + (error.error || 'No se pudo aceptar el paciente'));
    }
  } catch(err) {
    console.error('Error al aceptar paciente:', err);
    alert('❌ Error al aceptar paciente');
  }
}

async function cancelarReserva(fechaHora) {
  if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
  try {
    const res = await fetch(agendaFonoUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fechaHora })
    });

    if (res.ok) {
      alert('✅ Reserva cancelada');
      loadAgendados();
    } else {
      alert('❌ Error al cancelar');
    }
  } catch(err) {
    console.error(err);
    alert('❌ Error al cancelar');
  }
}

// Disponibilidad
async function loadDisponibilidad() {
  try {
    const res = await fetch(agendaFonoUrl);
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
    const res = await fetch(`${agendaFonoUrl}?id=${id}`, { method: 'DELETE' });
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
    const res = await fetch(agendaFonoUrl, {
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
  cargarAlumnosParaFono();

  // Establecer fecha actual por defecto en formularios
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('archivoFecha').value = hoy;
  document.getElementById('bitacoraFecha').value = hoy;
  document.getElementById('informeFecha').value = hoy;
});

// ========================================
// CU-42, 43, 44: GESTIÓN DE ARCHIVOS DE SESIONES
// ========================================

const archivosSesionUrl = `${PREFIX}/archivos-sesion`;

// Cargar alumnos en los selectores
async function cargarAlumnosParaFono() {
  try {
    const res = await fetch(`${PREFIX}/usuarios`);
    const usuarios = await res.json();
    const alumnos = usuarios.filter(u => u.rol === 'alumno');

    const selects = [
      'archivoAlumno',
      'filtroAlumnoArchivo',
      'bitacoraAlumno',
      'consultaBitacoraAlumno',
      'informeAlumno',
      'filtroAlumnoInforme'
    ];

    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select) {
        const esConsulta = selectId.includes('filtro') || selectId.includes('consulta');
        const opcionInicial = esConsulta ?
          '<option value="">Todos los alumnos</option>' :
          '<option value="">Seleccionar alumno</option>';

        select.innerHTML = opcionInicial + alumnos.map(a =>
          `<option value="${a.rut}" data-nombre="${a.nombre}">${a.nombre} - ${a.rut}</option>`
        ).join('');
      }
    });

  } catch (err) {
    console.error('Error cargando alumnos:', err);
  }
}

function mostrarFormularioArchivo() {
  document.getElementById('formArchivo').style.display = 'block';
  document.getElementById('tituloFormArchivo').textContent = 'Subir Archivo de Sesión';
  document.getElementById('archivoIdEditar').value = '';
  document.getElementById('archivoSesionForm').reset();
  document.getElementById('archivoFecha').value = new Date().toISOString().split('T')[0];
}

function ocultarFormularioArchivo() {
  document.getElementById('formArchivo').style.display = 'none';
}

// CU-42: Subir archivo de sesión
async function guardarArchivoSesion(event) {
  event.preventDefault();

  const id = document.getElementById('archivoIdEditar').value;
  const selectAlumno = document.getElementById('archivoAlumno');
  const selectedOption = selectAlumno.options[selectAlumno.selectedIndex];
  const archivoInput = document.getElementById('archivoArchivo');
  const archivo = archivoInput.files[0];

  if (!id && !archivo) {
    alert('Debe seleccionar un archivo');
    return;
  }

  const data = {
    rutAlumno: selectAlumno.value,
    nombreAlumno: selectedOption.dataset.nombre,
    fechaSesion: document.getElementById('archivoFecha').value,
    tipoArchivo: document.getElementById('archivoTipo').value,
    descripcion: document.getElementById('archivoDescripcion').value
  };

  try {
    if (archivo) {
      // Convertir archivo a base64 para enviar
      const reader = new FileReader();
      reader.onload = async function() {
        data.nombreArchivo = archivo.name;
        data.contentType = archivo.type;
        data.archivoData = reader.result;

        let res;
        if (id) {
          res = await fetch(`${archivosSesionUrl}?id=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        } else {
          res = await fetch(archivosSesionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        }

        if (res.ok) {
          alert(`✅ Archivo ${id ? 'actualizado' : 'subido'} correctamente`);
          ocultarFormularioArchivo();
          cargarArchivosSesion();
        } else {
          const error = await res.json();
          alert('❌ Error: ' + (error.error || 'No se pudo guardar'));
        }
      };
      reader.readAsDataURL(archivo);
    } else if (id) {
      // Actualizar solo metadatos
      const res = await fetch(`${archivosSesionUrl}?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        alert('✅ Archivo actualizado correctamente');
        ocultarFormularioArchivo();
        cargarArchivosSesion();
      } else {
        const error = await res.json();
        alert('❌ Error: ' + (error.error || 'No se pudo actualizar'));
      }
    }

  } catch (err) {
    console.error('Error guardando archivo:', err);
    alert('❌ Error al guardar el archivo');
  }
}

async function cargarArchivosSesion() {
  const rutAlumno = document.getElementById('filtroAlumnoArchivo').value;
  const tipo = document.getElementById('filtroTipoArchivo').value;

  try {
    let url = `${archivosSesionUrl}?`;
    if (rutAlumno) url += `rutAlumno=${rutAlumno}&`;
    if (tipo) url += `tipo=${tipo}`;

    const res = await fetch(url);
    const archivos = await res.json();

    if (!archivos || archivos.length === 0) {
      document.getElementById('listaArchivos').innerHTML = `
        <div class="card">
          <p style="text-align: center; color: #666;">No se encontraron archivos</p>
        </div>
      `;
      return;
    }

    const html = archivos.map(arch => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <i class="fas fa-file-${getFileIconType(arch.nombreArchivo)} fa-2x" style="color: var(--purple-main);"></i>
              <div>
                <h4 style="margin: 0;">${arch.nombreArchivo}</h4>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9em;">
                  ${arch.nombreAlumno} | ${arch.tipoArchivo} | ${new Date(arch.fechaSesion).toLocaleDateString()}
                </p>
              </div>
            </div>
            ${arch.descripcion ? `<p>${arch.descripcion}</p>` : ''}
            <p style="font-size: 0.85em; color: #999;">
              Subido: ${new Date(arch.fechaSubida).toLocaleString()}
            </p>
          </div>
          <div style="display: flex; gap: 5px;">
            <button class="btn-sm btn-primary" onclick="descargarArchivoSesion('${arch.id}')" title="Descargar">
              <i class="fas fa-download"></i>
            </button>
            <button class="btn-sm btn-secondary" onclick="editarArchivoSesion('${arch.id}')" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-sm btn-danger" onclick="eliminarArchivoSesion('${arch.id}')" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    document.getElementById('listaArchivos').innerHTML = html;

  } catch (err) {
    console.error('Error cargando archivos:', err);
    document.getElementById('listaArchivos').innerHTML = `
      <div class="card"><p style="text-align: center; color: red;">Error al cargar archivos</p></div>
    `;
  }
}

function getFileIconType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const iconMap = {
    'pdf': 'pdf',
    'doc': 'word', 'docx': 'word',
    'xls': 'excel', 'xlsx': 'excel',
    'jpg': 'image', 'jpeg': 'image', 'png': 'image'
  };
  return iconMap[ext] || 'alt';
}

// CU-43: Modificar archivo
async function editarArchivoSesion(id) {
  try {
    const res = await fetch(`${archivosSesionUrl}?id=${id}`);
    const archivo = await res.json();

    document.getElementById('formArchivo').style.display = 'block';
    document.getElementById('tituloFormArchivo').textContent = 'Editar Archivo de Sesión';
    document.getElementById('archivoIdEditar').value = archivo.id;
    document.getElementById('archivoAlumno').value = archivo.rutAlumno;
    document.getElementById('archivoFecha').value = archivo.fechaSesion.split('T')[0];
    document.getElementById('archivoTipo').value = archivo.tipoArchivo;
    document.getElementById('archivoDescripcion').value = archivo.descripcion || '';

  } catch (err) {
    console.error('Error cargando archivo:', err);
    alert('❌ Error al cargar archivo');
  }
}

// CU-44: Eliminar archivo
async function eliminarArchivoSesion(id) {
  if (!confirm('¿Eliminar este archivo? Esta acción no se puede deshacer.')) return;

  try {
    const res = await fetch(`${archivosSesionUrl}?id=${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('✅ Archivo eliminado correctamente');
      cargarArchivosSesion();
    } else {
      alert('❌ Error al eliminar archivo');
    }
  } catch (err) {
    console.error('Error eliminando archivo:', err);
    alert('❌ Error al eliminar archivo');
  }
}

async function descargarArchivoSesion(id) {
  try {
    const res = await fetch(`${archivosSesionUrl}?id=${id}`);
    const archivo = await res.json();

    if (archivo.downloadURL) {
      window.open(archivo.downloadURL, '_blank');
    } else {
      alert('❌ No se pudo obtener el enlace de descarga');
    }
  } catch (err) {
    console.error('Error descargando archivo:', err);
    alert('❌ Error al descargar archivo');
  }
}

// ========================================
// CU-45: BITÁCORA DE SESIONES TERAPÉUTICAS
// ========================================

const bitacoraUrl = `${PREFIX}/bitacora-fono`;

async function guardarBitacoraSesion(event) {
  event.preventDefault();

  const selectAlumno = document.getElementById('bitacoraAlumno');
  const selectedOption = selectAlumno.options[selectAlumno.selectedIndex];

  const bitacora = {
    rutAlumno: selectAlumno.value,
    nombreAlumno: selectedOption.dataset.nombre,
    fechaSesion: document.getElementById('bitacoraFecha').value,
    duracion: parseInt(document.getElementById('bitacoraDuracion').value),
    objetivosTrabajados: document.getElementById('bitacoraObjetivos').value,
    actividadesRealizadas: document.getElementById('bitacoraActividades').value,
    resultados: document.getElementById('bitacoraResultados').value,
    proximosPasos: document.getElementById('bitacoraSiguientePaso').value
  };

  try {
    const res = await fetch(bitacoraUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bitacora)
    });

    if (res.ok) {
      alert('✅ Sesión registrada correctamente');
      document.getElementById('bitacoraForm').reset();
      document.getElementById('bitacoraFecha').value = new Date().toISOString().split('T')[0];
      consultarBitacoraSesion();
    } else {
      const error = await res.json();
      alert('❌ Error: ' + (error.error || 'No se pudo guardar'));
    }
  } catch (err) {
    console.error('Error guardando bitácora:', err);
    alert('❌ Error al guardar sesión');
  }
}

async function consultarBitacoraSesion() {
  const rutAlumno = document.getElementById('consultaBitacoraAlumno').value;
  const fechaInicio = document.getElementById('consultaBitacoraFechaInicio').value;
  const fechaFin = document.getElementById('consultaBitacoraFechaFin').value;

  try {
    let url = `${bitacoraUrl}?`;
    if (rutAlumno) url += `rutAlumno=${rutAlumno}&`;
    if (fechaInicio) url += `fechaInicio=${fechaInicio}&`;
    if (fechaFin) url += `fechaFin=${fechaFin}`;

    const res = await fetch(url);
    const registros = await res.json();

    if (!registros || registros.length === 0) {
      document.getElementById('listaBitacora').innerHTML = `
        <div class="card">
          <p style="text-align: center; color: #666;">No hay registros de bitácora</p>
        </div>
      `;
      return;
    }

    const html = registros.map(bit => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <h4><i class="fas fa-user"></i> ${bit.nombreAlumno}</h4>
            <p><strong>Fecha:</strong> ${new Date(bit.fechaSesion).toLocaleDateString()} | <strong>Duración:</strong> ${bit.duracion} min</p>

            <div style="margin-top: 15px;">
              <p><strong>Objetivos Trabajados:</strong></p>
              <p>${bit.objetivosTrabajados}</p>
            </div>

            <div style="margin-top: 10px;">
              <p><strong>Actividades:</strong></p>
              <p>${bit.actividadesRealizadas}</p>
            </div>

            <div style="margin-top: 10px;">
              <p><strong>Resultados/Observaciones:</strong></p>
              <p>${bit.resultados}</p>
            </div>

            ${bit.proximosPasos ? `
              <div style="margin-top: 10px; padding: 10px; background: #f0f8ff; border-radius: 8px;">
                <p><strong>Próximos Pasos:</strong></p>
                <p>${bit.proximosPasos}</p>
              </div>
            ` : ''}

            <p style="font-size: 0.85em; color: #999; margin-top: 10px;">
              Registrado: ${new Date(bit.timestamp).toLocaleString()}
            </p>
          </div>
          <button class="btn-sm btn-danger" onclick="eliminarBitacora('${bit.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

    document.getElementById('listaBitacora').innerHTML = html;

  } catch (err) {
    console.error('Error consultando bitácora:', err);
    document.getElementById('listaBitacora').innerHTML = `
      <div class="card"><p style="text-align: center; color: red;">Error al cargar bitácora</p></div>
    `;
  }
}

async function eliminarBitacora(id) {
  if (!confirm('¿Eliminar este registro de bitácora?')) return;

  try {
    const res = await fetch(`${bitacoraUrl}?id=${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('✅ Registro eliminado');
      consultarBitacoraSesion();
    } else {
      alert('❌ Error al eliminar');
    }
  } catch (err) {
    console.error('Error eliminando bitácora:', err);
    alert('❌ Error al eliminar registro');
  }
}

// ========================================
// CU-46, 47, 48: INFORMES DE EVALUACIÓN
// ========================================

const informesUrl = `${PREFIX}/informes-fono`;

function mostrarFormularioInforme() {
  document.getElementById('formInforme').style.display = 'block';
  document.getElementById('tituloFormInforme').textContent = 'Crear Informe de Evaluación';
  document.getElementById('informeIdEditar').value = '';
  document.getElementById('informeForm').reset();
  document.getElementById('informeFecha').value = new Date().toISOString().split('T')[0];
}

function ocultarFormularioInforme() {
  document.getElementById('formInforme').style.display = 'none';
}

// CU-46: Crear informe
async function guardarInforme(event) {
  event.preventDefault();

  const id = document.getElementById('informeIdEditar').value;
  const selectAlumno = document.getElementById('informeAlumno');
  const selectedOption = selectAlumno.options[selectAlumno.selectedIndex];

  const informe = {
    rutAlumno: selectAlumno.value,
    nombreAlumno: selectedOption.dataset.nombre,
    fechaEvaluacion: document.getElementById('informeFecha').value,
    tipoEvaluacion: document.getElementById('informeTipo').value,
    motivoConsulta: document.getElementById('informeMotivo').value,
    antecedentes: document.getElementById('informeAntecedentes').value,
    resultadosEvaluacion: document.getElementById('informeEvaluacion').value,
    diagnostico: document.getElementById('informeDiagnostico').value,
    recomendaciones: document.getElementById('informeRecomendaciones').value
  };

  try {
    let res;
    if (id) {
      res = await fetch(`${informesUrl}?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(informe)
      });
    } else {
      res = await fetch(informesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(informe)
      });
    }

    if (res.ok) {
      alert(`✅ Informe ${id ? 'actualizado' : 'creado'} correctamente`);
      ocultarFormularioInforme();
      cargarInformes();
    } else {
      const error = await res.json();
      alert('❌ Error: ' + (error.error || 'No se pudo guardar'));
    }
  } catch (err) {
    console.error('Error guardando informe:', err);
    alert('❌ Error al guardar informe');
  }
}

async function cargarInformes() {
  const rutAlumno = document.getElementById('filtroAlumnoInforme').value;
  const tipo = document.getElementById('filtroTipoInforme').value;

  try {
    let url = `${informesUrl}?`;
    if (rutAlumno) url += `rutAlumno=${rutAlumno}&`;
    if (tipo) url += `tipo=${tipo}`;

    const res = await fetch(url);
    const informes = await res.json();

    if (!informes || informes.length === 0) {
      document.getElementById('listaInformes').innerHTML = `
        <div class="card">
          <p style="text-align: center; color: #666;">No se encontraron informes</p>
        </div>
      `;
      return;
    }

    const html = informes.map(inf => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
              <span class="badge" style="background: var(--blue-main); color: white; padding: 5px 12px; border-radius: 15px;">
                ${getTipoInformeLabel(inf.tipoEvaluacion)}
              </span>
              <h4 style="margin: 0;">${inf.nombreAlumno}</h4>
            </div>

            <p><strong>Fecha:</strong> ${new Date(inf.fechaEvaluacion).toLocaleDateString()}</p>

            <div style="margin-top: 10px;">
              <p><strong>Motivo:</strong> ${inf.motivoConsulta}</p>
            </div>

            ${inf.antecedentes ? `
              <div style="margin-top: 10px;">
                <p><strong>Antecedentes:</strong> ${inf.antecedentes}</p>
              </div>
            ` : ''}

            <div style="margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 8px;">
              <p><strong>Diagnóstico:</strong></p>
              <p>${inf.diagnostico}</p>
            </div>

            <p style="font-size: 0.85em; color: #999; margin-top: 10px;">
              Creado: ${new Date(inf.timestamp).toLocaleString()}
            </p>
          </div>
          <div style="display: flex; gap: 5px; flex-direction: column;">
            <button class="btn-sm btn-success" onclick="verDetalleInforme('${inf.id}')" title="Ver Detalle">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn-sm btn-primary" onclick="descargarPDFInforme('${inf.id}')" title="Descargar PDF">
              <i class="fas fa-file-pdf"></i>
            </button>
            <button class="btn-sm btn-secondary" onclick="editarInforme('${inf.id}')" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-sm btn-danger" onclick="eliminarInforme('${inf.id}')" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    document.getElementById('listaInformes').innerHTML = html;

  } catch (err) {
    console.error('Error cargando informes:', err);
    document.getElementById('listaInformes').innerHTML = `
      <div class="card"><p style="text-align: center; color: red;">Error al cargar informes</p></div>
    `;
  }
}

function getTipoInformeLabel(tipo) {
  const labels = {
    'inicial': 'Evaluación Inicial',
    'seguimiento': 'Seguimiento',
    'alta': 'Alta',
    'derivacion': 'Derivación'
  };
  return labels[tipo] || tipo;
}

async function verDetalleInforme(id) {
  try {
    const res = await fetch(`${informesUrl}?id=${id}`);
    const inf = await res.json();

    const detalle = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INFORME DE EVALUACIÓN FONOAUDIOLÓGICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PACIENTE: ${inf.nombreAlumno}
FECHA: ${new Date(inf.fechaEvaluacion).toLocaleDateString()}
TIPO: ${getTipoInformeLabel(inf.tipoEvaluacion)}

MOTIVO DE CONSULTA:
${inf.motivoConsulta}

${inf.antecedentes ? `ANTECEDENTES:
${inf.antecedentes}

` : ''}RESULTADOS DE EVALUACIÓN:
${inf.resultadosEvaluacion}

DIAGNÓSTICO FONOAUDIOLÓGICO:
${inf.diagnostico}

RECOMENDACIONES:
${inf.recomendaciones}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;

    alert(detalle);

  } catch (err) {
    console.error('Error:', err);
    alert('❌ Error al obtener informe');
  }
}

// CU-47: Modificar informe
async function editarInforme(id) {
  try {
    const res = await fetch(`${informesUrl}?id=${id}`);
    const inf = await res.json();

    document.getElementById('formInforme').style.display = 'block';
    document.getElementById('tituloFormInforme').textContent = 'Editar Informe de Evaluación';
    document.getElementById('informeIdEditar').value = inf.id;
    document.getElementById('informeAlumno').value = inf.rutAlumno;
    document.getElementById('informeFecha').value = inf.fechaEvaluacion.split('T')[0];
    document.getElementById('informeTipo').value = inf.tipoEvaluacion;
    document.getElementById('informeMotivo').value = inf.motivoConsulta;
    document.getElementById('informeAntecedentes').value = inf.antecedentes || '';
    document.getElementById('informeEvaluacion').value = inf.resultadosEvaluacion;
    document.getElementById('informeDiagnostico').value = inf.diagnostico;
    document.getElementById('informeRecomendaciones').value = inf.recomendaciones;

    document.getElementById('formInforme').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error('Error cargando informe:', err);
    alert('❌ Error al cargar informe');
  }
}

// CU-48: Eliminar informe
async function eliminarInforme(id) {
  if (!confirm('¿Eliminar este informe? Esta acción no se puede deshacer.')) return;

  try {
    const res = await fetch(`${informesUrl}?id=${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('✅ Informe eliminado correctamente');
      cargarInformes();
    } else {
      alert('❌ Error al eliminar informe');
    }
  } catch (err) {
    console.error('Error eliminando informe:', err);
    alert('❌ Error al eliminar informe');
  }
}

async function descargarPDFInforme(id) {
  alert('📄 Funcionalidad de generación PDF en desarrollo.\n\nPróximamente podrás descargar el informe en formato PDF.');
  // TODO: Implementar generación de PDF con jsPDF o similar
}

function generarPDFInforme() {
  alert('📄 Funcionalidad de generación PDF en desarrollo.\n\nGuarda primero el informe y luego podrás descargarlo como PDF.');
}
