/**
 * Cognito Auth Service - React Migration
 *
 * Servicio de autenticación personalizada con AWS Cognito SDK.
 * Migrado desde Alpine.js a React, integrado con Zustand store.
 *
 * @module services/cognitoAuth
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute
} from 'amazon-cognito-identity-js';
import { env } from '../config/env';

/**
 * Servicio de autenticación con AWS Cognito
 * @class CognitoAuthService
 */
class CognitoAuthService {
  /**
   * Constructor - Inicializa el User Pool de Cognito
   */
  constructor() {
    // Configuración del User Pool desde variables de entorno centralizadas
    this.poolData = {
      UserPoolId: env.COGNITO_USER_POOL_ID,
      ClientId: env.COGNITO_CLIENT_ID
    };

    this.userPool = new CognitoUserPool(this.poolData);
  }

  /**
   * Iniciar sesión con usuario y contraseña
   *
   * @param {string} username - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object>} Objeto con success, user y tokens
   * @throws {Error} Si las credenciales son inválidas o hay error de red
   *
   * @example
   * const result = await cognitoAuth.signIn('user@example.com', 'password123');
   * // { success: true, user: {...}, tokens: {...} }
   */
  async signIn(username, password) {
    return new Promise((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: username,
        Password: password
      });

      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: this.userPool
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const idToken = result.getIdToken().getJwtToken();
          const accessToken = result.getAccessToken().getJwtToken();
          const refreshToken = result.getRefreshToken().getToken();

          // Guardar tokens en cookies (similar a lo que hace Cognito Hosted UI)
          this._setCookie('idToken', idToken, 3600); // 1 hora
          this._setCookie('accessToken', accessToken, 3600);
          this._setCookie('refreshToken', refreshToken, 2592000); // 30 días

          // Obtener información del usuario del token
          const payload = result.getIdToken().payload;
          const userData = {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            sub: payload.sub,
            'cognito:groups': payload['cognito:groups'] || [],
            exp: payload.exp
          };

          // Guardar datos del usuario en localStorage
          localStorage.setItem('user', JSON.stringify(userData));

          resolve({
            success: true,
            user: userData,
            tokens: {
              idToken,
              accessToken,
              refreshToken
            }
          });
        },

        onFailure: (err) => {
          console.error('Error de autenticación:', err);

          // Traducir mensajes de error de Cognito
          const errorMessage = this._translateCognitoError(err);

          reject({
            code: err.code,
            message: errorMessage,
            originalError: err
          });
        },

        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // Si el usuario necesita cambiar su contraseña
          reject({
            code: 'NEW_PASSWORD_REQUIRED',
            message: 'Se requiere cambio de contraseña',
            userAttributes,
            requiredAttributes,
            cognitoUser
          });
        }
      });
    });
  }

  /**
   * Cerrar sesión del usuario actual
   *
   * @returns {Promise<Object>} Objeto con success: true
   *
   * @example
   * await cognitoAuth.signOut();
   */
  async signOut() {
    const cognitoUser = this.userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }

    // Limpiar cookies
    this._deleteCookie('idToken');
    this._deleteCookie('accessToken');
    this._deleteCookie('refreshToken');

    // Limpiar localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userData');

    return { success: true };
  }

  /**
   * Obtener usuario actual de Cognito
   *
   * @returns {CognitoUser|null} Usuario de Cognito o null si no hay sesión
   *
   * @example
   * const user = cognitoAuth.getCurrentUser();
   */
  getCurrentUser() {
    return this.userPool.getCurrentUser();
  }

  /**
   * Verificar si hay una sesión activa válida
   *
   * @returns {Promise<boolean>} true si hay sesión válida, false en caso contrario
   *
   * @example
   * const isAuth = await cognitoAuth.isAuthenticated();
   */
  async isAuthenticated() {
    const cognitoUser = this.getCurrentUser();

    if (!cognitoUser) {
      return false;
    }

    return new Promise((resolve) => {
      cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Solicitar código de recuperación de contraseña
   *
   * @param {string} username - Email del usuario
   * @returns {Promise<Object>} Objeto con success y mensaje
   * @throws {Error} Si hay error al enviar el código
   *
   * @example
   * await cognitoAuth.forgotPassword('user@example.com');
   */
  async forgotPassword(username) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: this.userPool
      });

      cognitoUser.forgotPassword({
        onSuccess: (data) => {
          resolve({
            success: true,
            message: 'Código de verificación enviado a tu email',
            data
          });
        },
        onFailure: (err) => {
          const errorMessage = this._translateCognitoError(err);
          reject({
            code: err.code,
            message: errorMessage,
            originalError: err
          });
        }
      });
    });
  }

  /**
   * Confirmar nueva contraseña con código de verificación
   *
   * @param {string} username - Email del usuario
   * @param {string} code - Código de verificación recibido por email
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<Object>} Objeto con success y mensaje
   * @throws {Error} Si el código es inválido o hay error
   *
   * @example
   * await cognitoAuth.confirmPassword('user@example.com', '123456', 'newPass123');
   */
  async confirmPassword(username, code, newPassword) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: this.userPool
      });

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve({
            success: true,
            message: 'Contraseña actualizada exitosamente'
          });
        },
        onFailure: (err) => {
          const errorMessage = this._translateCognitoError(err);
          reject({
            code: err.code,
            message: errorMessage,
            originalError: err
          });
        }
      });
    });
  }

  /**
   * Cambiar contraseña del usuario actual (requiere contraseña anterior)
   *
   * @param {string} oldPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<Object>} Objeto con success y mensaje
   * @throws {Error} Si la contraseña actual es incorrecta
   *
   * @example
   * await cognitoAuth.changePassword('oldPass123', 'newPass456');
   */
  async changePassword(oldPassword, newPassword) {
    const cognitoUser = this.getCurrentUser();

    if (!cognitoUser) {
      return Promise.reject({
        code: 'NO_USER',
        message: 'No hay usuario autenticado'
      });
    }

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) {
          reject({
            code: 'INVALID_SESSION',
            message: 'Sesión inválida o expirada'
          });
          return;
        }

        cognitoUser.changePassword(oldPassword, newPassword, (err, result) => {
          if (err) {
            const errorMessage = this._translateCognitoError(err);
            reject({
              code: err.code,
              message: errorMessage,
              originalError: err
            });
            return;
          }

          resolve({
            success: true,
            message: 'Contraseña cambiada exitosamente',
            result
          });
        });
      });
    });
  }

  /**
   * Registrar nuevo usuario
   *
   * @param {string} username - Email del usuario
   * @param {string} password - Contraseña
   * @param {string} email - Email (puede ser igual a username)
   * @param {string} name - Nombre completo del usuario
   * @returns {Promise<Object>} Objeto con success, user y userConfirmed
   * @throws {Error} Si hay error en el registro
   *
   * @example
   * await cognitoAuth.signUp('user@example.com', 'pass123', 'user@example.com', 'John Doe');
   */
  async signUp(username, password, email, name) {
    return new Promise((resolve, reject) => {
      const attributeList = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
        new CognitoUserAttribute({ Name: 'name', Value: name })
      ];

      this.userPool.signUp(username, password, attributeList, null, (err, result) => {
        if (err) {
          const errorMessage = this._translateCognitoError(err);
          reject({
            code: err.code,
            message: errorMessage,
            originalError: err
          });
          return;
        }

        resolve({
          success: true,
          user: result.user,
          userConfirmed: result.userConfirmed
        });
      });
    });
  }

  /**
   * Obtener token de sesión actual (ID Token JWT)
   *
   * @returns {Promise<string|null>} Token JWT o null si no hay sesión
   *
   * @example
   * const token = await cognitoAuth.getSessionToken();
   */
  async getSessionToken() {
    const cognitoUser = this.getCurrentUser();

    if (!cognitoUser) {
      return null;
    }

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err, session) => {
        if (err) {
          reject(err);
          return;
        }

        if (session && session.isValid()) {
          resolve(session.getIdToken().getJwtToken());
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Refrescar token de sesión usando refresh token
   *
   * @returns {Promise<Object>} Nuevos tokens
   * @throws {Error} Si no hay sesión o refresh token
   *
   * @example
   * const newTokens = await cognitoAuth.refreshToken();
   */
  async refreshToken() {
    const cognitoUser = this.getCurrentUser();

    if (!cognitoUser) {
      return Promise.reject({
        code: 'NO_USER',
        message: 'No hay usuario autenticado'
      });
    }

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err, session) => {
        if (err) {
          reject(err);
          return;
        }

        if (!session.isValid()) {
          reject({
            code: 'INVALID_SESSION',
            message: 'Sesión inválida o expirada'
          });
          return;
        }

        const refreshToken = session.getRefreshToken();

        cognitoUser.refreshSession(refreshToken, (err, session) => {
          if (err) {
            reject(err);
            return;
          }

          const idToken = session.getIdToken().getJwtToken();
          const accessToken = session.getAccessToken().getJwtToken();

          // Actualizar cookies con nuevos tokens
          this._setCookie('idToken', idToken, 3600);
          this._setCookie('accessToken', accessToken, 3600);

          resolve({
            success: true,
            tokens: {
              idToken,
              accessToken
            }
          });
        });
      });
    });
  }

  // ========== MÉTODOS PRIVADOS ==========

  /**
   * Establecer una cookie
   * @private
   * @param {string} name - Nombre de la cookie
   * @param {string} value - Valor de la cookie
   * @param {number} maxAge - Tiempo de vida en segundos
   */
  _setCookie(name, value, maxAge) {
    document.cookie = `${name}=${value}; path=/; secure; samesite=strict; max-age=${maxAge}`;
  }

  /**
   * Eliminar una cookie
   * @private
   * @param {string} name - Nombre de la cookie
   */
  _deleteCookie(name) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  /**
   * Traducir errores de Cognito a mensajes en español
   * @private
   * @param {Error} error - Error de Cognito
   * @returns {string} Mensaje de error en español
   */
  _translateCognitoError(error) {
    const errorMap = {
      'UserNotFoundException': 'Usuario no encontrado',
      'NotAuthorizedException': 'Credenciales incorrectas',
      'UserNotConfirmedException': 'Usuario no confirmado. Verifica tu email',
      'PasswordResetRequiredException': 'Se requiere resetear la contraseña',
      'InvalidPasswordException': 'La contraseña no cumple con los requisitos',
      'InvalidParameterException': 'Parámetros inválidos',
      'TooManyRequestsException': 'Demasiados intentos. Intenta más tarde',
      'TooManyFailedAttemptsException': 'Demasiados intentos fallidos. Cuenta bloqueada temporalmente',
      'CodeMismatchException': 'Código de verificación incorrecto',
      'ExpiredCodeException': 'Código de verificación expirado',
      'LimitExceededException': 'Límite de intentos excedido',
      'UsernameExistsException': 'El usuario ya existe',
      'NetworkError': 'Error de conexión. Verifica tu internet'
    };

    return errorMap[error.code] || error.message || 'Error de autenticación';
  }
}

// Exportar instancia singleton
export const cognitoAuth = new CognitoAuthService();

// Default export para compatibilidad
export default cognitoAuth;
