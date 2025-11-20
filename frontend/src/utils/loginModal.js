/**
 * Login Modal with SweetAlert2 and Cognito
 *
 * Utility function to show a login modal using SweetAlert2
 * and authenticate with AWS Cognito
 */

import Swal from 'sweetalert2';
import { cognitoAuth } from '../services/cognitoAuth';
import useAuthStore from '../stores/authStore';

/**
 * Show login modal and handle authentication
 *
 * @param {Function} onSuccess - Callback function when login is successful
 * @returns {Promise<void>}
 */
export const showLoginModal = async (onSuccess) => {
  const result = await Swal.fire({
    title: '<strong>Iniciar Sesión</strong>',
    html: `
      <div style="text-align: left; padding: 0 20px;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
            <i class="fas fa-envelope" style="margin-right: 8px; color: #ad1457;"></i>
            Correo Electrónico
          </label>
          <input
            type="email"
            id="swal-email"
            class="swal2-input"
            placeholder="correo@ejemplo.com"
            style="width: 100%; margin: 0; box-sizing: border-box;"
            autocomplete="username"
          />
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
            <i class="fas fa-lock" style="margin-right: 8px; color: #ad1457;"></i>
            Contraseña
          </label>
          <input
            type="password"
            id="swal-password"
            class="swal2-input"
            placeholder="••••••••"
            style="width: 100%; margin: 0; box-sizing: border-box;"
            autocomplete="current-password"
          />
        </div>
        <div style="text-align: right; margin-top: 10px;">
          <a href="#" id="forgot-password-link" style="color: #ad1457; text-decoration: none; font-size: 14px;">
            <i class="fas fa-question-circle"></i> ¿Olvidaste tu contraseña?
          </a>
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-sign-in-alt"></i> Ingresar',
    cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
    confirmButtonColor: '#ad1457',
    cancelButtonColor: '#6c757d',
    width: '450px',
    backdrop: true,
    allowOutsideClick: true,
    customClass: {
      popup: 'login-modal-popup',
      title: 'login-modal-title',
      htmlContainer: 'login-modal-html',
      confirmButton: 'login-modal-button',
      cancelButton: 'login-modal-button'
    },
    didOpen: () => {
      // Focus en el input de email
      document.getElementById('swal-email').focus();

      // Manejar enter en los inputs
      const handleEnter = (e) => {
        if (e.key === 'Enter') {
          Swal.clickConfirm();
        }
      };

      document.getElementById('swal-email').addEventListener('keypress', handleEnter);
      document.getElementById('swal-password').addEventListener('keypress', handleEnter);

      // Manejar link de "olvidaste contraseña"
      document.getElementById('forgot-password-link')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleForgotPassword();
      });
    },
    preConfirm: () => {
      const email = document.getElementById('swal-email').value;
      const password = document.getElementById('swal-password').value;

      if (!email || !password) {
        Swal.showValidationMessage('Por favor completa todos los campos');
        return false;
      }

      if (!email.includes('@')) {
        Swal.showValidationMessage('Por favor ingresa un correo válido');
        return false;
      }

      return { email, password };
    }
  });

  if (result.isConfirmed && result.value) {
    await handleLogin(result.value.email, result.value.password, onSuccess);
  }
};

/**
 * Handle login with Cognito
 */
const handleLogin = async (email, password, onSuccess) => {
  try {
    Swal.fire({
      title: 'Iniciando sesión...',
      html: 'Por favor espera',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const result = await cognitoAuth.signIn(email, password);

    if (result.success) {
      // Update auth store - usar setAuth que existe en el store
      const { setAuth } = useAuthStore.getState();
      setAuth(result.tokens.idToken, result.user);

      // Success message
      await Swal.fire({
        icon: 'success',
        title: '¡Bienvenido!',
        text: `Hola ${result.user.name || email}`,
        timer: 2000,
        showConfirmButton: false,
        confirmButtonColor: '#ad1457'
      });

      // Callback - Extract rol from cognito:groups for compatibility
      if (onSuccess) {
        const userWithRole = {
          ...result.user,
          rol: result.user['cognito:groups']?.[0] || null
        };
        onSuccess(userWithRole);
      }
    } else {
      throw new Error(result.message || 'Error al iniciar sesión');
    }
  } catch (error) {
    console.error('Login error:', error);

    Swal.fire({
      icon: 'error',
      title: 'Error al iniciar sesión',
      text: error.message || 'Credenciales inválidas. Por favor intenta nuevamente.',
      confirmButtonText: 'Reintentar',
      confirmButtonColor: '#ad1457',
      showCancelButton: true,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Retry login
        showLoginModal(onSuccess);
      }
    });
  }
};

/**
 * Handle forgot password flow
 */
const handleForgotPassword = async () => {
  const { value: email } = await Swal.fire({
    title: 'Recuperar Contraseña',
    html: `
      <div style="text-align: left; padding: 0 20px;">
        <p style="margin-bottom: 20px; color: #666;">
          Ingresa tu correo electrónico y te enviaremos un código para restablecer tu contraseña.
        </p>
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
          <i class="fas fa-envelope" style="margin-right: 8px; color: #ad1457;"></i>
          Correo Electrónico
        </label>
        <input
          type="email"
          id="swal-reset-email"
          class="swal2-input"
          placeholder="correo@ejemplo.com"
          style="width: 100%; margin: 0;"
        />
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Enviar Código',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ad1457',
    preConfirm: () => {
      const email = document.getElementById('swal-reset-email').value;
      if (!email || !email.includes('@')) {
        Swal.showValidationMessage('Por favor ingresa un correo válido');
        return false;
      }
      return email;
    }
  });

  if (email) {
    try {
      Swal.fire({
        title: 'Enviando código...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      await cognitoAuth.forgotPassword(email);

      await Swal.fire({
        icon: 'success',
        title: '¡Código Enviado!',
        text: 'Revisa tu correo electrónico para el código de verificación.',
        confirmButtonColor: '#ad1457'
      });

      // Show reset password modal
      await showResetPasswordModal(email);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo enviar el código. Por favor intenta nuevamente.',
        confirmButtonColor: '#ad1457'
      });
    }
  }
};

/**
 * Show reset password modal
 */
const showResetPasswordModal = async (email) => {
  const result = await Swal.fire({
    title: 'Restablecer Contraseña',
    html: `
      <div style="text-align: left; padding: 0 20px;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
            <i class="fas fa-key" style="margin-right: 8px; color: #ad1457;"></i>
            Código de Verificación
          </label>
          <input
            type="text"
            id="swal-code"
            class="swal2-input"
            placeholder="123456"
            style="width: 100%; margin: 0;"
          />
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
            <i class="fas fa-lock" style="margin-right: 8px; color: #ad1457;"></i>
            Nueva Contraseña
          </label>
          <input
            type="password"
            id="swal-new-password"
            class="swal2-input"
            placeholder="••••••••"
            style="width: 100%; margin: 0;"
          />
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Restablecer',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ad1457',
    preConfirm: () => {
      const code = document.getElementById('swal-code').value;
      const newPassword = document.getElementById('swal-new-password').value;

      if (!code || !newPassword) {
        Swal.showValidationMessage('Por favor completa todos los campos');
        return false;
      }

      if (newPassword.length < 8) {
        Swal.showValidationMessage('La contraseña debe tener al menos 8 caracteres');
        return false;
      }

      return { code, newPassword };
    }
  });

  if (result.isConfirmed && result.value) {
    try {
      Swal.fire({
        title: 'Restableciendo contraseña...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      await cognitoAuth.confirmPassword(email, result.value.code, result.value.newPassword);

      await Swal.fire({
        icon: 'success',
        title: '¡Contraseña Restablecida!',
        text: 'Ahora puedes iniciar sesión con tu nueva contraseña.',
        confirmButtonColor: '#ad1457'
      });

      // Show login modal again
      showLoginModal();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo restablecer la contraseña. Verifica el código.',
        confirmButtonColor: '#ad1457'
      });
    }
  }
};
