/**
 * Ejemplos de uso de los servicios de autenticación
 *
 * Este archivo contiene ejemplos prácticos de cómo usar:
 * - cognitoAuth service
 * - useAuth hook
 * - LoginModal component
 *
 * @module services/auth-examples
 */

// ============================================================================
// EJEMPLO 1: Uso básico de cognitoAuth service
// ============================================================================

import { cognitoAuth } from './cognitoAuth';

/**
 * Ejemplo de login directo con el servicio
 */
export async function exampleDirectLogin() {
  try {
    const result = await cognitoAuth.signIn('user@example.com', 'password123');

    console.log('Login exitoso:', {
      user: result.user,
      tokens: result.tokens
    });

    // Usuario y tokens disponibles
    console.log('Nombre:', result.user.name);
    console.log('Email:', result.user.email);
    console.log('Grupos:', result.user.groups);
    console.log('ID Token:', result.tokens.idToken);

  } catch (error) {
    console.error('Error en login:', error.message);

    // Manejar diferentes tipos de errores
    if (error.code === 'NotAuthorizedException') {
      alert('Credenciales incorrectas');
    } else if (error.code === 'UserNotFoundException') {
      alert('Usuario no encontrado');
    } else {
      alert('Error de autenticación');
    }
  }
}

/**
 * Ejemplo de logout
 */
export async function exampleLogout() {
  try {
    await cognitoAuth.signOut();
    console.log('Sesión cerrada exitosamente');
    window.location.href = '/';
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

/**
 * Ejemplo de verificar autenticación
 */
export async function exampleCheckAuth() {
  const isAuth = await cognitoAuth.isAuthenticated();

  if (isAuth) {
    const user = cognitoAuth.getCurrentUser();
    console.log('Usuario autenticado:', user);
  } else {
    console.log('No hay sesión activa');
  }
}

/**
 * Ejemplo de recuperar contraseña
 */
export async function exampleForgotPassword() {
  try {
    // Solicitar código
    const result = await cognitoAuth.forgotPassword('user@example.com');
    console.log(result.message); // "Código enviado a tu email"

    // Usuario recibe código por email, luego:
    const code = '123456'; // Código recibido
    const newPassword = 'newSecurePassword123';

    // Confirmar nueva contraseña
    await cognitoAuth.confirmPassword('user@example.com', code, newPassword);
    console.log('Contraseña actualizada');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Ejemplo de cambiar contraseña
 */
export async function exampleChangePassword() {
  try {
    await cognitoAuth.changePassword('oldPassword123', 'newPassword456');
    console.log('Contraseña cambiada exitosamente');
  } catch (error) {
    if (error.code === 'NotAuthorizedException') {
      alert('Contraseña actual incorrecta');
    } else {
      alert('Error al cambiar contraseña');
    }
  }
}

/**
 * Ejemplo de obtener token
 */
export async function exampleGetToken() {
  try {
    const token = await cognitoAuth.getSessionToken();

    if (token) {
      console.log('Token JWT:', token);

      // Usar token en requests HTTP
      const response = await fetch('/api/protected-endpoint', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
  } catch (error) {
    console.error('Error al obtener token:', error);
  }
}

/**
 * Ejemplo de refrescar token
 */
export async function exampleRefreshToken() {
  try {
    const result = await cognitoAuth.refreshToken();
    console.log('Token refrescado:', result.tokens.idToken);
  } catch (error) {
    console.error('Error al refrescar token:', error);
    // Si falla el refresh, redirigir a login
    window.location.href = '/login';
  }
}

// ============================================================================
// EJEMPLO 2: Uso de useAuth hook en componentes React
// ============================================================================

import React from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Ejemplo: Componente de login simple
 */
export function LoginFormExample() {
  const { login, isAuthenticated, user, loading } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await login(email, password, {
        showNotification: true,
        redirect: true
      });
      // Usuario será redirigido automáticamente según su rol
    } catch (error) {
      // Error ya manejado por el hook con SweetAlert2
      console.error('Login falló:', error);
    }
  };

  if (isAuthenticated) {
    return (
      <div>
        <h2>Bienvenido {user.name}</h2>
        <p>Ya has iniciado sesión</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Cargando...' : 'Iniciar sesión'}
      </button>
    </form>
  );
}

/**
 * Ejemplo: Protección de rutas según rol
 */
export function AdminOnlyComponentExample() {
  const { isAdmin, isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <p>Por favor inicia sesión</p>;
  }

  if (!isAdmin) {
    return <p>No tienes permisos de administrador</p>;
  }

  return (
    <div>
      <h1>Panel de Administración</h1>
      <p>Bienvenido administrador: {user.name}</p>
    </div>
  );
}

/**
 * Ejemplo: Componente de perfil de usuario
 */
export function UserProfileExample() {
  const {
    user,
    isAuthenticated,
    logout,
    changePassword
  } = useAuth();

  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');

  if (!isAuthenticated) {
    return <p>Por favor inicia sesión</p>;
  }

  const handleChangePassword = async (e) => {
    e.preventDefault();

    try {
      await changePassword(oldPassword, newPassword);
      // SweetAlert2 mostrará notificación de éxito
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      // Error ya manejado por el hook
    }
  };

  return (
    <div>
      <h2>Mi Perfil</h2>
      <p>Nombre: {user.name}</p>
      <p>Email: {user.email}</p>
      <p>Grupos: {user.groups?.join(', ')}</p>

      <h3>Cambiar Contraseña</h3>
      <form onSubmit={handleChangePassword}>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder="Contraseña actual"
          required
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Nueva contraseña"
          required
        />
        <button type="submit">Cambiar contraseña</button>
      </form>

      <button onClick={() => logout({ redirect: true })}>
        Cerrar sesión
      </button>
    </div>
  );
}

/**
 * Ejemplo: Verificación de múltiples roles
 */
export function MultiRoleComponentExample() {
  const { checkRole, user } = useAuth();

  // Verificar si el usuario tiene alguno de estos roles
  const canAccess = checkRole('admin', 'profesor', 'fono');

  if (!canAccess) {
    return <p>No tienes permisos para ver este contenido</p>;
  }

  return (
    <div>
      <h2>Contenido Restringido</h2>
      <p>Solo visible para admin, profesor o fono</p>
      <p>Tu rol: {user.groups?.[0]}</p>
    </div>
  );
}

/**
 * Ejemplo: Recuperación de contraseña
 */
export function ForgotPasswordExample() {
  const { forgotPassword, resetPassword } = useAuth();
  const [step, setStep] = React.useState(1); // 1: solicitar código, 2: ingresar código
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');

  const handleRequestCode = async (e) => {
    e.preventDefault();

    try {
      await forgotPassword(email);
      // SweetAlert2 mostrará notificación de éxito
      setStep(2);
    } catch (error) {
      // Error ya manejado por el hook
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    try {
      await resetPassword(email, code, newPassword);
      // SweetAlert2 mostrará notificación de éxito
      // Redirigir a login
      window.location.href = '/login';
    } catch (error) {
      // Error ya manejado por el hook
    }
  };

  if (step === 1) {
    return (
      <form onSubmit={handleRequestCode}>
        <h2>Recuperar Contraseña</h2>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <button type="submit">Enviar código</button>
      </form>
    );
  }

  return (
    <form onSubmit={handleResetPassword}>
      <h2>Ingresa el código</h2>
      <p>Revisa tu email: {email}</p>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Código de verificación"
        required
      />
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Nueva contraseña"
        required
      />
      <button type="submit">Restablecer contraseña</button>
    </form>
  );
}

// ============================================================================
// EJEMPLO 3: Uso de LoginModal
// ============================================================================

import { showLoginModal, useLoginModal } from '../components/LoginModal';

/**
 * Ejemplo: Usar modal desde un botón
 */
export function HeaderWithLoginExample() {
  const { isAuthenticated, user, logout } = useAuth();

  const handleLogin = async () => {
    const result = await showLoginModal({
      redirect: true,
      onSuccess: (data) => {
        console.log('Login exitoso:', data);
      },
      onCancel: () => {
        console.log('Login cancelado');
      }
    });

    if (result) {
      console.log('Usuario logueado:', result.user);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="header">
        <p>Bienvenido {user.name}</p>
        <button onClick={() => logout()}>Cerrar sesión</button>
      </div>
    );
  }

  return (
    <div className="header">
      <button onClick={handleLogin}>Iniciar sesión</button>
    </div>
  );
}

/**
 * Ejemplo: Usar hook useLoginModal
 */
export function LoginButtonExample() {
  const { showLoginModal, isOpen } = useLoginModal();

  return (
    <button
      onClick={() => showLoginModal({ redirect: true })}
      disabled={isOpen}
    >
      {isOpen ? 'Cargando...' : 'Iniciar sesión'}
    </button>
  );
}

/**
 * Ejemplo: Modal sin redirección automática
 */
export function ManualRedirectExample() {
  const handleLogin = async () => {
    const result = await showLoginModal({
      redirect: false, // No redirigir automáticamente
      onSuccess: (data) => {
        console.log('Login exitoso:', data);

        // Lógica personalizada después del login
        if (data.user.groups?.includes('admin')) {
          window.location.href = '/admin/dashboard';
        } else {
          window.location.href = '/user/dashboard';
        }
      }
    });
  };

  return (
    <button onClick={handleLogin}>Login con redirección manual</button>
  );
}

// ============================================================================
// EJEMPLO 4: Integración con fetch/axios
// ============================================================================

import { useAuth } from '../hooks/useAuth';

/**
 * Ejemplo: Hacer peticiones autenticadas
 */
export function AuthenticatedRequestExample() {
  const { getToken, refreshToken, logout } = useAuth();

  const fetchProtectedData = async () => {
    try {
      let token = getToken();

      // Intentar hacer request
      let response = await fetch('/api/protected-endpoint', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Si el token expiró, refrescar y reintentar
      if (response.status === 401) {
        console.log('Token expirado, refrescando...');
        const refreshResult = await refreshToken();
        token = refreshResult.tokens.idToken;

        // Reintentar con nuevo token
        response = await fetch('/api/protected-endpoint', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      if (!response.ok) {
        throw new Error('Error en la petición');
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Error:', error);

      // Si falla el refresh, cerrar sesión
      if (error.code === 'INVALID_SESSION') {
        await logout({ redirect: true });
      }

      throw error;
    }
  };

  return (
    <button onClick={fetchProtectedData}>
      Cargar datos protegidos
    </button>
  );
}

/**
 * Ejemplo: Custom fetch hook con autenticación
 */
export function useAuthenticatedFetch() {
  const { getToken, refreshToken, logout } = useAuth();

  const authFetch = async (url, options = {}) => {
    const token = getToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      try {
        await refreshToken();
        // Reintentar con nuevo token
        const newToken = getToken();
        return await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
      } catch (error) {
        await logout({ redirect: true });
        throw error;
      }
    }

    return response;
  };

  return authFetch;
}

/**
 * Ejemplo: Uso del custom fetch hook
 */
export function DataFetcherExample() {
  const authFetch = useAuthenticatedFetch();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/users');
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={loadData} disabled={loading}>
        {loading ? 'Cargando...' : 'Cargar datos'}
      </button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

// ============================================================================
// EJEMPLO 5: Componente de ruta protegida
// ============================================================================

import { Navigate } from 'react-router-dom';

/**
 * Ejemplo: HOC para proteger rutas
 */
export function ProtectedRoute({ children, requiredRoles = [] }) {
  const { isAuthenticated, checkRole, user } = useAuth();

  if (!isAuthenticated) {
    // Redirigir a login si no está autenticado
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && !checkRole(...requiredRoles)) {
    // Redirigir a página de sin permisos
    return (
      <div>
        <h1>Acceso Denegado</h1>
        <p>No tienes permisos para ver esta página</p>
        <p>Tu rol: {user.groups?.[0] || 'sin rol'}</p>
      </div>
    );
  }

  return children;
}

/**
 * Ejemplo: Uso de ProtectedRoute
 */
export function AppRoutesExample() {
  return (
    <>
      {/* Ruta pública */}
      <Route path="/" element={<HomePage />} />

      {/* Ruta protegida - cualquier usuario autenticado */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Ruta protegida - solo admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      {/* Ruta protegida - admin o profesor */}
      <Route
        path="/grades"
        element={
          <ProtectedRoute requiredRoles={['admin', 'profesor']}>
            <GradesPage />
          </ProtectedRoute>
        }
      />
    </>
  );
}

// ============================================================================
// EXPORT PARA TESTING
// ============================================================================

export default {
  // Ejemplos de cognitoAuth
  exampleDirectLogin,
  exampleLogout,
  exampleCheckAuth,
  exampleForgotPassword,
  exampleChangePassword,
  exampleGetToken,
  exampleRefreshToken,

  // Componentes de ejemplo
  LoginFormExample,
  AdminOnlyComponentExample,
  UserProfileExample,
  MultiRoleComponentExample,
  ForgotPasswordExample,
  HeaderWithLoginExample,
  LoginButtonExample,
  ManualRedirectExample,
  AuthenticatedRequestExample,
  DataFetcherExample,
  ProtectedRoute,
  AppRoutesExample,

  // Hooks de ejemplo
  useAuthenticatedFetch
};
