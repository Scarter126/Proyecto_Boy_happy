/**
 * ApoderadoLayout - Layout para usuarios apoderados
 *
 * Layout con sidebar, header y contenido principal
 * Usa la misma estructura y estilos que AdminLayout para consistencia visual
 */

import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useAuthStore from '../stores/authStore';

function ApoderadoLayout() {
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
    { icon: 'fa-tachometer-alt', label: 'Dashboard', path: '/apoderado' },
    { icon: 'fa-child', label: 'Mis Hijos', path: '/apoderado/mis-hijos' },
    { icon: 'fa-bullhorn', label: 'Anuncios', path: '/apoderado/anuncios' },
    { icon: 'fa-calendar-check', label: 'Asistencia', path: '/apoderado/asistencia' },
    { icon: 'fa-calendar-alt', label: 'Calendario', path: '/apoderado/calendario' },
    { icon: 'fa-clipboard-check', label: 'Evaluaciones', path: '/apoderado/evaluaciones' },
    { icon: 'fa-folder-open', label: 'Materiales', path: '/apoderado/materiales' },
  ];

  const isActiveRoute = (path) => {
    if (path === '/apoderado') {
      return location.pathname === '/apoderado';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <i className="fas fa-user-friends"></i>
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

export default ApoderadoLayout;
