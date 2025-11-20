# Ejemplos Prácticos de Uso de Stores

Esta guía contiene ejemplos prácticos de cómo usar los stores de Zustand en componentes React reales.

---

## Ejemplo 1: Layout Completo con Sidebar

```jsx
// src/components/Layout/AdminLayout.jsx
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore, useMenuStore, useConfigStore } from '@/stores';

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Auth Store
  const { user, logout } = useAuthStore();

  // UI Store
  const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore();

  // Menu Store
  const { items, activeSection, setActiveSection, setMenuItems } = useMenuStore();

  // Config Store
  const { appName, isFeatureEnabled } = useConfigStore();

  // Inicializar menú
  useEffect(() => {
    const adminMenu = [
      { id: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'home' },
      { id: 'usuarios', label: 'Usuarios', href: '/admin/usuarios', icon: 'users', permissions: ['admin'] },
      { id: 'matriculas', label: 'Matrículas', href: '/admin/matriculas', icon: 'file-text' },
      { id: 'reportes', label: 'Reportes', href: '/admin/reportes', icon: 'chart', permissions: ['admin'] },
      { id: 'configuracion', label: 'Configuración', href: '/admin/configuracion', icon: 'settings' },
    ];

    setMenuItems(adminMenu);
  }, [setMenuItems]);

  // Sincronizar activeSection con URL
  useEffect(() => {
    const path = location.pathname;
    const section = path.split('/')[2] || 'dashboard';
    setActiveSection(section);
  }, [location.pathname, setActiveSection]);

  const handleNavigate = (href, sectionId) => {
    setActiveSection(sectionId);
    navigate(href);
  };

  return (
    <div className={`layout ${theme}`}>
      {/* Header */}
      <header className="header">
        <button onClick={toggleSidebar} className="sidebar-toggle">
          <i className="icon-menu"></i>
        </button>

        <h1>{appName}</h1>

        <div className="header-actions">
          {isFeatureEnabled('darkMode') && (
            <button onClick={toggleTheme} className="theme-toggle">
              <i className={theme === 'dark' ? 'icon-sun' : 'icon-moon'}></i>
            </button>
          )}

          <div className="user-menu">
            <span>{user?.name}</span>
            <button onClick={logout}>Cerrar Sesión</button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <nav>
          {items.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={activeSection === item.id ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                handleNavigate(item.href, item.id);
              }}
            >
              <i className={`icon-${item.icon}`}></i>
              <span>{item.label}</span>
              {item.badgeValue > 0 && (
                <span className="badge">{item.badgeValue}</span>
              )}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
```

---

## Ejemplo 2: Dashboard con Feature Flags

```jsx
// src/pages/admin/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useAuthStore, useConfigStore } from '@/stores';
import { formatDate } from '@/utils/helpers';
import { ROLES } from '@/constants';

function Dashboard() {
  const { user, hasRole } = useAuthStore();
  const { isFeatureEnabled, features } = useConfigStore();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Cargar estadísticas
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const response = await fetch('/api/stats');
    const data = await response.json();
    setStats(data);
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <p>Bienvenido, {user?.name}</p>
      <p>Última actualización: {formatDate(new Date())}</p>

      {/* Mostrar solo para admins */}
      {hasRole(ROLES.ADMIN) && (
        <section className="admin-section">
          <h2>Administración</h2>
          <div className="stats">
            <div className="stat-card">
              <h3>Usuarios</h3>
              <p>{stats?.usuarios || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Matrículas</h3>
              <p>{stats?.matriculas || 0}</p>
            </div>
          </div>
        </section>
      )}

      {/* Exportación (solo si feature está habilitada) */}
      {isFeatureEnabled('exportPDF') && (
        <section className="export-section">
          <h2>Exportar</h2>
          <button onClick={() => exportToPDF()}>
            Exportar a PDF
          </button>
        </section>
      )}

      {/* Analytics (solo si feature está habilitada) */}
      {isFeatureEnabled('analytics') && (
        <section className="analytics-section">
          <h2>Analíticas</h2>
          <p>Gráficos de estadísticas...</p>
        </section>
      )}

      {/* Debug: Mostrar features activas (solo en desarrollo) */}
      {import.meta.env.DEV && (
        <details className="debug">
          <summary>Debug: Features</summary>
          <pre>{JSON.stringify(features, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

export default Dashboard;
```

---

## Ejemplo 3: Tabla de Usuarios con Helpers

```jsx
// src/pages/admin/Usuarios.jsx
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { formatRut, formatDate, validateRut } from '@/utils/helpers';
import { getRolTexto, ROLES } from '@/constants';

function Usuarios() {
  const { hasRole } = useAuthStore();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const response = await fetch('/api/usuarios');
      const data = await response.json();
      setUsuarios(data.usuarios || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsuarios = usuarios.filter((u) =>
    u.nombre.toLowerCase().includes(filter.toLowerCase()) ||
    u.rut.includes(filter)
  );

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="usuarios">
      <h1>Usuarios</h1>

      {/* Filtros */}
      <div className="filters">
        <input
          type="text"
          placeholder="Buscar por nombre o RUT..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        {hasRole(ROLES.ADMIN) && (
          <button onClick={() => window.location.href = '/admin/usuarios/nuevo'}>
            Nuevo Usuario
          </button>
        )}
      </div>

      {/* Tabla */}
      <table>
        <thead>
          <tr>
            <th>RUT</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Fecha Registro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsuarios.map((usuario) => (
            <tr key={usuario.id}>
              <td>
                {formatRut(usuario.rut)}
                {!validateRut(usuario.rut) && (
                  <span className="error" title="RUT inválido">⚠️</span>
                )}
              </td>
              <td>{usuario.nombre}</td>
              <td>{usuario.email}</td>
              <td>
                <span className={`badge-rol ${usuario.rol}`}>
                  {getRolTexto(usuario.rol)}
                </span>
              </td>
              <td>{formatDate(usuario.fechaRegistro)}</td>
              <td>
                {hasRole(ROLES.ADMIN) && (
                  <>
                    <button onClick={() => editUsuario(usuario.id)}>
                      Editar
                    </button>
                    <button onClick={() => deleteUsuario(usuario.id)}>
                      Eliminar
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Usuarios;
```

---

## Ejemplo 4: Formulario con Validación

```jsx
// src/pages/admin/MatriculaForm.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useConfigStore } from '@/stores';
import { validateRut, formatRut } from '@/utils/helpers';
import { ESTADOS_MATRICULA } from '@/constants';

function MatriculaForm() {
  const navigate = useNavigate();
  const { addNotification } = useUIStore();
  const { getSetting } = useConfigStore();

  const [formData, setFormData] = useState({
    rut: '',
    nombre: '',
    apellido: '',
    email: '',
    estado: 'pendiente',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};

    if (!formData.rut) {
      newErrors.rut = 'RUT es requerido';
    } else if (!validateRut(formData.rut)) {
      newErrors.rut = 'RUT inválido';
    }

    if (!formData.nombre) {
      newErrors.nombre = 'Nombre es requerido';
    }

    if (!formData.apellido) {
      newErrors.apellido = 'Apellido es requerido';
    }

    if (!formData.email) {
      newErrors.email = 'Email es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      addNotification('Por favor corrige los errores', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/matriculas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        addNotification('Matrícula creada exitosamente', 'success');
        navigate('/admin/matriculas');
      } else {
        throw new Error('Error al crear matrícula');
      }
    } catch (error) {
      addNotification('Error al crear matrícula', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="matricula-form">
      <h1>Nueva Matrícula</h1>

      <form onSubmit={handleSubmit}>
        {/* RUT */}
        <div className="form-group">
          <label htmlFor="rut">RUT</label>
          <input
            type="text"
            id="rut"
            value={formData.rut}
            onChange={(e) => {
              const formatted = formatRut(e.target.value);
              setFormData({ ...formData, rut: formatted });
            }}
            className={errors.rut ? 'error' : ''}
          />
          {errors.rut && <span className="error-message">{errors.rut}</span>}
        </div>

        {/* Nombre */}
        <div className="form-group">
          <label htmlFor="nombre">Nombre</label>
          <input
            type="text"
            id="nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            className={errors.nombre ? 'error' : ''}
          />
          {errors.nombre && <span className="error-message">{errors.nombre}</span>}
        </div>

        {/* Apellido */}
        <div className="form-group">
          <label htmlFor="apellido">Apellido</label>
          <input
            type="text"
            id="apellido"
            value={formData.apellido}
            onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
            className={errors.apellido ? 'error' : ''}
          />
          {errors.apellido && <span className="error-message">{errors.apellido}</span>}
        </div>

        {/* Email */}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        {/* Estado */}
        <div className="form-group">
          <label htmlFor="estado">Estado</label>
          <select
            id="estado"
            value={formData.estado}
            onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
          >
            {Object.keys(ESTADOS_MATRICULA).map((key) => (
              <option key={key} value={key}>
                {ESTADOS_MATRICULA[key].texto}
              </option>
            ))}
          </select>
        </div>

        {/* Botones */}
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={() => navigate('/admin/matriculas')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default MatriculaForm;
```

---

## Ejemplo 5: Configuración de Features

```jsx
// src/pages/admin/Configuracion.jsx
import { useConfigStore } from '@/stores';

function Configuracion() {
  const {
    features,
    ui,
    limits,
    toggleFeature,
    updateUISettings,
    updateLimits,
    getAllConfig,
    reset,
  } = useConfigStore();

  const handleExport = () => {
    const config = getAllConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="configuracion">
      <h1>Configuración del Sistema</h1>

      {/* Feature Flags */}
      <section>
        <h2>Funcionalidades</h2>
        <div className="features-grid">
          {Object.keys(features).map((feature) => (
            <div key={feature} className="feature-card">
              <label>
                <input
                  type="checkbox"
                  checked={features[feature]}
                  onChange={() => toggleFeature(feature)}
                />
                <span>{feature}</span>
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* UI Settings */}
      <section>
        <h2>Configuración de UI</h2>
        <div className="form-group">
          <label>Items por página</label>
          <input
            type="number"
            value={ui.itemsPerPage}
            onChange={(e) =>
              updateUISettings({ itemsPerPage: parseInt(e.target.value) })
            }
          />
        </div>

        <div className="form-group">
          <label>Idioma</label>
          <select
            value={ui.defaultLanguage}
            onChange={(e) => updateUISettings({ defaultLanguage: e.target.value })}
          >
            <option value="es-CL">Español (Chile)</option>
            <option value="es-ES">Español (España)</option>
            <option value="en-US">English (US)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Formato de Fecha</label>
          <select
            value={ui.dateFormat}
            onChange={(e) => updateUISettings({ dateFormat: e.target.value })}
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
      </section>

      {/* Limits */}
      <section>
        <h2>Límites del Sistema</h2>
        <div className="form-group">
          <label>Tamaño máximo de archivo (MB)</label>
          <input
            type="number"
            value={limits.maxFileSize / (1024 * 1024)}
            onChange={(e) =>
              updateLimits({
                maxFileSize: parseInt(e.target.value) * 1024 * 1024,
              })
            }
          />
        </div>

        <div className="form-group">
          <label>Archivos por subida</label>
          <input
            type="number"
            value={limits.maxFilesPerUpload}
            onChange={(e) =>
              updateLimits({ maxFilesPerUpload: parseInt(e.target.value) })
            }
          />
        </div>

        <div className="form-group">
          <label>Timeout de sesión (minutos)</label>
          <input
            type="number"
            value={limits.sessionTimeout / (60 * 1000)}
            onChange={(e) =>
              updateLimits({
                sessionTimeout: parseInt(e.target.value) * 60 * 1000,
              })
            }
          />
        </div>
      </section>

      {/* Acciones */}
      <section>
        <h2>Acciones</h2>
        <button onClick={handleExport}>Exportar Configuración</button>
        <button onClick={reset} className="danger">
          Restaurar Valores por Defecto
        </button>
      </section>
    </div>
  );
}

export default Configuracion;
```

---

## Ejemplo 6: Hook Personalizado que Combina Stores

```jsx
// src/hooks/useAuth.js
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore } from '@/stores';

/**
 * Hook personalizado para gestionar autenticación
 * Combina authStore y uiStore
 */
export function useAuth(requireAuth = true) {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { addNotification } = useUIStore();

  useEffect(() => {
    if (requireAuth && !isAuthenticated()) {
      addNotification('Debes iniciar sesión', 'warning');
      navigate('/login');
    }
  }, [isAuthenticated, requireAuth, navigate, addNotification]);

  const handleLogout = () => {
    logout();
    addNotification('Sesión cerrada', 'info');
    navigate('/login');
  };

  return {
    user,
    isAuthenticated: isAuthenticated(),
    logout: handleLogout,
  };
}

// USO:
// function MyProtectedPage() {
//   const { user, logout } = useAuth();
//   return <div>Bienvenido {user?.name}</div>;
// }
```

---

## Conclusión

Estos ejemplos muestran cómo:

1. ✅ Combinar múltiples stores en un componente
2. ✅ Usar helpers y constants para formateo
3. ✅ Integrar con React Router
4. ✅ Validar formularios
5. ✅ Gestionar feature flags
6. ✅ Crear hooks personalizados

¡Copia y adapta estos ejemplos a tu proyecto! 🚀
