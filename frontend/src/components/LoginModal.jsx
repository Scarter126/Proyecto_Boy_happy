/**
 * LoginModal Component - React Migration
 *
 * Modal de autenticación con SweetAlert2 para login sin redirección a Cognito Hosted UI.
 * Migrado desde Alpine.js a React con Zustand y cognitoAuth service.
 *
 * @module components/LoginModal
 */

import { useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../hooks/useAuth';

/**
 * Hook personalizado para manejar el modal de login
 *
 * @returns {Object} Funciones para mostrar y manejar el modal
 *
 * @example
 * function MyComponent() {
 *   const { showLoginModal } = useLoginModal();
 *
 *   return <button onClick={showLoginModal}>Iniciar sesión</button>;
 * }
 */
export function useLoginModal() {
  const { login } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Mostrar el modal de login con SweetAlert2
   *
   * @param {Object} options - Opciones del modal
   * @param {boolean} options.redirect - Redirigir después del login (default: true)
   * @param {Function} options.onSuccess - Callback de éxito
   * @param {Function} options.onCancel - Callback de cancelación
   * @returns {Promise<Object|null>} Resultado del login o null si se canceló
   */
  const showLoginModal = useCallback(async (options = {}) => {
    const { redirect = true, onSuccess, onCancel } = options;

    setIsOpen(true);

    const result = await Swal.fire({
      title: `
        <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
          <i class="fas fa-graduation-cap" style="color: #AD1457; font-size: 2rem;"></i>
          <span>Bienvenido a Boy Happy</span>
        </div>
      `,
      html: `
        <div style="text-align: left; padding: 0 20px;">
          <div style="margin-bottom: 20px;">
            <label for="swal-username" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
              <i class="fas fa-envelope" style="margin-right: 8px; color: #AD1457;"></i>Correo electrónico
            </label>
            <input
              type="email"
              id="swal-username"
              class="swal2-input"
              placeholder="correo@ejemplo.com"
              autocomplete="email"
              style="width: 100%; margin: 0; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem;"
            >
          </div>
          <div style="margin-bottom: 12px;">
            <label for="swal-password" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
              <i class="fas fa-lock" style="margin-right: 8px; color: #AD1457;"></i>Contraseña
            </label>
            <input
              type="password"
              id="swal-password"
              class="swal2-input"
              placeholder="••••••••"
              autocomplete="current-password"
              style="width: 100%; margin: 0; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem;"
            >
          </div>
          <div style="text-align: right; margin-bottom: 20px;">
            <a href="/reset-password" style="color: #AD1457; text-decoration: none; font-size: 0.9rem; font-weight: 500;">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-sign-in-alt"></i> Ingresar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      confirmButtonColor: '#AD1457',
      cancelButtonColor: '#6b7280',
      width: '500px',
      backdrop: true,
      allowOutsideClick: false,
      showLoaderOnConfirm: true,
      customClass: {
        popup: 'login-modal-popup',
        title: 'login-modal-title',
        confirmButton: 'login-modal-confirm',
        cancelButton: 'login-modal-cancel',
        htmlContainer: 'login-modal-content'
      },
      didOpen: () => {
        // Enfocar el campo de email al abrir
        const emailInput = document.getElementById('swal-username');
        if (emailInput) {
          emailInput.focus();
        }

        // Permitir submit con Enter
        const handleKeyPress = (e) => {
          if (e.key === 'Enter') {
            const confirmButton = Swal.getConfirmButton();
            if (confirmButton) {
              confirmButton.click();
            }
          }
        };

        const passwordInput = document.getElementById('swal-password');
        if (passwordInput) {
          passwordInput.addEventListener('keypress', handleKeyPress);
        }
      },
      preConfirm: async () => {
        const username = document.getElementById('swal-username')?.value?.trim();
        const password = document.getElementById('swal-password')?.value;

        // Validación de campos vacíos
        if (!username || !password) {
          Swal.showValidationMessage('Por favor ingresa tu correo y contraseña');
          return false;
        }

        // Validación básica de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(username)) {
          Swal.showValidationMessage('Por favor ingresa un correo electrónico válido');
          return false;
        }

        // Validación de longitud de contraseña
        if (password.length < 6) {
          Swal.showValidationMessage('La contraseña debe tener al menos 6 caracteres');
          return false;
        }

        try {
          // Intentar login con cognitoAuth
          const loginResult = await login(username, password, {
            showNotification: false,
            redirect: false
          });

          return loginResult;
        } catch (error) {
          console.error('Error en login:', error);

          // Mensajes de error personalizados
          let errorMessage = 'Error al iniciar sesión';

          if (error.code === 'NotAuthorizedException') {
            errorMessage = 'Correo o contraseña incorrectos';
          } else if (error.code === 'UserNotFoundException') {
            errorMessage = 'Usuario no encontrado';
          } else if (error.code === 'UserNotConfirmedException') {
            errorMessage = 'Usuario no confirmado. Verifica tu email';
          } else if (error.code === 'TooManyRequestsException' || error.code === 'TooManyFailedAttemptsException') {
            errorMessage = 'Demasiados intentos. Intenta más tarde';
          } else if (error.message) {
            errorMessage = error.message;
          }

          Swal.showValidationMessage(errorMessage);
          return false;
        }
      }
    });

    setIsOpen(false);

    // Si el usuario confirmó y el login fue exitoso
    if (result.isConfirmed && result.value) {
      // Mostrar mensaje de bienvenida
      await Swal.fire({
        icon: 'success',
        title: `¡Bienvenido ${result.value.user.name || result.value.user.email}!`,
        text: redirect ? 'Redirigiendo a tu panel...' : 'Has iniciado sesión correctamente',
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true
      });

      // Callback de éxito
      if (onSuccess) {
        onSuccess(result.value);
      }

      // Redirigir según rol si se solicita
      if (redirect) {
        // Usar el método del authStore para redirigir
        const { default: useAuthStore } = await import('../stores/authStore');
        const store = useAuthStore.getState();
        if (store.redirectByRole) {
          store.redirectByRole();
        }
      }

      return result.value;
    }

    // Si el usuario canceló
    if (result.isDismissed) {
      if (onCancel) {
        onCancel();
      }
    }

    return null;
  }, [login]);

  return {
    showLoginModal,
    isOpen
  };
}

/**
 * Redirigir al usuario según su rol
 * Usa el método del authStore para mantener consistencia
 *
 * @param {string} role - Rol del usuario
 * @returns {void}
 */
function redirectByRole(role) {
  // Importar authStore dinámicamente
  import('../stores/authStore').then(module => {
    const useAuthStore = module.default;
    const store = useAuthStore.getState();

    // Usar el método del store si existe, sino usar mapeo manual
    if (store.redirectByRole) {
      store.redirectByRole();
    } else {
      const routes = {
        admin: '/admin',
        fono: '/fono',
        profesor: '/profesor',
        apoderado: '/apoderado',
        alumno: '/alumnos'
      };

      const path = routes[role] || '/';
      window.location.href = path;
    }
  });
}

/**
 * Función helper para mostrar el modal de login desde cualquier lugar
 * Compatible con el API anterior de window.ModalAuth.showLoginModal()
 *
 * @param {Object} options - Opciones del modal
 * @returns {Promise<Object|null>} Resultado del login o null
 *
 * @example
 * import { showLoginModal } from './LoginModal';
 *
 * // Mostrar modal con redirección
 * await showLoginModal({ redirect: true });
 *
 * // Mostrar modal sin redirección
 * const result = await showLoginModal({ redirect: false });
 */
export async function showLoginModal(options = {}) {
  // Importar dinámicamente para evitar problemas de dependencias circulares
  const { cognitoAuth } = await import('../services/cognitoAuth');
  const useAuthStore = (await import('../stores/authStore')).default;

  const { redirect = true, onSuccess, onCancel } = options;

  const result = await Swal.fire({
    title: `
      <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
        <i class="fas fa-graduation-cap" style="color: #AD1457; font-size: 2rem;"></i>
        <span>Bienvenido a Boy Happy</span>
      </div>
    `,
    html: `
      <div style="text-align: left; padding: 0 20px;">
        <div style="margin-bottom: 20px;">
          <label for="swal-username" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
            <i class="fas fa-envelope" style="margin-right: 8px; color: #AD1457;"></i>Correo electrónico
          </label>
          <input
            type="email"
            id="swal-username"
            class="swal2-input"
            placeholder="correo@ejemplo.com"
            autocomplete="email"
            style="width: 100%; margin: 0; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem;"
          >
        </div>
        <div style="margin-bottom: 12px;">
          <label for="swal-password" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
            <i class="fas fa-lock" style="margin-right: 8px; color: #AD1457;"></i>Contraseña
          </label>
          <input
            type="password"
            id="swal-password"
            class="swal2-input"
            placeholder="••••••••"
            autocomplete="current-password"
            style="width: 100%; margin: 0; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem;"
          >
        </div>
        <div style="text-align: right; margin-bottom: 20px;">
          <a href="/reset-password" style="color: #AD1457; text-decoration: none; font-size: 0.9rem; font-weight: 500;">
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-sign-in-alt"></i> Ingresar',
    cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
    confirmButtonColor: '#AD1457',
    cancelButtonColor: '#6b7280',
    width: '500px',
    backdrop: true,
    allowOutsideClick: false,
    showLoaderOnConfirm: true,
    customClass: {
      popup: 'login-modal-popup',
      title: 'login-modal-title',
      confirmButton: 'login-modal-confirm',
      cancelButton: 'login-modal-cancel',
      htmlContainer: 'login-modal-content'
    },
    didOpen: () => {
      const emailInput = document.getElementById('swal-username');
      if (emailInput) {
        emailInput.focus();
      }

      const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
          const confirmButton = Swal.getConfirmButton();
          if (confirmButton) {
            confirmButton.click();
          }
        }
      };

      const passwordInput = document.getElementById('swal-password');
      if (passwordInput) {
        passwordInput.addEventListener('keypress', handleKeyPress);
      }
    },
    preConfirm: async () => {
      const username = document.getElementById('swal-username')?.value?.trim();
      const password = document.getElementById('swal-password')?.value;

      if (!username || !password) {
        Swal.showValidationMessage('Por favor ingresa tu correo y contraseña');
        return false;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(username)) {
        Swal.showValidationMessage('Por favor ingresa un correo electrónico válido');
        return false;
      }

      if (password.length < 6) {
        Swal.showValidationMessage('La contraseña debe tener al menos 6 caracteres');
        return false;
      }

      try {
        const loginResult = await cognitoAuth.signIn(username, password);

        // Actualizar Zustand store
        useAuthStore.setState({
          token: loginResult.tokens.idToken,
          user: loginResult.user
        });

        return loginResult;
      } catch (error) {
        console.error('Error en login:', error);

        let errorMessage = 'Error al iniciar sesión';

        if (error.code === 'NotAuthorizedException') {
          errorMessage = 'Correo o contraseña incorrectos';
        } else if (error.code === 'UserNotFoundException') {
          errorMessage = 'Usuario no encontrado';
        } else if (error.code === 'UserNotConfirmedException') {
          errorMessage = 'Usuario no confirmado. Verifica tu email';
        } else if (error.code === 'TooManyRequestsException' || error.code === 'TooManyFailedAttemptsException') {
          errorMessage = 'Demasiados intentos. Intenta más tarde';
        } else if (error.message) {
          errorMessage = error.message;
        }

        Swal.showValidationMessage(errorMessage);
        return false;
      }
    }
  });

  if (result.isConfirmed && result.value) {
    if (onSuccess) {
      onSuccess(result.value);
    }

    if (redirect) {
      // Mostrar mensaje y redirigir después
      await Swal.fire({
        icon: 'success',
        title: `¡Bienvenido ${result.value.user.name || result.value.user.email}!`,
        text: 'Redirigiendo a tu panel...',
        timer: 1500,
        showConfirmButton: false,
        timerProgressBar: true
      });

      // Redirigir después del SweetAlert
      useAuthStore.getState().redirectByRole();
    } else {
      // Solo mostrar mensaje sin redirigir
      await Swal.fire({
        icon: 'success',
        title: `¡Bienvenido ${result.value.user.name || result.value.user.email}!`,
        text: 'Has iniciado sesión correctamente',
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true
      });
    }

    return result.value;
  }

  if (result.isDismissed && onCancel) {
    onCancel();
  }

  return null;
}

// Compatibilidad con window global (para código legacy)
if (typeof window !== 'undefined') {
  window.showLoginModal = showLoginModal;
}

// Export default para compatibilidad
export default {
  useLoginModal,
  showLoginModal
};
