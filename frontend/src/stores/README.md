# Stores - Gestión de Estado con Zustand

Este directorio contiene todos los stores de Zustand para la gestión de estado global de la aplicación.

---

## Stores Disponibles

### 1. **authStore.js**
Gestión de autenticación y autorización.

```jsx
import useAuthStore from '@/stores/authStore';

const { user, token, isAuthenticated, login, logout, hasRole } = useAuthStore();
```

**Características:**
- Autenticación con JWT
- Verificación de roles
- Gestión de sesión
- Decodificación de tokens

---

### 2. **uiStore.js**
Gestión de estado de la interfaz de usuario.

```jsx
import useUIStore from '@/stores/uiStore';

const {
  sidebarOpen,
  theme,
  activeSection,
  toggleSidebar,
  setTheme,
  navigateTo
} = useUIStore();
```

**Características:**
- Sidebar (abierto/cerrado)
- Tema (light/dark)
- Notificaciones
- Modales
- Navegación SPA
- **Persistencia en localStorage**

---

### 3. **menuStore.js** ⭐ NUEVO
Gestión de menús dinámicos y navegación.

```jsx
import useMenuStore from '@/stores/menuStore';

const {
  items,
  activeSection,
  setActiveSection,
  setMenuItems,
  isActive,
  detectCurrentPage
} = useMenuStore();
```

**Características:**
- Menús dinámicos por página
- Filtrado por permisos
- Badges dinámicos
- Detección automática de página
- Integración con React Router

**Uso típico:**
```jsx
// En Sidebar.jsx
useEffect(() => {
  const adminMenu = [
    { id: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'home' },
    { id: 'usuarios', label: 'Usuarios', href: '/admin/usuarios', icon: 'users' },
  ];
  setMenuItems(adminMenu);
}, []);
```

---

### 4. **configStore.js** ⭐ NUEVO
Configuración global de la aplicación.

```jsx
import useConfigStore from '@/stores/configStore';

const {
  appName,
  features,
  isFeatureEnabled,
  toggleFeature,
  isDevelopment,
  getSetting
} = useConfigStore();
```

**Características:**
- Feature flags (activar/desactivar funcionalidades)
- Configuración de UI
- Límites del sistema
- Detección de entorno
- **Persistencia en localStorage**

**Uso típico:**
```jsx
// Verificar feature flag
if (isFeatureEnabled('exportPDF')) {
  return <ExportButton />;
}

// Obtener configuración
const itemsPerPage = getSetting('itemsPerPage'); // 10
```

**Helpers sin hooks:**
```jsx
import { isDevelopment, isProduction } from '@/stores/configStore';

// Usar fuera de componentes
const apiUrl = isDevelopment()
  ? 'http://localhost:3000'
  : 'https://api.boyhappy.com';
```

---

## Exportación Centralizada

Puedes importar todos los stores desde un solo archivo:

```jsx
import {
  useAuthStore,
  useUIStore,
  useMenuStore,
  useConfigStore
} from '@/stores';
```

---

## Persistencia

Algunos stores persisten su estado en localStorage:

| Store | Persiste | Key en localStorage | Datos persistidos |
|-------|----------|---------------------|-------------------|
| authStore | ❌ No | - | Token en cookie |
| uiStore | ✅ Sí | `ui-storage` | sidebar, theme, activeSection |
| menuStore | ❌ No | - | Estado efímero |
| configStore | ✅ Sí | `config-storage` | features, ui, notifications |

---

## Patrón de Uso

### 1. En Componentes React

```jsx
import { useEffect } from 'react';
import useMenuStore from '@/stores/menuStore';

function MyComponent() {
  const { items, setMenuItems } = useMenuStore();

  useEffect(() => {
    // Inicializar datos
    setMenuItems([...]);
  }, []);

  return <div>{items.map(item => ...)}</div>;
}
```

### 2. Fuera de Componentes

```jsx
import useAuthStore from '@/stores/authStore';

// Acceder al estado sin hooks
const isAuthenticated = useAuthStore.getState().isAuthenticated();

// Actualizar estado sin hooks
useAuthStore.getState().logout();
```

### 3. Suscribirse a Cambios

```jsx
import useAuthStore from '@/stores/authStore';

// Suscribirse a cambios
const unsubscribe = useAuthStore.subscribe(
  (state) => state.user,
  (user) => {
    console.log('Usuario cambió:', user);
  }
);

// Desuscribirse
unsubscribe();
```

---

## Testing

### Test de Store

```jsx
import { renderHook, act } from '@testing-library/react';
import useMenuStore from '@/stores/menuStore';

test('setActiveSection cambia la sección activa', () => {
  const { result } = renderHook(() => useMenuStore());

  act(() => {
    result.current.setActiveSection('usuarios');
  });

  expect(result.current.activeSection).toBe('usuarios');
});
```

---

## Mejores Prácticas

### ✅ DO

```jsx
// Usar destructuring
const { items, setMenuItems } = useMenuStore();

// Acciones específicas
setMenuItems([...]);

// Usar getState() fuera de componentes
const state = useMenuStore.getState();
```

### ❌ DON'T

```jsx
// No acceder a todo el store innecesariamente
const store = useMenuStore(); // ❌ Re-renderiza en todo cambio

// No mutar estado directamente
store.items.push(newItem); // ❌ Incorrecto

// Sí usar set para actualizar
setMenuItems([...items, newItem]); // ✅ Correcto
```

---

## Integración con React Router

### Detección de Página

```jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useMenuStore from '@/stores/menuStore';

function App() {
  const location = useLocation();
  const { detectCurrentPage } = useMenuStore();

  useEffect(() => {
    detectCurrentPage(location.pathname);
  }, [location.pathname]);

  return <Router>...</Router>;
}
```

---

## Documentación Adicional

- **MIGRATION_GUIDE.md**: Guía completa de migración desde Alpine.js
- **authStore.js**: Autenticación y autorización
- **uiStore.js**: Estado de UI
- **menuStore.js**: Menús dinámicos ⭐ NUEVO
- **configStore.js**: Configuración global ⭐ NUEVO

---

## Recursos

- [Zustand Docs](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [React Router](https://reactrouter.com/)
- [Vite](https://vitejs.dev/)

---

¡Feliz desarrollo! 🚀
