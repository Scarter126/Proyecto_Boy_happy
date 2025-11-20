import useUIStore from '../../stores/uiStore';
import useAuthStore from '../../stores/authStore';

const MENU_ITEMS = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
    { id: 'comparativo', label: 'Comparativo Cursos', icon: 'fas fa-chart-line' },
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: 'fas fa-users' },
    { id: 'matriculas', label: 'Matrículas', icon: 'fas fa-file-alt' },
    { id: 'asistencia', label: 'Asistencia', icon: 'fas fa-calendar-check' },
    { id: 'materiales', label: 'Materiales', icon: 'fas fa-folder-open' },
    { id: 'comunicaciones', label: 'Comunicaciones', icon: 'fas fa-bullhorn' },
    { id: 'configuracion', label: 'Configuración', icon: 'fas fa-cogs' }
  ],
  profesor: [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-home' },
    { id: 'mi-curso', label: 'Mi Curso', icon: 'fas fa-users' },
    { id: 'asistencia', label: 'Asistencia', icon: 'fas fa-clipboard-check' },
    { id: 'avance-alumnos', label: 'Avance Alumnos', icon: 'fas fa-chart-line' },
    { id: 'evaluaciones', label: 'Evaluaciones', icon: 'fas fa-star' },
    { id: 'materiales', label: 'Materiales', icon: 'fas fa-folder-open' },
    { id: 'calendario', label: 'Calendario', icon: 'fas fa-calendar' },
    { id: 'reportes', label: 'Reportes', icon: 'fas fa-file-alt' }
  ],
  fono: [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-home' },
    { id: 'mis-sesiones', label: 'Mis Sesiones', icon: 'fas fa-calendar-alt' },
    { id: 'pacientes', label: 'Mis Pacientes', icon: 'fas fa-users' },
    { id: 'bitacora', label: 'Bitácora', icon: 'fas fa-book' },
    { id: 'evaluaciones', label: 'Evaluaciones', icon: 'fas fa-clipboard-list' },
    { id: 'materiales', label: 'Materiales', icon: 'fas fa-folder-open' },
    { id: 'calendario', label: 'Calendario', icon: 'fas fa-calendar' },
    { id: 'reportes', label: 'Reportes', icon: 'fas fa-file-alt' }
  ],
  apoderado: [
    { id: 'dashboard', label: 'Inicio', icon: 'fas fa-home' },
    { id: 'mi-hijo', label: 'Mi Hijo/a', icon: 'fas fa-child' },
    { id: 'asistencia', label: 'Asistencia', icon: 'fas fa-calendar-check' },
    { id: 'sesiones', label: 'Sesiones', icon: 'fas fa-clipboard-list' },
    { id: 'materiales', label: 'Materiales', icon: 'fas fa-folder-open' },
    { id: 'comunicaciones', label: 'Comunicaciones', icon: 'fas fa-comments' },
    { id: 'perfil', label: 'Mi Perfil', icon: 'fas fa-user-circle' }
  ]
};

const ROLE_INFO = {
  admin: { icon: 'fas fa-user-shield', name: 'Administrador' },
  profesor: { icon: 'fas fa-chalkboard-teacher', name: 'Profesor' },
  fono: { icon: 'fas fa-user-md', name: 'Fonoaudiólogo' },
  apoderado: { icon: 'fas fa-user-friends', name: 'Apoderado' }
};

function Sidebar() {
  const { activeSection, navigateTo, isActive } = useUIStore();
  const { user, logout } = useAuthStore();

  // Obtener rol del usuario
  const userRole = user?.['cognito:groups']?.[0] || 'admin';
  const roleInfo = ROLE_INFO[userRole] || ROLE_INFO.admin;
  const menuItems = MENU_ITEMS[userRole] || MENU_ITEMS.admin;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <i className={roleInfo.icon}></i>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.3em', color: '#1e293b' }}>
            {roleInfo.name}
          </div>
          <div style={{ fontSize: '0.8em', color: '#64748b' }}>Boy Happy</div>
        </div>
      </div>

      <ul className="sidebar-menu">
        {menuItems.map((item) => (
          <li key={item.id} className={isActive(item.id) ? 'active' : ''}>
            <a href="#" onClick={(e) => { e.preventDefault(); navigateTo(item.id); }}>
              <i className={item.icon}></i>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <button className="btn-logout" onClick={logout}>
          <i className="fas fa-sign-out-alt"></i>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
