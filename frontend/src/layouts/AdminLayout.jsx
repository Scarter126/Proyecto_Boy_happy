/**
 * AdminLayout - Layout para usuarios administradores
 *
 * Layout con sidebar, header y contenido principal
 */

import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useAuthStore from '../stores/authStore';

function AdminLayout() {
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
    { icon: 'fa-tachometer-alt', label: 'Dashboard', path: '/admin' },
    { icon: 'fa-chart-line', label: 'Comparativo Cursos', path: '/admin/comparativo' },
    { icon: 'fa-users', label: 'Gestión de Usuarios', path: '/admin/users' },
    { icon: 'fa-file-alt', label: 'Matrículas', path: '/admin/matriculas' },
    { icon: 'fa-calendar-check', label: 'Asistencia', path: '/admin/asistencia' },
    { icon: 'fa-folder-open', label: 'Materiales', path: '/admin/materiales' },
    { icon: 'fa-bullhorn', label: 'Comunicaciones', path: '/admin/anuncios' },
    { icon: 'fa-cogs', label: 'Configuración', path: '/admin/configuracion' },
  ];

  const isActiveRoute = (path) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <i className="fas fa-graduation-cap"></i>
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

export default AdminLayout;
