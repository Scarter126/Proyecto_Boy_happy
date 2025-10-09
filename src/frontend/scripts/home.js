// Las variables de configuración ya están definidas globalmente en home.html
// API_URL, CLIENT_ID, COGNITO_DOMAIN, CALLBACK_PREFIX, REDIRECT_URI

// Componente Alpine para cargar información general
document.addEventListener('alpine:init', () => {
  Alpine.data('ubicacionData', () => ({
    nombre: 'Boy Happy',
    direccion: '',
    telefono: '',
    email: '',
    anoEscolar: new Date().getFullYear(),

    async init() {
      await this.cargarInformacion();
    },

    async cargarInformacion() {
      try {
        const response = await fetch(`${API_URL}/configuracion?key=informacion-general`);
        if (response.ok) {
          const data = await response.json();
          this.nombre = data.nombre || 'Boy Happy';
          this.direccion = data.direccion || 'Los Jardines 727, Ñuñoa, Santiago';
          this.telefono = data.telefono || '+56 9 8668 1455';
          this.email = data.email || 'contacto@boyhappy.cl';
          this.anoEscolar = data.anoEscolar || new Date().getFullYear();
        }
      } catch (error) {
        console.error('Error cargando información general:', error);
        // Usar valores por defecto si hay error
        this.direccion = 'Los Jardines 727, Ñuñoa, Santiago';
        this.telefono = '+56 9 8668 1455';
      }
    }
  }));
});

// Función para ir directo al login de Cognito o al dashboard si ya está autenticado
window.irACognito = function() {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    // Si ya está autenticado, redirigir a su dashboard
    if (token && userRole) {
        const roleRoutes = {
            'admin': './admin',
            'profesor': './profesores',
            'fono': './fono',
            'alumno': './alumnos'
        };

        const route = roleRoutes[userRole] || './';
        window.location.href = route;
        return;
    }

    // Si no está autenticado, ir al login de Cognito
    const loginUrl = `https://${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.href = loginUrl;
}

// Carousel functionality
let currentSlide = 0;
const slides = document.querySelectorAll('.carousel-slide');
const indicators = document.querySelectorAll('.indicator');

function showSlide(index) {
    slides.forEach(slide => slide.classList.remove('active'));
    indicators.forEach(indicator => indicator.classList.remove('active'));

    if (index >= slides.length) currentSlide = 0;
    if (index < 0) currentSlide = slides.length - 1;

    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
}

window.changeSlide = function(direction) {
    currentSlide += direction;
    showSlide(currentSlide);
}

window.goToSlide = function(index) {
    currentSlide = index;
    showSlide(currentSlide);
}

// Auto-play carousel
setInterval(() => {
    changeSlide(1);
}, 5000);

// Map initialization
function initMap() {
    const map = L.map('map').setView([-33.4372, -70.6506], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const customIcon = L.divIcon({
        html: '<div style="background: linear-gradient(135deg, #7B1FA2 0%, #AD1457 100%); width: 40px; height: 40px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    L.marker([-33.4372, -70.6506], { icon: customIcon })
        .addTo(map)
        .bindPopup('<b>Boy Happy</b><br>Los Jardines 727, Ñuñoa')
        .openPopup();
}

// Cargar equipo profesional dinámicamente con caché de 24 horas
async function cargarEquipoProfesional() {
    const CACHE_KEY = 'profesionales_cache';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

    try {
        // Intentar cargar desde caché
        const cached = localStorage.getItem(CACHE_KEY);
        let profesionales = null;

        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const isExpired = (Date.now() - timestamp) > CACHE_DURATION;

            if (!isExpired) {
                console.log('Cargando profesionales desde caché');
                profesionales = data;
            }
        }

        // Si no hay caché válido, cargar desde API
        if (!profesionales) {
            console.log('Cargando profesionales desde API');
            const response = await fetch(`${API_URL}/profesionales`);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            profesionales = await response.json();

            // Guardar en caché
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: profesionales,
                timestamp: Date.now()
            }));
        }

        // Si no hay profesionales, ocultar toda la sección
        const section = document.querySelector('#profesionales');
        if (!profesionales || profesionales.length === 0) {
            console.log('No hay profesionales disponibles');
            if (section) section.style.display = 'none';
            return;
        }

        // Mostrar la sección si estaba oculta
        if (section) section.style.display = 'block';

        // Renderizar grid de profesionales
        const grid = document.getElementById('professionalsGrid');
        grid.innerHTML = profesionales.map(prof => `
            <div class="professional-card">
                <div class="professional-avatar">
                    <i class="fas fa-user-md"></i>
                </div>
                <h3>${prof.nombre}</h3>
                <p class="professional-title">${prof.especialidad || getTituloPorRol(prof.rol)}</p>
                <p class="professional-desc">${prof.descripcion || 'Profesional de la educación dedicado al desarrollo integral de nuestros estudiantes.'}</p>
                ${prof.badges ? `
                    <div class="professional-badges">
                        ${prof.badges.map(badge => `<span class="badge">${badge}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');

    } catch (error) {
        console.error('Error al cargar profesionales:', error);

        // Ocultar toda la sección en caso de error
        const section = document.querySelector('#profesionales');
        if (section) section.style.display = 'none';
    }
}

function getTituloPorRol(rol) {
    const titulos = {
        'admin': 'Director/a',
        'profesor': 'Profesor/a',
        'fono': 'Fonoaudiólogo/a'
    };
    return titulos[rol] || 'Profesional';
}

// Initialize map and load professionals when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    cargarEquipoProfesional();

    // Establecer fecha máxima para fecha de nacimiento (hoy)
    const birthDateInput = document.getElementById('birthDate');
    if (birthDateInput) {
        const hoy = new Date();
        const fechaMaxima = hoy.toISOString().split('T')[0];
        birthDateInput.setAttribute('max', fechaMaxima);
    }

    // Verificar si se debe abrir el modal de login automáticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showLogin') === 'true') {
        // Abrir modal de login automáticamente
        window.openLoginModal();
        // Limpiar el parámetro de la URL sin recargar la página
        window.history.replaceState({}, document.title, '/');
    }
});

// Modal functionality - Expose to global scope for inline onclick handlers
window.openLoginModal = function() {
    document.getElementById('loginModal').classList.add('show');
    window.closeContactModal();
}

window.closeLoginModal = function() {
    document.getElementById('loginModal').classList.remove('show');
}

window.openContactModal = function() {
    document.getElementById('contactModal').classList.add('show');
}

window.closeContactModal = function() {
    document.getElementById('contactModal').classList.remove('show');
}

window.openSuccessModal = function(message) {
    document.getElementById('successMessage').textContent = message;
    document.getElementById('successModal').classList.add('show');
}

window.closeSuccessModal = function() {
    document.getElementById('successModal').classList.remove('show');
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
}

// Form submissions
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // LOGIN COGNITO
    const loginUrl = `https://${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.href = loginUrl;
});

document.getElementById('contactForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const contacto = {
        nombre: formData.get('nombre') || e.target.querySelector('input[type="text"]').value,
        email: formData.get('email') || e.target.querySelector('input[type="email"]').value,
        mensaje: formData.get('mensaje') || e.target.querySelector('textarea').value
    };

    try {
        const response = await fetch(`${API_URL}/contacto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contacto)
        });

        if (response.ok) {
            const result = await response.json();
            closeContactModal();
            openSuccessModal(result.message || '¡Mensaje enviado! Te contactaremos pronto.');
            e.target.reset();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'No se pudo enviar el mensaje'));
        }
    } catch (error) {
        console.error('Error al enviar mensaje de contacto:', error);
        alert('Error de conexión al enviar el mensaje');
    }
});

// Validador de RUT chileno
function validarRUT(rut) {
    rut = rut.replace(/\./g, '').replace(/-/g, '');
    if (rut.length < 2) return false;

    const cuerpo = rut.slice(0, -1);
    const dv = rut.slice(-1).toUpperCase();

    let suma = 0;
    let multiplicador = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo.charAt(i)) * multiplicador;
        multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const dvEsperado = 11 - (suma % 11);
    const dvCalculado = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : dvEsperado.toString();

    return dv === dvCalculado;
}

// Formatear RUT mientras se escribe
function formatearRUT(input) {
    let valor = input.value.replace(/\./g, '').replace(/-/g, '');

    if (valor.length > 1) {
        const cuerpo = valor.slice(0, -1);
        const dv = valor.slice(-1);
        valor = cuerpo + '-' + dv;
    }

    input.value = valor;
}

// Validar formato de teléfono chileno
function validarTelefono(telefono) {
    // Eliminar espacios para validación
    const telefonoLimpio = telefono.replace(/\s/g, '');

    // Debe comenzar con +56 y tener máximo 12 caracteres totales
    // Formato válido: +56912345678 (12 caracteres)
    if (!telefonoLimpio.startsWith('+56')) {
        return false;
    }

    if (telefonoLimpio.length > 12) {
        return false;
    }

    // Verificar que después del +56 solo haya números
    const numeros = telefonoLimpio.substring(3);
    return /^\d+$/.test(numeros);
}

document.getElementById('bookingForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const studentName = document.getElementById('patientName').value;
    const studentRut = document.getElementById('studentRut').value;
    const birthDate = document.getElementById('birthDate').value;
    const parentEmail = document.getElementById('parentEmail').value;
    const phone = document.getElementById('phone').value;
    const horarioEvaluacion = document.getElementById('horarioSelect').value;

    if (!studentName || !studentRut || !birthDate || !parentEmail || !phone || !horarioEvaluacion) {
        alert('Por favor complete todos los campos obligatorios (*)');
        return;
    }

    // Validar RUT
    if (!validarRUT(studentRut)) {
        alert('❌ RUT inválido. Por favor verifica el RUT del estudiante.');
        return;
    }

    // Validar fecha de nacimiento (no puede ser futura)
    const fechaNac = new Date(birthDate);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaNac > hoy) {
        alert('❌ La fecha de nacimiento no puede ser futura.');
        return;
    }

    // Validar teléfono
    if (!validarTelefono(phone)) {
        alert('❌ Teléfono inválido. Debe comenzar con +56 y tener máximo 12 dígitos (ej: +56912345678).');
        return;
    }

    // Enviar directamente sin modal de confirmación
    await submitEnrollmentDirect();
});

// Formatear RUT automáticamente
const rutInput = document.getElementById('studentRut');
if (rutInput) {
    rutInput.addEventListener('blur', function() {
        formatearRUT(this);
    });
}

// Mobile menu toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');

        // Skip if it's just '#' (like login button with onclick)
        if (href === '#') {
            return;
        }

        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // Close mobile menu if open
            navMenu.classList.remove('active');
        }
    });
});

// Add scroll effect to navbar
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    } else {
        navbar.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    }
});

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'fadeInUp 1s ease forwards';
        }
    });
}, observerOptions);

// Observe all sections
document.querySelectorAll('section').forEach(section => {
    observer.observe(section);
});

// Verificar si el usuario ya está autenticado
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (token && userRole) {
        const loginBtn = document.querySelector('.btn-login');
        if (loginBtn) {
            loginBtn.textContent = 'Mi Panel';

            // Mapear rol a ruta correspondiente
            const roleRoutes = {
                'admin': './admin',
                'profesor': './profesores',
                'fono': './fono',
                'alumno': './alumnos'
            };

            // Cambiar el href para que funcione sin onclick también
            const route = roleRoutes[userRole] || './';
            loginBtn.setAttribute('href', route);
        }
    }
}

// Modal de confirmación de reserva
function openConfirmModal() {
    document.getElementById('confirmBookingModal').classList.add('show');
}

window.closeConfirmModal = function() {
    document.getElementById('confirmBookingModal').classList.remove('show');
}

window.submitEnrollmentDirect = async function() {
    const nombreAlumno = document.getElementById('patientName').value;
    const rutAlumno = document.getElementById('studentRut').value;
    const fechaNacimiento = document.getElementById('birthDate').value;
    const nombreApoderado = document.getElementById('guardianName').value;
    const rutApoderado = document.getElementById('guardianRut').value;
    const correo = document.getElementById('parentEmail').value;
    const telefono = document.getElementById('phone').value;
    const horarioEvaluacion = document.getElementById('horarioSelect').value;

    if (!horarioEvaluacion) {
        alert('Por favor selecciona un horario');
        return;
    }

    if (!fonoSeleccionado) {
        alert('Por favor selecciona un fonoaudiólogo');
        return;
    }

    const matricula = {
        tipo: 'matricula',
        nombreAlumno,
        rutAlumno,
        fechaNacimiento,
        nombreApoderado,
        correoApoderado: correo,
        telefonoApoderado: telefono,
        curso: 'Por asignar',
        observaciones: '',
        estado: 'pendiente',
        fechaRegistro: new Date().toISOString(),
        horarioEvaluacion
    };

    try {
        const createMatriculaMutation = window.useCreateMatricula();
        await createMatriculaMutation.mutate(matricula);

        const reservaEvaluacion = {
            nombreAlumno,
            rutAlumno,
            fechaNacimiento,
            telefono,
            correo,
            nombreApoderado,
            rutApoderado,
            fechaHora: horarioEvaluacion,
            rutFono: fonoSeleccionado.rut,
            nombreFono: fonoSeleccionado.nombre
        };

        const createReservaMutation = window.useReservarEvaluacion();
        await createReservaMutation.mutate(reservaEvaluacion);

        alert(`✅ ¡Solicitud enviada exitosamente!\n\nFonoaudiólogo: ${fonoSeleccionado.nombre}\nFecha: ${formatFechaLegible(fechaSeleccionada)}\n\nSerás contactado pronto.`);

        document.getElementById('bookingForm').reset();
        document.getElementById('fechaSeleccionadaDisplay').value = '';
        fechaSeleccionada = null;
        fonoSeleccionado = null;

        if (reservasQuery) await reservasQuery.refetch();
        renderizarCalendario();

    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error: ' + (error.message || 'No se pudo completar la operación'));
    }
}

// ========================================
// CALENDARIO DE CITAS - Sistema con asignación de fonoaudiólogos
// ========================================

let mesActualCalendario = new Date().getMonth();
let anoActualCalendario = new Date().getFullYear();
let reservasGlobal = [];
let fonoaudiologosDisponibles = [];
let fechaSeleccionada = null;
let fonoSeleccionado = null;
let reservasQuery = null;
let profesionalesQuery = null;

const HORARIO_INICIO = 9;
const HORARIO_FIN = 18;
const INTERVALO_MINUTOS = 60;

function inicializarCalendario() {
    console.log('🔄 Inicializando calendario...');

    if (!window.Alpine) {
        document.addEventListener('alpine:init', inicializarCalendario);
        return;
    }

    reservasQuery = window.useReservasEvaluacion();
    profesionalesQuery = window.useProfesionales();

    window.Alpine.effect(() => {
        if (reservasQuery.data && profesionalesQuery.data) {
            reservasGlobal = reservasQuery.data;
            fonoaudiologosDisponibles = profesionalesQuery.data.filter(p => p.rol === 'fono');
            console.log('📅 Reservas:', reservasGlobal.length);
            console.log('👨‍⚕️ Fonoaudiólogos:', fonoaudiologosDisponibles.length);
            renderizarCalendario();
        }
    });

    renderizarCalendario();
}

function diaEsSeleccionable(dia) {
    const fecha = new Date(anoActualCalendario, mesActualCalendario, dia);
    const diaSemana = fecha.getDay();
    if (diaSemana === 0 || diaSemana === 6) return false;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fecha >= hoy;
}

function generarHorariosDelDia() {
    const horarios = [];
    for (let hora = HORARIO_INICIO; hora <= HORARIO_FIN; hora++) {
        horarios.push(`${hora.toString().padStart(2, '0')}:00`);
    }
    return horarios;
}

function obtenerReservasDelDia(fecha) {
    const fechaStr = fecha.toISOString().split('T')[0];
    return reservasGlobal.filter(r => r.fechaHora && r.fechaHora.startsWith(fechaStr));
}

function obtenerFonosDisponiblesEnDia(fecha) {
    const reservasDelDia = obtenerReservasDelDia(fecha);
    const horariosDelDia = generarHorariosDelDia();

    return fonoaudiologosDisponibles.filter(fono => {
        const reservasFono = reservasDelDia.filter(r => r.rutFono === fono.rut);
        return reservasFono.length < horariosDelDia.length;
    });
}

function obtenerHorariosDisponiblesDeFono(fecha, rutFono) {
    const fechaStr = fecha.toISOString().split('T')[0];
    const reservasFono = reservasGlobal.filter(r => {
        return r.fechaHora && r.fechaHora.startsWith(fechaStr) && r.rutFono === rutFono;
    });

    const horariosOcupados = reservasFono.map(r => {
        const hora = new Date(r.fechaHora).getHours();
        return `${hora.toString().padStart(2, '0')}:00`;
    });

    return generarHorariosDelDia().filter(h => !horariosOcupados.includes(h));
}

// Cambiar mes del calendario
window.cambiarMes = function(direccion) {
    mesActualCalendario += direccion;
    if (mesActualCalendario > 11) {
        mesActualCalendario = 0;
        anoActualCalendario++;
    } else if (mesActualCalendario < 0) {
        mesActualCalendario = 11;
        anoActualCalendario--;
    }
    renderizarCalendario();
}

// Renderizar calendario
function renderizarCalendario() {
    console.log('Renderizando calendario...');
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const mesNombre = document.getElementById('mesActual');
    if (mesNombre) {
        mesNombre.textContent = `${nombresMeses[mesActualCalendario]} ${anoActualCalendario}`;
    }

    const diasContainer = document.getElementById('diasCalendario');
    if (!diasContainer) {
        console.error('No se encontró el elemento diasCalendario');
        return;
    }

    console.log('Horarios disponibles globales:', horariosDisponiblesGlobal.length);

    // Obtener primer día del mes
    const primerDia = new Date(anoActualCalendario, mesActualCalendario, 1);
    const ultimoDia = new Date(anoActualCalendario, mesActualCalendario + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    const primerDiaSemana = primerDia.getDay();

    let html = '';

    // Espacios en blanco antes del primer día
    for (let i = 0; i < primerDiaSemana; i++) {
        html += '<div style="padding: 12px;"></div>';
    }

    // Días del mes
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fechaDia = new Date(anoActualCalendario, mesActualCalendario, dia);
        const esSeleccionable = diaEsSeleccionable(dia);
        const esHoy = fechaDia.getTime() === hoy.getTime();
        const diaSemana = fechaDia.getDay();

        let estiloBoton = 'padding: 12px; border-radius: 8px; transition: all 0.2s;';
        let onclick = '';

        if (!esSeleccionable) {
            // Días pasados o fines de semana
            estiloBoton += 'color: #ccc; background: #f9f9f9; cursor: not-allowed;';
        } else {
            // Días seleccionables (lunes-viernes futuros)
            estiloBoton += 'cursor: pointer;';
            onclick = `onclick="seleccionarFecha(${dia})"`;

            if (esHoy) {
                estiloBoton += 'background: #ad1457; color: white; font-weight: 600;';
            } else {
                estiloBoton += 'background: #f0f0f0; color: #ad1457; font-weight: 500; border: 2px solid #ad1457;';
            }
        }

        html += `<div ${onclick} style="${estiloBoton}">${dia}</div>`;
    }

    diasContainer.innerHTML = html;
}

window.seleccionarFecha = function(dia) {
    const fecha = new Date(anoActualCalendario, mesActualCalendario, dia);
    fechaSeleccionada = fecha;
    fonoSeleccionado = null;

    const campoFecha = document.getElementById('fechaSeleccionada');
    const campoFechaDisplay = document.getElementById('fechaSeleccionadaDisplay');

    if (campoFecha) campoFecha.value = fecha.toISOString().split('T')[0];
    if (campoFechaDisplay) campoFechaDisplay.value = formatFechaLegible(fecha);

    cargarFonosDisponibles(fecha);
    limpiarSeleccionHorario();
}

// Formatear fecha legible
function formatFechaLegible(fecha) {
    return fecha.toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function cargarFonosDisponibles(fecha) {
    const selectFono = document.getElementById('profesionalSelect');
    if (!selectFono) return;

    const fonosDisp = obtenerFonosDisponiblesEnDia(fecha);

    if (fonosDisp.length === 0) {
        selectFono.innerHTML = '<option value="">No hay fonoaudiólogos disponibles</option>';
        return;
    }

    selectFono.innerHTML = '<option value="">-- Selecciona un fonoaudiólogo --</option>' +
        fonosDisp.map(fono =>
            `<option value="${fono.rut}">${fono.nombre} - ${fono.especialidad}</option>`
        ).join('');
}

window.seleccionarFonoaudiologo = function() {
    const selectFono = document.getElementById('profesionalSelect');
    const rutFono = selectFono.value;

    if (!rutFono || !fechaSeleccionada) {
        limpiarSeleccionHorario();
        return;
    }

    fonoSeleccionado = fonoaudiologosDisponibles.find(f => f.rut === rutFono);
    cargarHorariosDisponibles(fechaSeleccionada, rutFono);
}

function cargarHorariosDisponibles(fecha, rutFono) {
    const selectHorario = document.getElementById('horarioSelect');
    if (!selectHorario) return;

    const horariosDisp = obtenerHorariosDisponiblesDeFono(fecha, rutFono);

    if (horariosDisp.length === 0) {
        selectHorario.innerHTML = '<option value="">No hay horarios disponibles</option>';
        return;
    }

    const fechaStr = fecha.toISOString().split('T')[0];
    selectHorario.innerHTML = '<option value="">-- Selecciona un horario --</option>' +
        horariosDisp.map(hora =>
            `<option value="${fechaStr}T${hora}:00.000Z">${hora}</option>`
        ).join('');
}

function limpiarSeleccionHorario() {
    const selectHorario = document.getElementById('horarioSelect');
    if (selectHorario) {
        selectHorario.innerHTML = '<option value="">Selecciona fonoaudiólogo primero</option>';
    }
}

// Formatear fecha y hora para mostrar de forma legible
function formatFechaHoraLegible(fechaHora) {
    const fecha = new Date(fechaHora);
    return fecha.toLocaleString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    const calendario = document.getElementById('diasCalendario');
    if (calendario) {
        inicializarCalendario();
    }
});

// ========================================
// GALERÍA PÚBLICA (CU-17, 18, 19)
// ========================================

let albumesDisponibles = [];
let albumActual = 'todos';

async function cargarAlbumes() {
    try {
        // ✅ CORREGIDO: usar /imagenes en lugar de /galeria
        const response = await fetch(`${API_URL}/imagenes?action=albums`);
        if (!response.ok) return;

        const data = await response.json();
        albumesDisponibles = data.albums || [];

        // Renderizar filtros de álbum
        const filterContainer = document.querySelector('.gallery-filter');
        if (!filterContainer) return;

        filterContainer.innerHTML = `
            <button class="filter-btn active" data-album="todos" onclick="filtrarGaleria('todos')">
                Todos
            </button>
            ${albumesDisponibles.map(album => `
                <button class="filter-btn" data-album="${album}" onclick="filtrarGaleria('${album}')">
                    ${album}
                </button>
            `).join('')}
        `;
    } catch (error) {
        console.error('Error cargando álbumes:', error);
    }
}

async function cargarGaleria(album = 'todos') {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    try {
        // ✅ CORREGIDO: usar /imagenes en lugar de /galeria
        let url = `${API_URL}/imagenes`;
        if (album !== 'todos') {
            url += `?album=${encodeURIComponent(album)}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            grid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">No hay imágenes disponibles</p>';
            return;
        }

        const imagenes = await response.json();

        if (!imagenes || imagenes.length === 0) {
            grid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">No hay imágenes en esta galería</p>';
            return;
        }

        // Renderizar galería
        grid.innerHTML = imagenes.map(img => `
            <div class="gallery-item" onclick="openImageModal('${img.url}', '${img.album || 'Sin álbum'}')">
                <img src="${img.thumbnailUrl || img.url}" alt="${img.album || 'Imagen'}" loading="lazy">
                <div class="gallery-overlay">
                    <i class="fas fa-search-plus"></i>
                    <p>${img.album || 'Sin álbum'}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error cargando galería:', error);
        grid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">Error al cargar las imágenes</p>';
    }
}

window.filtrarGaleria = function(album) {
    albumActual = album;

    // Actualizar botones activos
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.album === album) {
            btn.classList.add('active');
        }
    });

    cargarGaleria(album);
}

function openImageModal(imageUrl, albumName) {
    const modal = document.getElementById('imageModal');
    if (!modal) return;

    modal.innerHTML = `
        <div class="image-modal-content">
            <span class="image-modal-close" onclick="closeImageModal()">&times;</span>
            <img src="${imageUrl}" alt="${albumName}">
            <p class="image-caption">${albumName}</p>
        </div>
    `;
    modal.classList.add('show');
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.innerHTML = '';
        }, 300);
    }
}

// Cargar galería y álbumes al iniciar
document.addEventListener('DOMContentLoaded', function() {
    const gallerySection = document.getElementById('galeria');
    if (gallerySection) {
        cargarAlbumes();
        cargarGaleria('todos');
    }
});

// Ejecutar al cargar la página
checkAuthStatus();
