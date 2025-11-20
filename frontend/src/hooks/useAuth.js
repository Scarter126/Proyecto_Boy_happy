/**
 * useAuth Hook - React Authentication Hook
 *
 * Custom hook que integra cognitoAuth service con authStore de Zustand.
 * Proporciona una API simplificada para manejar autenticación en componentes React.
 *
 * @module hooks/useAuth
 */

import { useCallback } from 'react';
import { useAuthStore } from '../stores';
import { cognitoAuth } from '../services/cognitoAuth';
import Swal from 'sweetalert2';

/**
 * Hook de autenticación integrado con Cognito y Zustand
 *
 * @returns {Object} Objeto con estado y métodos de autenticación
 *
 * @example
 * function MyComponent() {
 *   const { user, login, logout, isAuthenticated } = useAuth();
 *
 *   const handleLogin = async () => {
 *     await login('user@example.com', 'password123');
 *   };
 *
 *   return <div>{isAuthenticated ? user.name : 'No autenticado'}</div>;
 * }
 */
export function useAuth() {
  // Estado de Zustand
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const hasRole = useAuthStore(state => state.hasRole);
  const redirectByRoleFromStore = useAuthStore(state => state.redirectByRole);

  /**
   * Iniciar sesión con email y contraseña
   *
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña
   * @param {Object} options - Opciones adicionales
   * @param {boolean} options.showNotification - Mostrar notificación de éxito (default: true)
   * @param {boolean} options.redirect - Redirigir después del login (default: false)
   * @returns {Promise<Object>} Resultado del login
   *
   * @example
   * await login('user@example.com', 'pass123', { redirect: true });
   */
  const login = useCallback(async (email, password, options = {}) => {
    const { showNotification = true, redirect = false } = options;

    try {
      // Llamar al servicio de Cognito
      const result = await cognitoAuth.signIn(email, password);

      // Actualizar Zustand store
      useAuthStore.setState({
        token: result.tokens.idToken,
        user: result.user
      });

      // Mostrar notificación de éxito
      if (showNotification) {
        await Swal.fire({
          icon: 'success',
          title: `¡Bienvenido ${result.user.name || result.user.email}!`,
          text: redirect ? 'Redirigiendo...' : 'Has iniciado sesión correctamente',
          timer: redirect ? 2000 : 3000,
          showConfirmButton: false,
          timerProgressBar: true
        });
      }

      // Redirigir según rol si se solicita
      if (redirect) {
        // Usar la función del store que ya tiene acceso al usuario actualizado
        redirectByRoleFromStore();
      }

      return result;
    } catch (error) {
      // Manejar errores
      console.error('Error en login:', error);

      // Mostrar error con SweetAlert2
      await Swal.fire({
        icon: 'error',
        title: 'Error al iniciar sesión',
        text: error.message || 'Credenciales incorrectas',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#AD1457'
      });

      throw error;
    }
  }, [redirectByRoleFromStore]);

  /**
   * Cerrar sesión del usuario actual
   *
   * @param {Object} options - Opciones adicionales
   * @param {boolean} options.showNotification - Mostrar notificación (default: true)
   * @param {boolean} options.redirect - Redirigir al home (default: true)
   * @returns {Promise<void>}
   *
   * @example
   * await logout({ redirect: true });
   */
  const logout = useCallback(async (options = {}) => {
    const { showNotification = true, redirect = true } = options;

    try {
      // Llamar al servicio de Cognito
      await cognitoAuth.signOut();

      // Limpiar Zustand store
      useAuthStore.setState({
        token: null,
        user: null
      });

      // Mostrar notificación
      if (showNotification) {
        await Swal.fire({
          icon: 'success',
          title: 'Sesión cerrada',
          text: 'Has cerrado sesión correctamente',
          timer: 2000,
          showConfirmButton: false,
          timerProgressBar: true
        });
      }

      // Redirigir al home
      if (redirect) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error en logout:', error);
      // Incluso si hay error, limpiar el estado local
      useAuthStore.setState({ token: null, user: null });

      if (redirect) {
        window.location.href = '/';
      }
    }
  }, []);

  /**
   * Cambiar contraseña del usuario actual
   *
   * @param {string} oldPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<Object>} Resultado del cambio
   *
   * @example
   * await changePassword('oldPass123', 'newPass456');
   */
  const changePassword = useCallback(async (oldPassword, newPassword) => {
    try {
      const result = await cognitoAuth.changePassword(oldPassword, newPassword);

      await Swal.fire({
        icon: 'success',
        title: 'Contraseña actualizada',
        text: 'Tu contraseña ha sido cambiada exitosamente',
        confirmButtonColor: '#AD1457'
      });

      return result;
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Error al cambiar contraseña',
        text: error.message || 'No se pudo cambiar la contraseña',
        confirmButtonColor: '#AD1457'
      });

      throw error;
    }
  }, []);

  /**
   * Solicitar recuperación de contraseña
   *
   * @param {string} email - Email del usuario
   * @returns {Promise<Object>} Resultado de la solicitud
   *
   * @example
   * await forgotPassword('user@example.com');
   */
  const forgotPassword = useCallback(async (email) => {
    try {
      const result = await cognitoAuth.forgotPassword(email);

      await Swal.fire({
        icon: 'success',
        title: 'Código enviado',
        text: result.message,
        confirmButtonColor: '#AD1457'
      });

      return result;
    } catch (error) {
      console.error('Error al solicitar recuperación:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo enviar el código de recuperación',
        confirmButtonColor: '#AD1457'
      });

      throw error;
    }
  }, []);

  /**
   * Confirmar nueva contraseña con código de verificación
   *
   * @param {string} email - Email del usuario
   * @param {string} code - Código de verificación
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<Object>} Resultado de la confirmación
   *
   * @example
   * await resetPassword('user@example.com', '123456', 'newPass123');
   */
  const resetPassword = useCallback(async (email, code, newPassword) => {
    try {
      const result = await cognitoAuth.confirmPassword(email, code, newPassword);

      await Swal.fire({
        icon: 'success',
        title: 'Contraseña restablecida',
        text: 'Tu contraseña ha sido actualizada exitosamente',
        confirmButtonColor: '#AD1457'
      });

      return result;
    } catch (error) {
      console.error('Error al restablecer contraseña:', error);

      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo restablecer la contraseña',
        confirmButtonColor: '#AD1457'
      });

      throw error;
    }
  }, []);

  /**
   * Refrescar token de sesión
   *
   * @returns {Promise<Object>} Nuevos tokens
   *
   * @example
   * const newTokens = await refreshToken();
   */
  const refreshToken = useCallback(async () => {
    try {
      const result = await cognitoAuth.refreshToken();

      // Actualizar token en el store
      useAuthStore.setState({
        token: result.tokens.idToken
      });

      return result;
    } catch (error) {
      console.error('Error al refrescar token:', error);
      // Si falla el refresh, cerrar sesión
      await logout({ showNotification: false });
      throw error;
    }
  }, [logout]);

  /**
   * Verificar si el usuario tiene un rol específico
   *
   * @param {...string} roles - Roles a verificar
   * @returns {boolean} true si el usuario tiene alguno de los roles
   *
   * @example
   * const isAdmin = checkRole('admin');
   * const canAccess = checkRole('admin', 'profesor');
   */
  const checkRole = useCallback((...roles) => {
    return hasRole(...roles);
  }, [hasRole]);

  /**
   * Obtener token actual
   *
   * @returns {string|null} Token JWT o null
   *
   * @example
   * const token = getToken();
   */
  const getToken = useCallback(() => {
    return token;
  }, [token]);

  return {
    // Estado
    user,
    token,
    loading,
    isAuthenticated: isAuthenticated(),

    // Métodos de autenticación
    login,
    logout,
    changePassword,
    forgotPassword,
    resetPassword,
    refreshToken,

    // Utilidades
    checkRole,
    hasRole,
    getToken,

    // Checks de rol comunes
    isAdmin: checkRole('admin'),
    isProfesor: checkRole('profesor'),
    isFono: checkRole('fono'),
    isApoderado: checkRole('apoderado'),
    isAlumno: checkRole('alumno')
  };
}

// ========== FUNCIONES HELPER ==========

/**
 * Redirigir al usuario según su rol
 *
 * @param {string} role - Rol del usuario
 * @returns {void}
 *
 * @example
 * redirectByRole('admin'); // Redirige a /admin
 */
export function redirectByRole(role) {
  const routes = {
    admin: '/admin',
    fono: '/fono',
    profesor: '/profesores',
    apoderado: '/apoderado',
    alumno: '/alumnos'
  };

  const path = routes[role] || '/';
  window.location.href = path;
}

export default useAuth;
