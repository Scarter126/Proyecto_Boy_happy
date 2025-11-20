import { useState, useEffect } from 'react';
import useUIStore from '../../stores/uiStore';
import useAuthStore from '../../stores/authStore';

const SECTION_TITLES = {
  dashboard: 'Dashboard',
  'mis-sesiones': 'Mis Sesiones',
  pacientes: 'Mis Pacientes',
  bitacora: 'Bitácora',
  usuarios: 'Gestión de Usuarios',
  matriculas: 'Matrículas',
  asistencia: 'Asistencia',
  materiales: 'Materiales',
  comunicaciones: 'Comunicaciones',
  configuracion: 'Configuración',
  'mi-curso': 'Mi Curso',
  'avance-alumnos': 'Avance de Alumnos',
  evaluaciones: 'Evaluaciones',
  calendario: 'Calendario',
  reportes: 'Reportes',
  'mi-hijo': 'Mi Hijo/a',
  sesiones: 'Sesiones',
  perfil: 'Mi Perfil',
  comparativo: 'Comparativo Cursos'
};

const ROLE_LABELS = {
  admin: 'Administrador',
  profesor: 'Profesor',
  fono: 'Fonoaudiólogo',
  apoderado: 'Apoderado'
};

const ROLE_COLORS = {
  admin: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  profesor: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  fono: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  apoderado: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
};

function Header() {
  const { activeSection, navigateTo } = useUIStore();
  const { user, logout } = useAuthStore();
  const [notificationDropdown, setNotificationDropdown] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);

  const userRole = user?.['cognito:groups']?.[0] || 'usuario';
  const userName = user?.email || user?.['cognito:username'] || 'Usuario';
  const roleLabel = ROLE_LABELS[userRole] || 'Usuario';
  const userColor = ROLE_COLORS[userRole] || ROLE_COLORS.admin;
  
  const currentTitle = SECTION_TITLES[activeSection] || 'Dashboard';
  const breadcrumb = `Inicio / ${currentTitle}`;

  return (
    <header className="main-header">
      <div className="header-container">
        {/* Breadcrumb / Título de sección */}
        <div className="header-title">
          <h1>{currentTitle}</h1>
          <p className="header-breadcrumb">
            <i className="fas fa-home"></i>
            <span>{breadcrumb}</span>
          </p>
        </div>

        {/* Acciones del header */}
        <div className="header-actions">
          {/* Notificaciones */}
          <div className="header-item dropdown">
            <button 
              onClick={() => setNotificationDropdown(!notificationDropdown)} 
              className="icon-btn"
            >
              <i className="fas fa-bell"></i>
            </button>
            {notificationDropdown && (
              <div className="dropdown-menu" onClick={() => setNotificationDropdown(false)}>
                <div className="dropdown-header">
                  <h4>Notificaciones</h4>
                </div>
                <div className="dropdown-item text-center">
                  <p style={{ color: '#94a3b8' }}>No hay notificaciones</p>
                </div>
              </div>
            )}
          </div>

          {/* Usuario */}
          <div className="header-item dropdown">
            <button onClick={() => setUserDropdown(!userDropdown)} className="user-btn">
              <div className="user-avatar" style={{ background: userColor }}>
                <i className="fas fa-user"></i>
              </div>
              <div className="user-info">
                <span className="user-name">{userName}</span>
                <span className="user-role">{roleLabel}</span>
              </div>
              <i className="fas fa-chevron-down"></i>
            </button>
            {userDropdown && (
              <div className="dropdown-menu" onClick={() => setUserDropdown(false)}>
                <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); navigateTo('perfil'); }}>
                  <i className="fas fa-user-circle"></i>
                  <span>Mi Perfil</span>
                </a>
                <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); navigateTo('configuracion'); }}>
                  <i className="fas fa-cog"></i>
                  <span>Configuración</span>
                </a>
                <div className="dropdown-divider"></div>
                <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); logout(); }}>
                  <i className="fas fa-sign-out-alt"></i>
                  <span>Cerrar Sesión</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
