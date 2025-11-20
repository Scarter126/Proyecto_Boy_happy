# Guía de Migración: Alpine.js Stores → Zustand Stores

Esta guía explica cómo migrar del uso de Alpine.js stores a Zustand stores en React.

---

## Tabla de Contenidos

1. [menuStore (menu.js)](#1-menustore)
2. [configStore (config.js)](#2-configstore)
3. [utils.js → Helpers + Constants](#3-utilsjs--helpers--constants)
4. [Ejemplos de Uso](#ejemplos-de-uso)
5. [Integración con React Router](#integración-con-react-router)

---

## 1. menuStore

### Alpine.js (Antes)

```html
<!-- En Alpine.js -->
<nav x-data>
  <template x-for="item in $store.menu.items">
    <a :href="item.href"
       :class="$store.menu.isActive(item.id) ? 'active' : ''">
      <span x-text="item.label"></span>
    </a>
  </template>
</nav>

<script>
  // Inicialización automática
  Alpine.store('menu').init();
</script>
```

### Zustand + React (Después)

```jsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMenuStore from '@/stores/menuStore';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { items, activeSection, setActiveSection, detectCurrentPage, setMenuItems } = useMenuStore();

  // Detectar página actual
  useEffect(() => {
    const pageName = detectCurrentPage(location.pathname);
    console.log('Página detectada:', pageName);
  }, [location.pathname]);

  // Establecer menú estático
  useEffect(() => {
    setMenuItems([
      { id: 'dashboard', label: 'Dashboard', href: '/admin/dashboard', icon: 'home' },
      { id: 'usuarios', label: 'Usuarios', href: '/admin/usuarios', icon: 'users' },
      { id: 'reportes', label: 'Reportes', href: '/admin/reportes', icon: 'chart', permissions: ['admin'] },
    ]);
  }, []);

  return (
    <nav>
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={activeSection === item.id ? 'active' : ''}
          onClick={(e) => {
            e.preventDefault();
            setActiveSection(item.id);
            navigate(item.href);
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
```

### API Completa

```jsx
const {
  // Estado
  items,           // Array de items del menú
  activeSection,   // Sección activa
  pageName,        // Nombre de página detectada
  loading,         // Estado de carga
  error,           // Error si existe

  // Métodos
  detectCurrentPage,    // (pathname) => string|null
  setActiveSection,     // (sectionId) => void
  setMenuItems,         // (items) => void - Establece menú manualmente
  isActive,             // (sectionId) => boolean
  getActiveMenuItem,    // () => Object|null
  refreshBadges,        // () => void
  reset,                // () => void
} = useMenuStore();
```

---

## 2. configStore

### Alpine.js (Antes)

```html
<!-- En Alpine.js -->
<div x-data>
  <span x-show="$store.config.isFeatureEnabled('exportPDF')">
    <button>Exportar PDF</button>
  </span>

  <span x-text="$store.config.appName"></span>

  <div x-show="$store.config.isDevelopment">
    Dev Mode: ON
  </div>
</div>
```

### Zustand + React (Después)

```jsx
import useConfigStore from '@/stores/configStore';
import { isDevelopment, isProduction } from '@/stores/configStore';

function MyComponent() {
  const {
    appName,
    isFeatureEnabled,
    toggleFeature,
    isDevelopment: isDev
  } = useConfigStore();

  // O usar helpers directos (sin hooks)
  if (isDevelopment()) {
    console.log('Running in dev mode');
  }

  return (
    <div>
      <h1>{appName}</h1>

      {isFeatureEnabled('exportPDF') && (
        <button onClick={() => exportPDF()}>
          Exportar PDF
        </button>
      )}

      <button onClick={() => toggleFeature('darkMode')}>
        Toggle Dark Mode
      </button>

      {isDev() && <div className="dev-banner">DEV MODE</div>}
    </div>
  );
}
```

### API Completa

```jsx
const {
  // Estado
  appName,          // string
  appVersion,       // string
  environment,      // 'development' | 'production'
  features,         // Object con feature flags
  ui,               // Configuración de UI
  limits,           // Límites y restricciones
  notifications,    // Configuración de notificaciones

  // Métodos - Features
  isFeatureEnabled,         // (feature) => boolean
  toggleFeature,            // (feature) => void
  setFeature,               // (feature, enabled) => void

  // Métodos - Environment
  isDevelopment,            // () => boolean
  isProduction,             // () => boolean

  // Métodos - Settings
  getSetting,               // (key) => any
  updateSetting,            // (category, key, value) => void
  updateUISettings,         // (settings) => void
  updateLimits,             // (limits) => void
  updateNotificationSettings, // (settings) => void

  // Métodos - Utilities
  getAllConfig,             // () => Object
  reset,                    // () => void
} = useConfigStore();
```

### Helpers sin Hooks

```jsx
import { isDevelopment, isProduction, getEnvironment } from '@/stores/configStore';

// Usar fuera de componentes React
if (isDevelopment()) {
  console.log('Dev mode');
}

// En archivos de configuración
const apiUrl = isDevelopment()
  ? 'http://localhost:3000'
  : 'https://api.boyhappy.com';
```

---

## 3. utils.js → Helpers + Constants

### Alpine.js (Antes)

```html
<!-- En Alpine.js -->
<div x-data>
  <span x-text="$store.utils.formatDate(fecha)"></span>
  <span x-text="$store.utils.formatRut(rut)"></span>
  <span x-text="$store.utils.getEstadoTexto('aprobada')"></span>
</div>
```

### React (Después)

```jsx
import { formatDate, formatRut, validateRut } from '@/utils/helpers';
import { getEstadoTexto, ROLES, ESTADOS_MATRICULA } from '@/constants';

function MyComponent({ fecha, rut, estado }) {
  return (
    <div>
      <span>{formatDate(fecha)}</span>
      <span>{formatRut(rut)}</span>
      <span>{getEstadoTexto(estado)}</span>

      {validateRut(rut) ? (
        <span className="valid">RUT válido</span>
      ) : (
        <span className="invalid">RUT inválido</span>
      )}
    </div>
  );
}
```

### Helpers Disponibles

```jsx
import {
  // Formatters
  formatDate,
  formatRut,
  formatTelefono,
  formatNombre,

  // Validadores
  validateRut,
  validateEmail,
  validateTelefono,

  // Helpers generales
  calcularEdad,
  getIniciales,
  capitalize,
  truncate,
  debounce,
  copyToClipboard,
  downloadJSON,

  // UI Helpers - Badges
  renderBadge,
  renderEstadoBadge,
  renderRolBadge,
  renderActivoBadge,
} from '@/utils/helpers';
```

### Constants Disponibles

```jsx
import {
  // Roles
  ROLES,
  ROLES_TEXTOS,
  getRolTexto,

  // Estados
  ESTADOS_MATRICULA,
  ESTADOS_MATERIAL,
  getEstadoTexto,
  getEstadoColor,
  getEstadoVariant,

  // Badges
  BADGE_VARIANTS,
  BADGE_COLORS,

  // Sesiones
  TIPOS_SESION,
  getTipoSesionTexto,

  // Eventos
  TIPOS_EVENTO,
  getTipoEventoTexto,

  // Fechas
  DIAS_SEMANA,
  MESES,
  getDiaSemana,
  getMes,

  // Rutas
  ROUTES,

  // Límites
  LIMITS,

  // Formatos
  DATE_FORMATS,
  TIME_FORMATS,
} from '@/constants';
```

---

## Ejemplos de Uso

### Ejemplo 1: Sidebar con Menú Dinámico

```jsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMenuStore from '@/stores/menuStore';
import useAuthStore from '@/stores/authStore';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { items, activeSection, setActiveSection, setMenuItems } = useMenuStore();
  const { hasRole } = useAuthStore();

  useEffect(() => {
    // Definir menú basado en rol
    const adminMenu = [
      { id: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'home' },
      { id: 'usuarios', label: 'Usuarios', href: '/admin/usuarios', icon: 'users', permissions: ['admin'] },
      { id: 'reportes', label: 'Reportes', href: '/admin/reportes', icon: 'chart', permissions: ['admin'] },
    ];

    setMenuItems(adminMenu);
  }, []);

  // Sincronizar activeSection con URL
  useEffect(() => {
    const path = location.pathname;
    const section = path.split('/')[2] || 'dashboard';
    setActiveSection(section);
  }, [location.pathname]);

  return (
    <aside className="sidebar">
      <nav>
        {items.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className={activeSection === item.id ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.href);
            }}
          >
            <i className={`icon-${item.icon}`}></i>
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
```

### Ejemplo 2: Feature Flags

```jsx
import useConfigStore from '@/stores/configStore';

function FeatureToggler() {
  const { features, toggleFeature, isFeatureEnabled } = useConfigStore();

  return (
    <div className="features">
      <h3>Feature Flags</h3>
      {Object.keys(features).map((feature) => (
        <div key={feature}>
          <label>
            <input
              type="checkbox"
              checked={isFeatureEnabled(feature)}
              onChange={() => toggleFeature(feature)}
            />
            {feature}
          </label>
        </div>
      ))}
    </div>
  );
}
```

### Ejemplo 3: Formatear y Validar

```jsx
import { formatRut, validateRut, formatDate } from '@/utils/helpers';
import { getEstadoTexto, getEstadoVariant } from '@/constants';

function UserCard({ user }) {
  const isValid = validateRut(user.rut);

  return (
    <div className="card">
      <h3>{user.nombre}</h3>
      <p>
        RUT: {formatRut(user.rut)}
        {!isValid && <span className="error">RUT inválido</span>}
      </p>
      <p>Fecha: {formatDate(user.fechaNacimiento)}</p>
      <span className={`badge badge-${getEstadoVariant(user.estado)}`}>
        {getEstadoTexto(user.estado)}
      </span>
    </div>
  );
}
```

---

## Integración con React Router

### Detección de Página Actual

```jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useMenuStore from '@/stores/menuStore';

function App() {
  const location = useLocation();
  const { detectCurrentPage } = useMenuStore();

  useEffect(() => {
    const pageName = detectCurrentPage(location.pathname);
    console.log('Página actual:', pageName);
  }, [location.pathname]);

  return <Router>...</Router>;
}
```

### Navegación con setActiveSection

```jsx
import { useNavigate } from 'react-router-dom';
import useMenuStore from '@/stores/menuStore';

function MenuItem({ item }) {
  const navigate = useNavigate();
  const { setActiveSection } = useMenuStore();

  const handleClick = (e) => {
    e.preventDefault();
    setActiveSection(item.id);
    navigate(item.href);
  };

  return (
    <a href={item.href} onClick={handleClick}>
      {item.label}
    </a>
  );
}
```

---

## Persistencia de Datos

### configStore

El `configStore` persiste automáticamente en localStorage:
- `features` (feature flags)
- `ui` (preferencias de UI)
- `notifications` (configuración de notificaciones)

### Limpiar Persistencia

```jsx
import useConfigStore from '@/stores/configStore';

function ResetButton() {
  const { reset } = useConfigStore();

  return (
    <button onClick={reset}>
      Restaurar Configuración
    </button>
  );
}
```

---

## Comparación Rápida

| Alpine.js | Zustand |
|-----------|---------|
| `Alpine.store('menu')` | `useMenuStore()` |
| `$store.menu.items` | `const { items } = useMenuStore()` |
| `$store.config.isFeatureEnabled('pdf')` | `const { isFeatureEnabled } = useConfigStore(); isFeatureEnabled('pdf')` |
| `$store.utils.formatDate(date)` | `import { formatDate } from '@/utils/helpers'; formatDate(date)` |
| `$store.utils.getEstadoTexto('aprobada')` | `import { getEstadoTexto } from '@/constants'; getEstadoTexto('aprobada')` |

---

## Conclusión

La migración de Alpine.js a Zustand trae varias ventajas:

1. **Type Safety**: Mejor soporte de TypeScript
2. **Performance**: Renderizado más eficiente
3. **DevTools**: Integración con React DevTools
4. **Modularidad**: Importación selectiva de funciones
5. **Testabilidad**: Más fácil de testear

¡Feliz migración! 🚀
