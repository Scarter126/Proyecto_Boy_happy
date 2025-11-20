# Servicios de Autenticación - React Migration

Migración completa de los archivos de autenticación de Alpine.js a React con integración de Zustand.

## Archivos Creados

### 1. `cognitoAuth.js` - Servicio de AWS Cognito

**Ubicación:** `src/services/cognitoAuth.js`

**Descripción:** Servicio singleton que maneja toda la autenticación con AWS Cognito SDK.

**Características:**
- Clase ES6 con métodos asíncronos
- Integración con variables de entorno de Vite
- Manejo de cookies y localStorage
- Traducción de errores de Cognito a español
- Sin dependencias de DOM (excepto cookies)

**Uso básico:**

```javascript
import { cognitoAuth } from '@/services/cognitoAuth';

// Login
const result = await cognitoAuth.signIn('user@example.com', 'password123');
// { success: true, user: {...}, tokens: {...} }

// Logout
await cognitoAuth.signOut();

// Recuperar contraseña
await cognitoAuth.forgotPassword('user@example.com');

// Confirmar nueva contraseña
await cognitoAuth.confirmPassword('user@example.com', '123456', 'newPassword');

// Cambiar contraseña
await cognitoAuth.changePassword('oldPassword', 'newPassword');

// Verificar sesión
const isAuth = await cognitoAuth.isAuthenticated();

// Obtener token
const token = await cognitoAuth.getSessionToken();

// Refrescar token
const newTokens = await cognitoAuth.refreshToken();
```

**Métodos disponibles:**

| Método | Parámetros | Retorno | Descripción |
|--------|-----------|---------|-------------|
| `signIn` | username, password | Promise\<Object\> | Iniciar sesión |
| `signOut` | - | Promise\<Object\> | Cerrar sesión |
| `getCurrentUser` | - | CognitoUser\|null | Usuario actual |
| `isAuthenticated` | - | Promise\<boolean\> | Verificar sesión |
| `forgotPassword` | username | Promise\<Object\> | Solicitar código |
| `confirmPassword` | username, code, newPassword | Promise\<Object\> | Confirmar nueva contraseña |
| `changePassword` | oldPassword, newPassword | Promise\<Object\> | Cambiar contraseña |
| `signUp` | username, password, email, name | Promise\<Object\> | Registrar usuario |
| `getSessionToken` | - | Promise\<string\|null\> | Obtener token |
| `refreshToken` | - | Promise\<Object\> | Refrescar token |

---

### 2. `useAuth.js` - Custom Hook de Autenticación

**Ubicación:** `src/hooks/useAuth.js`

**Descripción:** Hook personalizado que integra cognitoAuth service con authStore de Zustand.

**Características:**
- API simplificada para componentes React
- Integración con SweetAlert2 para notificaciones
- Manejo automático de errores
- Funciones de redirección por rol
- Checks de roles integrados

**Uso básico:**

```javascript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    isAdmin,
    isProfesor
  } = useAuth();

  const handleLogin = async () => {
    try {
      await login('user@example.com', 'password123', {
        redirect: true
      });
    } catch (error) {
      // Error ya manejado por el hook
    }
  };

  if (!isAuthenticated) {
    return <button onClick={handleLogin}>Iniciar sesión</button>;
  }

  return (
    <div>
      <h1>Bienvenido {user.name}</h1>
      {isAdmin && <p>Eres administrador</p>}
      <button onClick={() => logout()}>Cerrar sesión</button>
    </div>
  );
}
```

**API del Hook:**

```typescript
interface UseAuthReturn {
  // Estado
  user: Object | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;

  // Métodos principales
  login(email: string, password: string, options?: LoginOptions): Promise<Object>;
  logout(options?: LogoutOptions): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<Object>;
  forgotPassword(email: string): Promise<Object>;
  resetPassword(email: string, code: string, newPassword: string): Promise<Object>;
  refreshToken(): Promise<Object>;

  // Utilidades
  checkRole(...roles: string[]): boolean;
  hasRole(...roles: string[]): boolean;
  getToken(): string | null;

  // Checks de roles
  isAdmin: boolean;
  isProfesor: boolean;
  isFono: boolean;
  isApoderado: boolean;
  isAlumno: boolean;
}
```

**Opciones de login:**

```javascript
{
  showNotification: true,  // Mostrar notificación de éxito
  redirect: false          // Redirigir después del login
}
```

---

### 3. `LoginModal.jsx` - Componente de Modal de Login

**Ubicación:** `src/components/LoginModal.jsx`

**Descripción:** Componente y funciones helper para mostrar modal de login con SweetAlert2.

**Características:**
- Modal estilizado con SweetAlert2
- Validación de formulario
- Integración con useAuth hook
- Función helper para uso global
- Compatibilidad con código legacy

**Uso como Hook:**

```javascript
import { useLoginModal } from '@/components/LoginModal';

function Header() {
  const { showLoginModal } = useLoginModal();

  return (
    <button onClick={() => showLoginModal({ redirect: true })}>
      Iniciar sesión
    </button>
  );
}
```

**Uso como Función Helper:**

```javascript
import { showLoginModal } from '@/components/LoginModal';

// Desde cualquier archivo JS
async function handleLogin() {
  const result = await showLoginModal({
    redirect: true,
    onSuccess: (data) => {
      console.log('Login exitoso:', data);
    },
    onCancel: () => {
      console.log('Login cancelado');
    }
  });
}

// También disponible globalmente (compatibilidad legacy)
window.showLoginModal({ redirect: true });
```

**Opciones del Modal:**

```javascript
{
  redirect: true,           // Redirigir después del login
  onSuccess: (data) => {}, // Callback de éxito
  onCancel: () => {}       // Callback de cancelación
}
```

---

## Variables de Entorno

Crear archivo `.env` en la raíz de `app/frontend/`:

```env
# AWS Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_1ma4yznFs
COGNITO_CLIENT_ID=647coj2eppb47peole85bdogk7
```

**Nota:** Si no se proporcionan las variables de entorno, se usan los valores por defecto hardcoded en el código.

---

## Integración con Zustand Store

Los nuevos métodos agregados al `authStore`:

```javascript
// authStore.js - Nuevos métodos

setAuth: (token, user) => {
  set({ token, user });
}

clearAuth: () => {
  set({ token: null, user: null });
}
```

**Uso directo del store:**

```javascript
import { useAuthStore } from '@/stores';

// En un componente
function MyComponent() {
  const { setAuth, clearAuth } = useAuthStore();

  // Establecer autenticación manualmente
  setAuth('token123', { name: 'John', email: 'john@example.com' });

  // Limpiar autenticación
  clearAuth();
}
```

---

## Migración desde Alpine.js

### Antes (Alpine.js):

```javascript
// cognito-auth.js
window.CognitoAuth = cognitoAuth;

// modal-auth.js
window.ModalAuth.showLoginModal();

// En HTML
<script>
  window.CognitoAuth.signIn('user@example.com', 'password');
</script>
```

### Después (React):

```javascript
// En componente React
import { useAuth } from '@/hooks/useAuth';
import { showLoginModal } from '@/components/LoginModal';

function MyComponent() {
  const { login } = useAuth();

  // Opción 1: Usar el hook
  await login('user@example.com', 'password', { redirect: true });

  // Opción 2: Usar el modal
  await showLoginModal({ redirect: true });
}
```

---

## Manejo de Errores

Todos los métodos de autenticación retornan errores estructurados:

```javascript
try {
  await cognitoAuth.signIn('user@example.com', 'wrongpass');
} catch (error) {
  console.log(error.code);        // 'NotAuthorizedException'
  console.log(error.message);      // 'Credenciales incorrectas'
  console.log(error.originalError); // Error original de Cognito
}
```

**Códigos de error comunes:**

| Código | Mensaje en español | Descripción |
|--------|-------------------|-------------|
| `NotAuthorizedException` | Credenciales incorrectas | Usuario o contraseña incorrectos |
| `UserNotFoundException` | Usuario no encontrado | El usuario no existe |
| `UserNotConfirmedException` | Usuario no confirmado | Email no verificado |
| `TooManyRequestsException` | Demasiados intentos | Límite de intentos excedido |
| `InvalidPasswordException` | Contraseña inválida | Contraseña no cumple requisitos |
| `CodeMismatchException` | Código incorrecto | Código de verificación incorrecto |
| `ExpiredCodeException` | Código expirado | Código de verificación expirado |

---

## Testing

Ejemplos de tests con Jest:

```javascript
import { cognitoAuth } from '@/services/cognitoAuth';
import { renderHook } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

describe('cognitoAuth', () => {
  test('should login successfully', async () => {
    const result = await cognitoAuth.signIn('test@example.com', 'password123');
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.tokens).toBeDefined();
  });
});

describe('useAuth', () => {
  test('should return auth state', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBeDefined();
    expect(result.current.login).toBeInstanceOf(Function);
  });
});
```

---

## Checklist de Integración

- [ ] Instalar dependencias: `amazon-cognito-identity-js`, `sweetalert2`
- [ ] Crear archivo `.env` con variables de Cognito
- [ ] Copiar los 3 archivos a sus ubicaciones
- [ ] Actualizar `authStore.js` con métodos `setAuth` y `clearAuth`
- [ ] Reemplazar llamadas a `window.CognitoAuth` por `import { cognitoAuth }`
- [ ] Reemplazar llamadas a `window.ModalAuth.showLoginModal()` por `showLoginModal()`
- [ ] Actualizar componentes que usan autenticación para usar `useAuth` hook
- [ ] Eliminar archivos antiguos de Alpine.js cuando todo funcione
- [ ] Probar flujos de login, logout y recuperación de contraseña

---

## Soporte

Para preguntas o problemas, consultar la documentación de:
- [AWS Cognito SDK](https://github.com/aws-amplify/amplify-js/tree/main/packages/amazon-cognito-identity-js)
- [Zustand](https://github.com/pmndrs/zustand)
- [SweetAlert2](https://sweetalert2.github.io/)

---

**Última actualización:** 2025-10-24
**Versión:** 1.0.0
**Autor:** Claude Code
