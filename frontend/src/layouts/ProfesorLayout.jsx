/**
 * ProfesorLayout - Layout para usuarios profesores
 *
 * Layout con sidebar, header y contenido principal
 * Usa la misma estructura y estilos que AdminLayout para consistencia visual
 */

import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useAuthStore from '../stores/authStore';

function ProfesorLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const menuItems = [
    { icon: 'fa-tachometer-alt', label: 'Dashboard', path: '/profesor' },
    { icon: 'fa-user-graduate', label: 'Avance Alumnos', path: '/profesor/avance-alumnos' },
    { icon: 'fa-calendar-alt', label: 'Calendario', path: '/profesor/calendario' },
    { icon: 'fa-clipboard-check', label: 'Evaluaciones', path: '/profesor/evaluaciones' },
    { icon: 'fa-folder-open', label: 'Materiales', path: '/profesor/materiales' },
    { icon: 'fa-file-alt', label: 'Reportes', path: '/profesor/reportes' },
  ];

  const isActiveRoute = (path) => {
    if (path === '/profesor') {
      return location.pathname === '/profesor';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <i className="fas fa-chalkboard-teacher"></i>
          <span>Boy Happy</span>
        </div>

        <ul className="sidebar-menu">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={isActiveRoute(item.path) ? 'active' : ''}
              >
                <i className={`fas ${item.icon}`}></i> {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <button className="logout-btn" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt"></i>
          <span>Cerrar Sesión</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>
    </>
  );
}

export default ProfesorLayout;
