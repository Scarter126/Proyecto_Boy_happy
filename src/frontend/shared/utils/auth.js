/**
 * Auth Utils - Funciones de Autenticación con Cognito
 *
 * Responsabilidad ÚNICA:
 * - Manejo de JWT (Cognito)
 * - Lectura/escritura de cookies
 * - Decodificación de tokens
 * - Verificación de roles (cognito:groups)
 * - Logout de Cognito
 *
 * NO maneja:
 * - Reactividad (eso es de store/auth.js)
 * - Estado de UI (eso es de store/ui.js)
 */

/**
 * Cerrar sesión del usuario
 * - Limpia cookies de sesión
 * - Redirige a Cognito logout
 */
function cerrarSesion() {
  // Limpiar cookie de sesión
  document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=strict';

  // Configuración de Cognito desde window.APP_CONFIG
  const cognitoDomain = window.APP_CONFIG?.COGNITO_DOMAIN;
  const clientId = window.APP_CONFIG?.CLIENT_ID;
  const apiUrl = window.APP_CONFIG?.API_URL || window.location.origin;

  // Limpiar tokens de Cognito
  document.cookie = 'idToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

  // Limpiar localStorage
  localStorage.clear();

  if (cognitoDomain && clientId) {
    // Logout de Cognito y redirigir al home
    const logoutUrl = `https://${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(apiUrl)}`;
    window.location.href = logoutUrl;
  } else {
    // Fallback: solo redirigir al home
    console.warn('Configuración de Cognito no disponible, solo redirigiendo al home');
    window.location.href = apiUrl || '/';
  }
}

/**
 * Obtener el token de sesión desde las cookies
 * @returns {string|null} Token de sesión o null si no existe
 */
function getSessionToken() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'idToken') {
      return value;
    }
  }
  return null;
}

/**
 * Verificar si el usuario está autenticado
 * @returns {boolean} true si hay sesión activa
 */
function isAuthenticated() {
  return getSessionToken() !== null;
}

/**
 * Decodificar el payload del JWT (sin validar firma)
 * @param {string} token - JWT token
 * @returns {object|null} Payload decodificado o null si hay error
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('Error decodificando JWT:', error);
    return null;
  }
}

/**
 * Obtener información del usuario desde el token
 * @returns {object|null} Información del usuario (email, grupos, etc)
 */
function getUserInfo() {
  const token = getSessionToken();
  if (!token) return null;

  const payload = decodeJWT(token);
  if (!payload) return null;

  return {
    email: payload.email,
    groups: payload['cognito:groups'] || [],
    username: payload['cognito:username'],
    exp: payload.exp
  };
}

/**
 * Verificar si el usuario tiene un rol específico
 * @param {string} role - Rol a verificar (admin, profesor, fono, alumno)
 * @returns {boolean} true si el usuario tiene ese rol
 */
function hasRole(role) {
  const userInfo = getUserInfo();
  return userInfo && userInfo.groups.includes(role);
}

/**
 * Redirigir a login si no está autenticado
 * Útil para proteger páginas
 */
function requireAuth() {
  if (!isAuthenticated()) {
    // Redirigir al home
    const apiUrl = window.APP_CONFIG?.API_URL;
    if (apiUrl) {
      window.location.href = apiUrl;
    } else {
      // Fallback: redirigir al origen (sin stage)
      window.location.href = '/';
    }
    return false;
  }

  // Verificar si el token expiró
  const userInfo = getUserInfo();
  if (userInfo && userInfo.exp) {
    const now = Math.floor(Date.now() / 1000);
    if (now > userInfo.exp) {
      console.warn('Token expirado, redirigiendo a login');
      cerrarSesion();
      return false;
    }
  }

  return true;
}

/**
 * Obtener datos del usuario desde localStorage
 * (Compatibilidad con sistema anterior)
 * @returns {object|null} Datos del usuario o null
 */
function getUserData() {
  const userData = localStorage.getItem('userData');
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (e) {
      console.error('Error parseando userData:', e);
      return null;
    }
  }
  return null;
}

/**
 * Guardar datos del usuario en localStorage
 * @param {object} userData - Datos del usuario
 */
function saveUserData(userData) {
  localStorage.setItem('userData', JSON.stringify(userData));
}

/**
 * Obtener información completa del usuario (JWT + localStorage)
 * Combina información del token JWT con datos adicionales en localStorage
 * @returns {object|null} Información completa del usuario
 */
function getUser() {
  const jwtInfo = getUserInfo();
  const localData = getUserData();

  if (!jwtInfo) return null;

  // Mapear grupos de Cognito a rol
  const groups = jwtInfo.groups || [];
  let rol = 'alumno'; // Rol por defecto

  if (groups.includes('admin')) rol = 'admin';
  else if (groups.includes('profesor')) rol = 'profesor';
  else if (groups.includes('fono')) rol = 'fono';
  else if (groups.includes('apoderado')) rol = 'apoderado';

  // Combinar información del JWT con datos locales
  return {
    email: jwtInfo.email,
    username: jwtInfo.username,
    rol: rol,
    groups: jwtInfo.groups,
    ...localData // Datos adicionales guardados localmente
  };
}

/**
 * Verificar si el token está expirado
 * @returns {boolean} true si el token expiró
 */
function isTokenExpired() {
  const userInfo = getUserInfo();
  if (!userInfo || !userInfo.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return now > userInfo.exp;
}

// Exportar funciones al scope global
window.AuthUtils = {
  cerrarSesion,
  getSessionToken,
  isAuthenticated,
  decodeJWT,
  getUserInfo,
  hasRole,
  requireAuth,
  getUserData,
  saveUserData,
  getUser,
  isTokenExpired
};

console.log('✅ utils/auth.js cargado');
