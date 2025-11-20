/**
 * Notification Service - Servicio Centralizado de Notificaciones
 *
 * Abstrae SweetAlert2 para tener un solo punto de control de todas las notificaciones.
 * Esto facilita cambiar la librería de notificaciones en el futuro si es necesario.
 *
 * @module services/notificationService
 */

import Swal from 'sweetalert2';

/**
 * Configuración por defecto de SweetAlert
 */
const defaultConfig = {
  confirmButtonColor: '#3085d6',
  cancelButtonColor: '#d33',
  confirmButtonText: 'Aceptar',
  cancelButtonText: 'Cancelar',
};

/**
 * Notificación de éxito
 * @param {string} message - Mensaje a mostrar
 * @param {string} [title='¡Éxito!'] - Título de la notificación
 * @param {Object} [options={}] - Opciones adicionales para SweetAlert
 */
export const showSuccess = (message, title = '¡Éxito!', options = {}) => {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    ...defaultConfig,
    ...options,
  });
};

/**
 * Notificación de error
 * @param {string} message - Mensaje a mostrar
 * @param {string} [title='Error'] - Título de la notificación
 * @param {Object} [options={}] - Opciones adicionales para SweetAlert
 */
export const showError = (message, title = 'Error', options = {}) => {
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    ...defaultConfig,
    ...options,
  });
};

/**
 * Notificación de advertencia
 * @param {string} message - Mensaje a mostrar
 * @param {string} [title='Advertencia'] - Título de la notificación
 * @param {Object} [options={}] - Opciones adicionales para SweetAlert
 */
export const showWarning = (message, title = 'Advertencia', options = {}) => {
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    ...defaultConfig,
    ...options,
  });
};

/**
 * Notificación de información
 * @param {string} message - Mensaje a mostrar
 * @param {string} [title='Información'] - Título de la notificación
 * @param {Object} [options={}] - Opciones adicionales para SweetAlert
 */
export const showInfo = (message, title = 'Información', options = {}) => {
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    ...defaultConfig,
    ...options,
  });
};

/**
 * Diálogo de confirmación
 * @param {string} message - Mensaje a mostrar
 * @param {string} [title='¿Estás seguro?'] - Título de la confirmación
 * @param {Object} [options={}] - Opciones adicionales para SweetAlert
 * @returns {Promise<boolean>} true si el usuario confirmó, false si canceló
 */
export const showConfirm = async (message, title = '¿Estás seguro?', options = {}) => {
  const result = await Swal.fire({
    icon: 'question',
    title,
    text: message,
    showCancelButton: true,
    ...defaultConfig,
    ...options,
  });

  return result.isConfirmed;
};

/**
 * Diálogo de confirmación de eliminación
 * @param {string} itemName - Nombre del elemento a eliminar
 * @param {Object} [options={}] - Opciones adicionales para SweetAlert
 * @returns {Promise<boolean>} true si el usuario confirmó, false si canceló
 */
export const showDeleteConfirm = async (itemName, options = {}) => {
  const result = await Swal.fire({
    icon: 'warning',
    title: '¿Estás seguro?',
    text: `Esta acción eliminará "${itemName}" de forma permanente.`,
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    confirmButtonColor: '#d33',
    ...defaultConfig,
    ...options,
  });

  return result.isConfirmed;
};

/**
 * Toast notification (notificación pequeña en la esquina)
 * @param {string} message - Mensaje a mostrar
 * @param {'success'|'error'|'warning'|'info'} [icon='success'] - Ícono de la notificación
 * @param {Object} [options={}] - Opciones adicionales
 */
export const showToast = (message, icon = 'success', options = {}) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  return Toast.fire({
    icon,
    title: message,
    ...options,
  });
};

/**
 * Notificación de carga/loading
 * @param {string} [message='Procesando...'] - Mensaje a mostrar
 * @returns {void}
 */
export const showLoading = (message = 'Procesando...') => {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

/**
 * Cerrar la notificación actual
 */
export const close = () => {
  Swal.close();
};

/**
 * Objeto de exportación por defecto con todos los métodos
 */
const notificationService = {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showConfirm,
  showDeleteConfirm,
  showToast,
  showLoading,
  close,
};

export default notificationService;
