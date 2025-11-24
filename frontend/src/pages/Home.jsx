import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Swal from 'sweetalert2';
import { useAgenda, getBookedDates, getBookedHoursByDate } from '../hooks/useAgenda';
import { useProfesionales } from '../hooks/useProfesionales';
import { useGaleria } from '../hooks/useGaleria';
import { useNoticias } from '../hooks/useNoticias';
import { showLoginModal } from '../utils/loginModal';
import useAuthStore from '../stores/authStore';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function Home() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // React Query - Cargar datos con cache de 1 hora
  const { data: reservas, isLoading: loadingReservas } = useAgenda();
  const { data: professionals = [], isLoading: loadingProfessionals } = useProfesionales();
  const { data: galeriaData, isLoading: loadingGaleria } = useGaleria();
  const { data: noticias = [], isLoading: loadingNoticias } = useNoticias();

  // Auth store
  const user = useAuthStore(state => state.user);

  // State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedAlbum, setSelectedAlbum] = useState('todos');
  const [selectedImage, setSelectedImage] = useState(null);

  // Booking state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableProfessionals, setAvailableProfessionals] = useState([]);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [availableHours, setAvailableHours] = useState([]);
  const [bookingForm, setBookingForm] = useState({
    patientName: '',
    studentRut: '',
    birthDate: '',
    guardianName: '',
    guardianRut: '',
    parentEmail: '',
    phone: '',
    selectedHour: ''
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fechas límite: hoy y 3 meses adelante
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Resetear horas para comparación correcta
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3);
  maxDate.setHours(23, 59, 59, 999);

  // Procesar reservas para obtener fechas ocupadas
  const bookedDates = reservas ? getBookedDates(reservas) : new Set();
  const bookedHoursByDate = reservas ? getBookedHoursByDate(reservas) : new Map();

  // Extraer datos de la galería
  const galleryImages = galeriaData?.images || [];
  const albums = galeriaData?.albums || [];

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
    }).setView([-33.462287172344276, -70.5896728460072], 15); // Los Jardines 727, Ñuñoa

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.marker([-33.462287172344276, -70.5896728460072])
      .addTo(map)
      .bindPopup('<strong>Boy Happy</strong><br/>Los Jardines 727, Ñuñoa');

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Nota: professionals y gallery ahora se cargan automáticamente con React Query

  // Auto-play carousel
  useEffect(() => {
    if (noticias.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % noticias.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [noticias.length]);

  // Calendar functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const changeMonth = (delta) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);

      // Verificar si el nuevo mes está dentro del rango permitido
      // El primer día del mes debe estar entre hoy y maxDate
      const firstDayOfNewMonth = new Date(newMonth);
      firstDayOfNewMonth.setHours(0, 0, 0, 0);

      const lastDayOfNewMonth = new Date(newMonth.getFullYear(), newMonth.getMonth() + 1, 0);
      lastDayOfNewMonth.setHours(23, 59, 59, 999);

      // No permitir navegar a meses donde todos los días están en el pasado
      if (lastDayOfNewMonth < today) {
        return prev; // No cambiar mes
      }

      // No permitir navegar a meses donde el primer día está más allá de maxDate
      if (firstDayOfNewMonth > maxDate) {
        return prev; // No cambiar mes
      }

      return newMonth;
    });
  };

  const selectDate = (day) => {
    if (!day) return;

    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(selected);
    setSelectedProfessional(null);
    setAvailableHours([]);

    // Filter slots for this date from already-loaded reservations
    const dateStr = selected.toISOString().split('T')[0];

    if (!reservas || !Array.isArray(reservas)) {
      setAvailableProfessionals([]);
      return;
    }

    // Get slots for this specific date
    // NOTA: El backend ya filtra slots ocupados, todos los slots aquí están disponibles
    const slotsForDate = reservas.filter(slot => {
      if (!slot.fechaHora) return false;
      const slotDate = slot.fechaHora.split('T')[0];
      return slotDate === dateStr;
    });

    // Extract unique professionals from these available slots
    const professionalsMap = new Map();
    slotsForDate.forEach(slot => {
      if (slot.rutFono && slot.nombreFono) {
        professionalsMap.set(slot.rutFono, {
          id: slot.rutFono,
          nombre: slot.nombreFono
        });
      }
    });

    setAvailableProfessionals(Array.from(professionalsMap.values()));
  };

  const selectProfessional = (professionalId) => {
    setSelectedProfessional(professionalId);

    if (!selectedDate || !professionalId || !reservas) {
      setAvailableHours([]);
      return;
    }

    // Filter slots for this date and professional
    // NOTA: El backend ya filtra slots ocupados, todos los slots aquí están disponibles
    const dateStr = selectedDate.toISOString().split('T')[0];
    const slotsForDateAndProfessional = reservas.filter(slot => {
      if (!slot.fechaHora || !slot.rutFono) return false;
      const slotDate = slot.fechaHora.split('T')[0];
      return slotDate === dateStr && slot.rutFono === professionalId;
    });

    // Extract hours from these available slots
    const hours = slotsForDateAndProfessional
      .map(slot => slot.fechaHora.split('T')[1]) // Extract time part (e.g., "10:00")
      .filter(Boolean)
      .sort(); // Sort chronologically

    setAvailableHours(hours);
  };

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const submitEnrollment = async () => {
    // 1. Cerrar modal de confirmación
    setShowConfirmModal(false);

    // 2. Mostrar modal de loading
    Swal.fire({
      title: 'Procesando...',
      text: 'Estamos agendando tu cita',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      // Encontrar el nombre del profesional seleccionado
      const profesionalSeleccionado = availableProfessionals.find(
        p => p.id === selectedProfessional
      );

      // Construir fechaHora en formato ISO
      const fechaHoraCompleta = `${selectedDate.toISOString().split('T')[0]}T${bookingForm.selectedHour}`;

      // 3. Hacer fetch al backend
      const response = await fetch('/api/reservar-evaluacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Datos del slot
          fechaHora: fechaHoraCompleta,
          rutFono: selectedProfessional,
          nombreFono: profesionalSeleccionado?.nombre || '',

          // Datos del alumno
          nombreAlumno: bookingForm.patientName,
          rutAlumno: bookingForm.studentRut,
          fechaNacimiento: bookingForm.birthDate,

          // Datos del apoderado
          nombreApoderado: bookingForm.guardianName,
          rutApoderado: bookingForm.guardianRut,
          correo: bookingForm.parentEmail,
          telefono: bookingForm.phone
        })
      });

      const data = await response.json();

      // 4. Cerrar loading y mostrar resultado
      if (response.ok) {
        await Swal.fire({
          icon: 'success',
          title: '¡Cita Agendada!',
          html: `
            <p>Tu cita ha sido reservada exitosamente.</p>
            <p><strong>Fecha:</strong> ${selectedDate.toLocaleDateString('es-CL')}</p>
            <p><strong>Hora:</strong> ${bookingForm.selectedHour}</p>
            <p><strong>Profesional:</strong> ${availableProfessionals.find(p => p.id === selectedProfessional)?.nombre}</p>
            <p style="margin-top: 15px; font-size: 14px; color: #666;">
              Recibirás un correo de confirmación en ${bookingForm.parentEmail}
            </p>
          `,
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d91e6b'
        });

        // Reset form
        setBookingForm({
          patientName: '',
          studentRut: '',
          birthDate: '',
          guardianName: '',
          guardianRut: '',
          parentEmail: '',
          phone: '',
          selectedHour: ''
        });
        setSelectedDate(null);
        setSelectedProfessional(null);
        setAvailableHours([]);
        setAvailableProfessionals([]);
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error al Reservar',
          text: data.error || data.message || 'No se pudo completar la reserva. Por favor intenta nuevamente.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d91e6b'
        });
      }
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Error de Conexión',
        text: 'No se pudo conectar con el servidor. Por favor verifica tu conexión e intenta nuevamente.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#d91e6b'
      });
      console.error('Error al enviar reserva:', err);
    }
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogin = async () => {
    await showLoginModal((userData) => {
      // Redirect based on user role
      const roleRoutes = {
        admin: '/admin',
        profesor: '/profesor',
        fono: '/fono',
        apoderado: '/apoderado',
        alumno: '/alumno'
      };

      const route = roleRoutes[userData.rol] || '/';
      navigate(route);
    });
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
    const days = [];

    // Empty cells before the first day
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} style={{ padding: '10px' }}></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      currentDate.setHours(0, 0, 0, 0);

      const dateStr = currentDate.toISOString().split('T')[0];

      // Verificar si está seleccionado
      const isSelected = selectedDate &&
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === currentMonth.getMonth() &&
        selectedDate.getFullYear() === currentMonth.getFullYear();

      // Verificar restricciones
      const isPast = currentDate < today;
      const isTooFarFuture = currentDate > maxDate;
      const isBooked = bookedDates.has(dateStr);
      const isDisabled = isPast || isTooFarFuture;

      // Determinar estilo según estado
      let backgroundColor = 'white';
      let color = '#333';
      let cursor = 'pointer';
      let opacity = 1;
      let border = '1px solid #e0e0e0';

      if (isSelected) {
        backgroundColor = '#ad1457';
        color = 'white';
      } else if (isDisabled) {
        backgroundColor = '#f5f5f5';
        color = '#ccc';
        cursor = 'not-allowed';
        opacity = 0.5;
      } else if (isBooked) {
        backgroundColor = '#fff3cd';
        border = '2px solid #ffc107';
        color = '#856404';
      }

      days.push(
        <div
          key={day}
          onClick={() => !isDisabled && selectDate(day)}
          style={{
            padding: '10px',
            cursor,
            backgroundColor,
            color,
            opacity,
            borderRadius: '8px',
            textAlign: 'center',
            transition: 'all 0.3s',
            border,
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            if (!isSelected && !isDisabled) {
              e.currentTarget.style.backgroundColor = isBooked ? '#ffe8a1' : '#f5f5f5';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected && !isDisabled) {
              e.currentTarget.style.backgroundColor = isBooked ? '#fff3cd' : 'white';
            }
          }}
          title={
            isPast ? 'Fecha pasada' :
              isTooFarFuture ? 'Fecha fuera del rango (máx 3 meses)' :
                isBooked ? 'Día con reservas existentes' :
                  'Disponible'
          }
        >
          {day}
          {isBooked && !isDisabled && (
            <div style={{
              position: 'absolute',
              bottom: '2px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: '#ff9800'
            }}></div>
          )}
        </div>
      );
    }

    return days;
  };

  const filteredImages = selectedAlbum === 'todos'
    ? galleryImages
    : galleryImages.filter(img => img.album === selectedAlbum);

  return (
    <div>
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <i className="fas fa-graduation-cap"></i>
            <span>Boy Happy</span>
          </div>
          <ul className="nav-menu">
            <li><a href="#inicio" onClick={(e) => { e.preventDefault(); scrollToSection('inicio'); }}>Inicio</a></li>
            {(loadingNoticias || noticias.length > 0) && (
              <li><a href="#noticias" onClick={(e) => { e.preventDefault(); scrollToSection('noticias'); }}>Noticias</a></li>
            )}
            {(loadingProfessionals || professionals.length > 0) && (
              <li><a href="#profesionales" onClick={(e) => { e.preventDefault(); scrollToSection('profesionales'); }}>Nuestro Equipo</a></li>
            )}
            <li><a href="#ubicacion" onClick={(e) => { e.preventDefault(); scrollToSection('ubicacion'); }}>Ubicación</a></li>
            <li><a href="#reservas" onClick={(e) => { e.preventDefault(); scrollToSection('reservas'); }}>Matrícula</a></li>
            <li><a href="#" className="btn-login" onClick={(e) => { e.preventDefault(); handleLogin(); }}>Ingresar</a></li>
          </ul>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="inicio" className="hero">
        <div className="hero-content">
          <h1 className="hero-title">¡Bienvenidos a Boy Happy!</h1>
          <p className="hero-subtitle">Donde aprender a comunicarse es una aventura divertida</p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => scrollToSection('ubicacion')}>Contáctanos</button>
            <button className="btn-secondary" onClick={() => scrollToSection('reservas')}>Solicitar Matrícula</button>
          </div>
        </div>
        <div className="hero-illustration">
          <div className="floating-bubble bubble-1">🎈</div>
          <div className="floating-bubble bubble-2">📚</div>
          <div className="floating-bubble bubble-3">🌟</div>
          <div className="floating-bubble bubble-4">🎨</div>
        </div>
      </section>

      {/* News Carousel Section */}
      <section id="noticias" className="news-section">
        <div className="container">
          <h2 className="section-title">Noticias Importantes</h2>

          {loadingNoticias ? (
            // LOADING SPINNER
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '3em', color: 'var(--purple-main)' }}></i>
              <p style={{ marginTop: '15px', color: '#666' }}>Cargando noticias...</p>
            </div>
          ) : noticias.length === 0 ? (
            // PLACEHOLDER SIN NOTICIAS
            <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>📰</div>
              <p style={{ fontSize: '1.2rem' }}>No hay noticias disponibles por ahora.</p>
            </div>
          ) : (
            // CARRUSEL DE NOTICIAS
            <div className="carousel-container">
              <button
                className="carousel-btn prev"
                onClick={() => setCurrentSlide((prev) => (prev - 1 + noticias.length) % noticias.length)}
              >
                ❮
              </button>

              <div className="carousel-wrapper">
                <div className="carousel-track">
                  {noticias.map((item, index) => (
                    <div
                      key={item.id || index}
                      className={`carousel-slide ${index === currentSlide ? 'active' : ''}`}
                    >
                      <div className="news-card">
                        <div className="news-icon">📰</div>
                        <h3>{item.titulo}</h3>
                        <p>{item.contenido}</p>
                        <span className="news-date">{item.fecha}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="carousel-btn next"
                onClick={() => setCurrentSlide((prev) => (prev + 1) % noticias.length)}
              >
                ❯
              </button>

              <div className="carousel-indicators">
                {noticias.map((_, index) => (
                  <span
                    key={index}
                    className={`indicator ${index === currentSlide ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(index)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Professionals Section */}
      {/* Professionals Section - Solo mostrar si hay profesionales o está cargando */}
      {(loadingProfessionals || professionals.length > 0) && (
        <section id="profesionales" className="professionals-section">
          <div className="container">
            <h2 className="section-title">Nuestro Equipo de Profesionales</h2>
            <div className="professionals-grid">
              {loadingProfessionals ? (
                <div className="professional-card">
                  <div className="professional-avatar">
                    <i className="fas fa-spinner fa-spin"></i>
                  </div>
                  <p>Cargando equipo profesional...</p>
                </div>
              ) : (
                professionals.map((prof) => (
                  <div key={prof.id} className="professional-card">
                    <div className="professional-avatar">
                      <img src={prof.foto || `https://ui-avatars.com/api/?name=${prof.nombre}`} alt={prof.nombre} />
                    </div>
                    <h3>{prof.nombre}</h3>
                    <p className="professional-role">{prof.especialidad}</p>
                    <p className="professional-description">{prof.descripcion}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Gallery Section */}
      <section id="galeria" className="gallery-section">
        <div className="container">
          <h2 className="section-title">Galería de Momentos</h2>
          <p className="section-subtitle">Descubre los mejores momentos de nuestra comunidad educativa</p>

          {loadingGaleria ? (
            // LOADING
            <div className="gallery-grid">
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '3em', color: 'var(--purple-main)' }}></i>
                <p style={{ marginTop: '15px', color: '#666' }}>Cargando galería...</p>
              </div>
            </div>
          ) : galleryImages.length === 0 ? (
            // PLACEHOLDER GENERAL – NO HAY IMÁGENES
            <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>📷</div>
              <p style={{ fontSize: '1.2rem' }}>Aún no hay imágenes en la galería.</p>
            </div>
          ) : (
            <>
              {/* Filtros */}
              <div className="gallery-filter">
                <button
                  className={`filter-btn ${selectedAlbum === 'todos' ? 'active' : ''}`}
                  onClick={() => setSelectedAlbum('todos')}
                >
                  <i className="fas fa-images"></i> Todos
                </button>

                {albums.map((album) => (
                  <button
                    key={album}
                    className={`filter-btn ${selectedAlbum === album ? 'active' : ''}`}
                    onClick={() => setSelectedAlbum(album)}
                  >
                    {album}
                  </button>
                ))}
              </div>

              {/* Grid */}
              <div className="gallery-grid">
                {filteredImages.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>
                    <i className="fas fa-images" style={{ fontSize: '3em', color: '#ccc' }}></i>
                    <p style={{ marginTop: '15px', color: '#666' }}>No hay imágenes en este álbum</p>
                  </div>
                ) : (
                  filteredImages.map((image) => (
                    <div
                      key={image.id}
                      className="gallery-item"
                      onClick={() => setSelectedImage(image)}
                    >
                      <img src={image.url} alt={image.descripcion} />
                      <div className="gallery-overlay">
                        <i className="fas fa-search-plus"></i>
                        <p>{image.descripcion}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* image Modal */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)} style={{ display: 'flex' }}>
          <div className="image-modal-content">
            <span className="image-modal-close" onClick={() => setSelectedImage(null)}>&times;</span>
            <img src={selectedImage.url} alt={selectedImage.descripcion} />
            <p className="image-caption">{selectedImage.descripcion}</p>
          </div>
        </div>
      )}

      {/* Location Section */}
      <section id="ubicacion" className="location-section">
        <div className="container">
          <h2 className="section-title">Encuéntranos</h2>
          <div className="location-content">
            <div className="location-info">
              <div className="info-card">
                <i className="fas fa-map-marker-alt"></i>
                <h3>Dirección</h3>
                <p>Los Jardines 727<br />Ñuñoa, Santiago<br />Región Metropolitana</p>
              </div>
              <div className="info-card">
                <i className="fas fa-clock"></i>
                <h3>Horario</h3>
                <p>Lunes a Viernes<br />De 9:00 AM a 6:00 PM</p>
              </div>
              <div className="info-card">
                <i className="fas fa-phone"></i>
                <h3>Contacto</h3>
                <p>+56 9 8668 1455<br /><a href="https://www.instagram.com/escuelaboyhappy/?hl=es-la" target="_blank" rel="noreferrer" style={{ color: 'var(--burgundy-main)', textDecoration: 'none' }}>@escuelaboyhappy</a></p>
              </div>
            </div>
            <div ref={mapRef} className="map-container"></div>
          </div>
        </div>
      </section>

      {/* Booking Calendar Section */}
      <section id="reservas" className="booking-section">
        <div className="container">
          <h2 className="section-title" style={{ color: '#ad1457' }}>Agenda tu Cita</h2>

          <div className="booking-container">

            {/* Calendario */}
            <div className="calendar-card">
              <div className="calendar-header">
                <button type="button" onClick={() => changeMonth(-1)}>‹</button>
                <h3>
                  {currentMonth.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                </h3>
                <button type="button" onClick={() => changeMonth(1)}>›</button>
              </div>

              <div className="calendar-grid">
                <div style={{ fontWeight: 600, color: '#ad1457' }}>Dom</div>
                <div style={{ fontWeight: 600, color: '#ad1457' }}>Lun</div>
                <div style={{ fontWeight: 600, color: '#ad1457' }}>Mar</div>
                <div style={{ fontWeight: 600, color: '#ad1457' }}>Mié</div>
                <div style={{ fontWeight: 600, color: '#ad1457' }}>Jue</div>
                <div style={{ fontWeight: 600, color: '#ad1457' }}>Vie</div>
                <div style={{ fontWeight: 600, color: '#ad1457' }}>Sáb</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', marginTop: '10px' }}>
                {renderCalendar()}
              </div>
            </div>

            {/* Formulario */}
            <div className="details-card">
              <h3>Detalles de la Reserva</h3>

              <form onSubmit={handleBookingSubmit}>
                <div className="form-group">
                  <label>Fecha Seleccionada</label>
                  <input
                    type="text"
                    value={selectedDate ? selectedDate.toLocaleDateString('es-CL') : ''}
                    readOnly
                    style={{ background: '#f5f5f5' }}
                  />
                </div>

                <div className="form-group">
                  <label>Fonoaudiólogo *</label>
                  <select
                    value={selectedProfessional || ''}
                    onChange={(e) => selectProfessional(e.target.value)}
                    required
                  >
                    <option value="">Selecciona una fecha primero</option>
                    {availableProfessionals.map((prof) => (
                      <option key={prof.id} value={prof.id}>{prof.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Horario *</label>
                  <select
                    value={bookingForm.selectedHour}
                    onChange={(e) => setBookingForm({ ...bookingForm, selectedHour: e.target.value })}
                    required
                  >
                    <option value="">Selecciona fonoaudiólogo primero</option>
                    {availableHours.map((hour) => (
                      <option key={hour} value={hour}>{hour}</option>
                    ))}
                  </select>
                </div>

                <hr />

                <div className="form-group">
                  <label>Nombre del Alumno *</label>
                  <input
                    type="text"
                    value={bookingForm.patientName}
                    onChange={(e) => setBookingForm({ ...bookingForm, patientName: e.target.value })}
                    placeholder="Nombre completo del alumno"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>RUT del Alumno *</label>
                  <input
                    type="text"
                    value={bookingForm.studentRut}
                    onChange={(e) => setBookingForm({ ...bookingForm, studentRut: e.target.value })}
                    placeholder="12345678-9"
                    pattern="[0-9]{7,8}-[0-9kK]{1}"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Fecha de Nacimiento *</label>
                  <input
                    type="date"
                    value={bookingForm.birthDate}
                    onChange={(e) => setBookingForm({ ...bookingForm, birthDate: e.target.value })}
                    onBlur={(e) => setBookingForm({ ...bookingForm, birthDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Nombre del Apoderado *</label>
                  <input
                    type="text"
                    value={bookingForm.guardianName}
                    onChange={(e) => setBookingForm({ ...bookingForm, guardianName: e.target.value })}
                    placeholder="Nombre completo del apoderado"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>RUT del Apoderado *</label>
                  <input
                    type="text"
                    value={bookingForm.guardianRut}
                    onChange={(e) => setBookingForm({ ...bookingForm, guardianRut: e.target.value })}
                    placeholder="12345678-9"
                    pattern="[0-9]{7,8}-[0-9kK]{1}"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Correo del Apoderado *</label>
                  <input
                    type="email"
                    value={bookingForm.parentEmail}
                    onChange={(e) => setBookingForm({ ...bookingForm, parentEmail: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Teléfono *</label>
                  <input
                    type="tel"
                    value={bookingForm.phone}
                    onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                    placeholder="+56 9 XXXX XXXX"
                    required
                  />
                </div>

                <button type="submit">
                  Agendar Cita
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <span className="close" onClick={() => setShowConfirmModal(false)}>&times;</span>
            <div className="modal-header">
              <h2>Confirmar Reserva de Cita</h2>
              <p>Por favor verifica los datos antes de confirmar</p>
            </div>
            <div className="booking-summary">
              <div className="summary-item">
                <i className="fas fa-user"></i>
                <div>
                  <strong>Alumno:</strong>
                  <span>{bookingForm.patientName}</span>
                </div>
              </div>
              <div className="summary-item">
                <i className="fas fa-id-card"></i>
                <div>
                  <strong>RUT:</strong>
                  <span>{bookingForm.studentRut}</span>
                </div>
              </div>
              <div className="summary-item">
                <i className="fas fa-calendar-check"></i>
                <div>
                  <strong>Fecha y Hora:</strong>
                  <span>{selectedDate?.toLocaleDateString('es-CL')} - {bookingForm.selectedHour}</span>
                </div>
              </div>
              <div className="summary-item">
                <i className="fas fa-user-md"></i>
                <div>
                  <strong>Profesional:</strong>
                  <span>{availableProfessionals.find(p => p.id === selectedProfessional)?.nombre || 'No seleccionado'}</span>
                </div>
              </div>
              <div className="summary-item">
                <i className="fas fa-envelope"></i>
                <div>
                  <strong>Correo de Confirmación:</strong>
                  <span>{bookingForm.parentEmail}</span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={submitEnrollment}>
                <i className="fas fa-check"></i> Confirmar Reserva
              </button>
              <button className="btn-secondary" onClick={() => setShowConfirmModal(false)}>
                <i className="fas fa-times"></i> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>Boy Happy</h3>
              <p>Ayudando a los niños a comunicarse mejor desde 2010</p>
              <div className="social-links">
                <a href="https://www.instagram.com/escuelaboyhappy/?hl=es-la" target="_blank" rel="noreferrer">
                  <i className="fab fa-instagram"></i>
                </a>
              </div>
            </div>
            <div className="footer-section">
              <h4>Enlaces Rápidos</h4>
              <ul>
                <li><a href="#inicio" onClick={(e) => { e.preventDefault(); scrollToSection('inicio'); }}>Inicio</a></li>
                <li><a href="#profesionales" onClick={(e) => { e.preventDefault(); scrollToSection('profesionales'); }}>Equipo</a></li>
                <li><a href="#reservas" onClick={(e) => { e.preventDefault(); scrollToSection('reservas'); }}>Matrícula</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Servicios</h4>
              <ul>
                <li>Evaluación del Lenguaje</li>
                <li>Terapia del Habla</li>
                <li>Estimulación Temprana</li>
                <li>Talleres Grupales</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Boy Happy. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
