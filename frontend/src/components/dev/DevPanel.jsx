/**
 * DevPanel - Panel de Desarrollo Flotante
 *
 * Panel flotante para cambiar rápidamente entre usuarios en desarrollo.
 * Solo se muestra en modo development (localhost).
 *
 * Features:
 * - Botón toggle flotante
 * - Lista de usuarios clickeables
 * - Navegación rápida por rol
 * - Auto-reload al cambiar usuario
 *
 * @component
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useDevStore, { DEV_USERS } from '../../stores/devStore';

const DevPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef(null);

  const {
    currentUserId,
    isPanelOpen,
    getCurrentUser,
    getCurrentRoutes,
    isDevMode,
    setCurrentUser,
    togglePanel,
    closePanel
  } = useDevStore();

  // Solo renderizar en modo desarrollo
  if (!isDevMode()) {
    return null;
  }

  const currentUser = getCurrentUser();
  const routes = getCurrentRoutes();

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isPanelOpen && panelRef.current && !panelRef.current.contains(e.target)) {
        closePanel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPanelOpen, closePanel]);

  const handleUserChange = (userId) => {
    setCurrentUser(userId);
  };

  const handleNavigate = (url) => {
    navigate(url);
    closePanel();
  };

  return (
    <div ref={panelRef} style={styles.container}>
      {/* Toggle Button */}
      <button
        onClick={togglePanel}
        style={{
          ...styles.toggle,
          ...(isPanelOpen ? styles.toggleOpen : {})
        }}
        title="Dev Panel - Cambiar Usuario"
      >
        🔧
      </button>

      {/* Panel Content */}
      <div
        style={{
          ...styles.content,
          ...(isPanelOpen ? styles.contentShow : {})
        }}
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <span>🛠️</span>
            <span>Panel de Desarrollo</span>
          </div>
          <div style={styles.status}>LOCAL</div>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* Current User */}
          <div style={styles.currentUser}>
            <div style={styles.currentUserTitle}>Usuario Actual</div>
            <div style={styles.currentUserInfo}>
              <div style={styles.currentUserIcon}>{currentUser?.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={styles.currentUserName}>{currentUser?.nombre}</div>
                <div style={styles.currentUserEmail}>{currentUser?.email || 'Sin autenticar'}</div>
                <div style={{
                  ...styles.currentUserRole,
                  background: getRoleColor(currentUser?.rol)
                }}>
                  {currentUser?.rol}
                </div>
              </div>
            </div>
          </div>

          {/* Users List */}
          <div style={styles.usersTitle}>Cambiar a:</div>
          <div style={styles.usersList}>
            {DEV_USERS.map(user => (
              <div
                key={user.id}
                onClick={() => handleUserChange(user.id)}
                style={{
                  ...styles.userItem,
                  ...(user.id === currentUserId ? styles.userItemActive : {})
                }}
              >
                <div style={styles.userIcon}>{user.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={styles.userName}>{user.nombre}</div>
                  <div style={styles.userEmail}>{user.email || 'Público'}</div>
                  <div style={{
                    ...styles.userRole,
                    background: getRoleColor(user.rol)
                  }}>
                    {user.rol}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Separator */}
          <div style={styles.separator} />

          {/* Navigation */}
          <div style={styles.navTitle}>
            <span>🧭</span>
            <span>Navegar a:</span>
          </div>
          <div style={styles.navGrid}>
            {routes.map(route => (
              <div
                key={route.url}
                onClick={() => handleNavigate(route.url)}
                style={styles.navItem}
              >
                <div style={styles.navIcon}>{route.icon}</div>
                <div style={styles.navName}>{route.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          💡 Cambia de usuario o navega a diferentes vistas
        </div>
      </div>
    </div>
  );
};

// Helper para colores de roles
const getRoleColor = (rol) => {
  const colors = {
    public: '#6b7280',
    admin: '#dc2626',
    profesor: '#2563eb',
    fono: '#059669',
    alumno: '#7c3aed',
    apoderado: '#d97706'
  };
  return colors[rol] || '#6b7280';
};

// Estilos inline
const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    zIndex: 999999,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },

  toggle: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: '3px solid #fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    transition: 'all 0.3s ease',
    userSelect: 'none',
    outline: 'none'
  },

  toggleOpen: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    transform: 'scale(1.1)'
  },

  content: {
    position: 'absolute',
    bottom: '70px',
    left: 0,
    width: '340px',
    maxHeight: '600px',
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    opacity: 0,
    transform: 'translateY(20px)',
    pointerEvents: 'none',
    transition: 'all 0.3s ease',
    overflow: 'hidden'
  },

  contentShow: {
    opacity: 1,
    transform: 'translateY(0)',
    pointerEvents: 'all'
  },

  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '16px',
    fontWeight: 600,
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },

  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },

  status: {
    background: 'rgba(255,255,255,0.2)',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 500
  },

  body: {
    padding: '16px',
    maxHeight: '500px',
    overflowY: 'auto'
  },

  currentUser: {
    background: '#f3f4f6',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    borderLeft: '4px solid #667eea'
  },

  currentUserTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '8px'
  },

  currentUserInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },

  currentUserIcon: {
    fontSize: '24px'
  },

  currentUserName: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#111827',
    marginBottom: '2px'
  },

  currentUserEmail: {
    fontSize: '12px',
    color: '#6b7280'
  },

  currentUserRole: {
    display: 'inline-block',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginTop: '4px'
  },

  usersTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '12px'
  },

  usersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },

  userItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: '#f9fafb',
    border: '2px solid transparent'
  },

  userItemActive: {
    background: '#e0e7ff',
    borderColor: '#667eea'
  },

  userIcon: {
    fontSize: '20px'
  },

  userName: {
    fontWeight: 600,
    fontSize: '13px',
    color: '#111827',
    marginBottom: '2px'
  },

  userEmail: {
    fontSize: '11px',
    color: '#6b7280'
  },

  userRole: {
    display: 'inline-block',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginTop: '2px'
  },

  separator: {
    height: '1px',
    background: '#e5e7eb',
    margin: '16px 0'
  },

  navTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },

  navGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginBottom: '16px'
  },

  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 8px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: '#f9fafb',
    border: '2px solid transparent',
    minHeight: '70px'
  },

  navIcon: {
    fontSize: '20px',
    marginBottom: '4px'
  },

  navName: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#374151',
    textAlign: 'center'
  },

  footer: {
    padding: '12px 16px',
    background: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
    fontSize: '10px',
    color: '#6b7280',
    textAlign: 'center'
  }
};

export default DevPanel;
