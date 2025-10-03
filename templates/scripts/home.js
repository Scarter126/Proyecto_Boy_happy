// Configuración de prefijo de callback (inyectada desde el servidor)
const PREFIX = window.APP_CONFIG?.CALLBACK_PREFIX ?? '';
const CLIENT_ID = window.APP_CONFIG?.CLIENT_ID ?? '';
const COGNITO_DOMAIN = window.APP_CONFIG?.COGNITO_DOMAIN ?? '';
const API_URL = window.APP_CONFIG?.API_URL ?? '';

// Construir REDIRECT_URI dinámicamente
const REDIRECT_URI = API_URL + PREFIX + '/callback';

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

function changeSlide(direction) {
    currentSlide += direction;
    showSlide(currentSlide);
}

function goToSlide(index) {
    currentSlide = index;
    showSlide(currentSlide);
}

// Auto-play carousel
setInterval(() => {
    changeSlide(1);
}, 5000);

// Calendar functionality
const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;

function renderCalendar() {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const calendarDays = document.getElementById('calendarDays');
    const currentMonthElement = document.getElementById('currentMonth');

    currentMonthElement.textContent = `${months[currentMonth]} ${currentYear}`;
    calendarDays.innerHTML = '';

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        calendarDays.appendChild(emptyDay);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.classList.add('calendar-day');
        dayElement.textContent = day;

        // Disable past dates
        const date = new Date(currentYear, currentMonth, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (date < today) {
            dayElement.classList.add('disabled');
        } else {
            dayElement.addEventListener('click', () => selectDate(day));
        }

        calendarDays.appendChild(dayElement);
    }
}

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
}

function selectDate(day) {
    const allDays = document.querySelectorAll('.calendar-day');
    allDays.forEach(d => d.classList.remove('selected'));

    event.target.classList.add('selected');
    selectedDate = `${day}/${currentMonth + 1}/${currentYear}`;
    document.getElementById('selectedDate').value = selectedDate;
}

// Initialize calendar
renderCalendar();

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

// Cargar equipo profesional dinámicamente
async function cargarEquipoProfesional() {
    try {
        // Cargar todos los usuarios
        const response = await fetch('/api/usuarios');
        const usuarios = await response.json();

        // Filtrar solo profesionales (admin, profesor, fono)
        const profesionales = usuarios.filter(u =>
            ['admin', 'profesor', 'fono'].includes(u.rol)
        );

        // Renderizar grid de profesionales
        const grid = document.getElementById('professionalsGrid');
        if (profesionales.length === 0) {
            grid.innerHTML = '<p>No hay profesionales disponibles.</p>';
            return;
        }

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

        // Actualizar select de profesionales en formulario de reserva
        // Solo fonoaudiólogos pueden hacer evaluaciones
        const fonoaudiologos = profesionales.filter(p => p.rol === 'fono');
        const select = document.getElementById('professional');
        select.innerHTML = '<option value="">Seleccionar profesional</option>' +
            fonoaudiologos.map(prof =>
                `<option value="${prof.rut}">${prof.nombre} - ${prof.especialidad || 'Fonoaudiólogo/a'}</option>`
            ).join('');

    } catch (error) {
        console.error('Error al cargar profesionales:', error);
        const grid = document.getElementById('professionalsGrid');
        grid.innerHTML = '<p style="color: red;">Error al cargar el equipo profesional.</p>';
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
});

// Modal functionality
function openLoginModal() {
    document.getElementById('loginModal').classList.add('show');
    closeContactModal();
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('show');
}

function openContactModal() {
    document.getElementById('contactModal').classList.add('show');
}

function closeContactModal() {
    document.getElementById('contactModal').classList.remove('show');
}

function openSuccessModal(message) {
    document.getElementById('successMessage').textContent = message;
    document.getElementById('successModal').classList.add('show');
}

function closeSuccessModal() {
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

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Detectar ambiente (desarrollo vs producción)
    const isDevelopment = window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1';

    if (isDevelopment) {
        // LOGIN MOCK para desarrollo
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Login exitoso:', data.user);

                // Redirigir según rol
                const redirects = {
                    'admin': '/admin',
                    'profesor': '/profesores',
                    'fono': '/fono',
                    'alumno': '/alumnos'
                };

                const redirectUrl = redirects[data.user.rol] || '/';
                window.location.href = redirectUrl;
            } else {
                const error = await response.json();
                alert(error.error || 'Credenciales inválidas');
            }
        } catch (error) {
            console.error('Error de login:', error);
            alert('Error al iniciar sesión');
        }
    } else {
        // LOGIN COGNITO para producción
        const loginUrl = `${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
        window.location.href = loginUrl;
    }
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
        const response = await fetch('/api/contacto', {
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

document.getElementById('bookingForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const date = document.getElementById('selectedDate').value;
    const professionalId = document.getElementById('professional').value;
    const professionalSelect = document.getElementById('professional');
    const professionalName = professionalSelect.options[professionalSelect.selectedIndex].text;
    const timeSlot = document.getElementById('timeSlot').value;
    const patientName = document.getElementById('patientName').value;
    const phone = document.getElementById('phone').value;

    if (!date || !professionalId || !timeSlot || !patientName || !phone) {
        alert('Por favor complete todos los campos');
        return;
    }

    // Mostrar modal de confirmación
    document.getElementById('confirmDate').textContent = date;
    document.getElementById('confirmTime').textContent = timeSlot;
    document.getElementById('confirmProfessional').textContent = professionalName;
    document.getElementById('confirmPatient').textContent = patientName;
    document.getElementById('confirmPhone').textContent = phone;

    openConfirmModal();
});

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
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
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
    const token = localStorage.getItem('access_token');
    if (token) {
        const loginBtn = document.querySelector('.btn-login');
        if (loginBtn) {
            loginBtn.textContent = 'Mi Cuenta';
            loginBtn.href = `${PREFIX}/admin`;
        }
    }
}

// Modal de confirmación de reserva
function openConfirmModal() {
    document.getElementById('confirmBookingModal').classList.add('show');
}

function closeConfirmModal() {
    document.getElementById('confirmBookingModal').classList.remove('show');
}

// Enviar reserva al API
async function submitReservation() {
    const date = document.getElementById('selectedDate').value;
    const [day, month, year] = date.split('/');
    const timeSlot = document.getElementById('timeSlot').value;
    const fechaHora = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timeSlot}:00`;

    const reserva = {
        tipo: 'reserva',
        fechaHora: fechaHora,
        nombreAlumno: document.getElementById('patientName').value,
        telefono: document.getElementById('phone').value,
        // Campos adicionales (por ahora valores por defecto)
        rutAlumno: 'pendiente',
        fechaNacimiento: 'pendiente',
        correo: 'pendiente@boyhappy.cl',
        nombreApoderado: 'pendiente',
        rutApoderado: 'pendiente'
    };

    try {
        const response = await fetch('/api/reservar-evaluacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reserva)
        });

        closeConfirmModal();

        if (response.ok) {
            const result = await response.text();
            openSuccessModal(`¡Reserva confirmada! ${result}`);
            document.getElementById('bookingForm').reset();
            document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
        } else if (response.status === 409) {
            alert('Lo sentimos, ese horario ya fue reservado. Por favor seleccione otro.');
        } else {
            const error = await response.text();
            alert('Error al crear la reserva: ' + error);
        }
    } catch (error) {
        closeConfirmModal();
        console.error('Error:', error);
        alert('Error de conexión al crear la reserva');
    }
}

// Ejecutar al cargar la página
checkAuthStatus();
