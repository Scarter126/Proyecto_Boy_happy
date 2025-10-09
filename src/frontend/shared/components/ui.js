/**
 * UI Components - SweetAlert2 Wrappers
 *
 * Responsabilidad ÚNICA:
 * - Wrappers sobre SweetAlert2
 * - Modales, notificaciones, toasts
 * - Helpers para formularios en modales
 *
 * Requiere:
 * - SweetAlert2
 *
 * NO maneja:
 * - Componentes Alpine (eso es de components/alpine.js)
 * - Estado reactivo (eso es de store/)
 */

// ==========================================
// MODALES CON SWEETALERT2
// ==========================================

const Modal = {
  /**
   * Modal de confirmación (versión callback - legacy)
   * @param {string} message - Mensaje a mostrar
   * @param {Function} onConfirm - Callback si confirma
   * @param {Object} options - Opciones adicionales
   */
  confirm(title, message, options = {}) {
    // Si message es una función, usar modo legacy (callback)
    if (typeof message === 'function') {
      const onConfirm = message;
      return Swal.fire({
        title: title || '¿Estás seguro?',
        html: options.html || '',
        icon: options.icon || 'warning',
        showCancelButton: true,
        confirmButtonColor: options.confirmColor || '#d33',
        cancelButtonColor: options.cancelColor || '#6c757d',
        confirmButtonText: options.confirmText || 'Sí, confirmar',
        cancelButtonText: options.cancelText || 'Cancelar',
        reverseButtons: true,
        customClass: {
          confirmButton: 'btn btn-danger',
          cancelButton: 'btn btn-secondary'
        }
      }).then((result) => {
        if (result.isConfirmed && onConfirm) {
          onConfirm();
        }
      });
    }

    // Modo moderno: retorna promesa con booleano
    return Swal.fire({
      title: title || '¿Estás seguro?',
      html: message,
      icon: options.icon || 'warning',
      showCancelButton: true,
      confirmButtonColor: options.confirmColor || '#d33',
      cancelButtonColor: options.cancelColor || '#6c757d',
      confirmButtonText: options.confirmText || 'Sí, confirmar',
      cancelButtonText: options.cancelText || 'Cancelar',
      reverseButtons: true,
      customClass: {
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    }).then((result) => result.isConfirmed);
  },

  /**
   * Modal de éxito
   * @param {string} title - Título
   * @param {string} message - Mensaje HTML
   */
  success(title, message) {
    return Swal.fire({
      icon: 'success',
      title: title,
      html: message,
      confirmButtonText: 'Entendido',
      customClass: {
        confirmButton: 'btn btn-success'
      }
    });
  },

  /**
   * Modal de advertencia
   * @param {string} title - Título
   * @param {string} message - Mensaje HTML
   */
  warning(title, message) {
    return Swal.fire({
      icon: 'warning',
      title: title,
      html: message,
      confirmButtonText: 'Entendido',
      customClass: {
        confirmButton: 'btn btn-warning'
      }
    });
  },

  /**
   * Modal de error
   * @param {string} title - Título
   * @param {string} message - Mensaje HTML
   */
  error(title, message) {
    return Swal.fire({
      icon: 'error',
      title: title,
      html: message,
      confirmButtonText: 'Entendido',
      customClass: {
        confirmButton: 'btn btn-danger'
      }
    });
  },

  /**
   * Modal con formulario personalizado
   * @param {Object} config - Configuración del formulario
   */
  form(config) {
    return Swal.fire({
      title: config.title,
      html: config.html,
      showCancelButton: true,
      confirmButtonText: config.confirmText || '💾 Guardar',
      cancelButtonText: config.cancelText || 'Cancelar',
      width: config.width || '600px',
      customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-secondary',
        popup: 'custom-modal-popup'
      },
      focusConfirm: false,
      preConfirm: config.onSubmit,
      didOpen: config.onOpen,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading()
    });
  },

  /**
   * Modal informativo
   * @param {string} title - Título
   * @param {string} message - Mensaje
   * @param {string} icon - Icono: success, error, warning, info
   */
  info(title, message, icon = 'info') {
    return Swal.fire({
      title,
      html: message,
      icon,
      confirmButtonText: 'Entendido',
      customClass: {
        confirmButton: 'btn btn-primary'
      }
    });
  },

  /**
   * Modal de carga
   * @param {string} message - Mensaje a mostrar
   */
  loading(message = 'Procesando...') {
    Swal.fire({
      title: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  },

  /**
   * Cerrar modal
   */
  close() {
    Swal.close();
  },

  /**
   * Vista previa de imagen
   * @param {string} imageUrl - URL de la imagen
   * @param {string} title - Título opcional
   */
  imagePreview(imageUrl, title = '') {
    return Swal.fire({
      title,
      imageUrl,
      imageAlt: title,
      showCloseButton: true,
      showConfirmButton: false,
      width: '80%',
      customClass: {
        popup: 'image-preview-modal'
      }
    });
  }
};

// ==========================================
// NOTIFICACIONES TOAST
// ==========================================

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

const Notify = {
  /**
   * Notificación de éxito
   */
  success(message, options = {}) {
    return Toast.fire({
      icon: 'success',
      title: message,
      timer: options.timer || 3000,
      ...options
    });
  },

  /**
   * Notificación de error
   */
  error(message, options = {}) {
    return Toast.fire({
      icon: 'error',
      title: message,
      timer: options.timer || 4000,
      ...options
    });
  },

  /**
   * Notificación informativa
   */
  info(message, options = {}) {
    return Toast.fire({
      icon: 'info',
      title: message,
      timer: options.timer || 3000,
      ...options
    });
  },

  /**
   * Notificación de advertencia
   */
  warning(message, options = {}) {
    return Toast.fire({
      icon: 'warning',
      title: message,
      timer: options.timer || 3500,
      ...options
    });
  },

  /**
   * Notificación con acción
   */
  successWithAction(message, actionText, actionCallback) {
    return Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: message,
      showConfirmButton: true,
      confirmButtonText: actionText,
      timer: 5000,
      timerProgressBar: true
    }).then((result) => {
      if (result.isConfirmed && actionCallback) {
        actionCallback();
      }
    });
  }
};

// ==========================================
// HELPERS PARA FORMULARIOS EN MODALES
// ==========================================

const FormHelpers = {
  /**
   * Obtener valores de formulario dentro de Swal
   * @param {Array} fields - Array de IDs de campos
   * @returns {Object} Valores del formulario
   */
  getFormValues(fields) {
    const values = {};
    fields.forEach(field => {
      const element = Swal.getPopup().querySelector(`#${field}`);
      if (element) {
        values[field] = element.value;
      }
    });
    return values;
  },

  /**
   * Validar campos requeridos
   * @param {Array} fields - Array de IDs de campos requeridos
   * @returns {boolean} true si todos son válidos
   */
  validateRequired(fields) {
    for (const field of fields) {
      const element = Swal.getPopup().querySelector(`#${field}`);
      if (!element || !element.value.trim()) {
        Swal.showValidationMessage(`El campo ${field} es requerido`);
        return false;
      }
    }
    return true;
  },

  /**
   * Generar HTML de input estilizado
   * @param {Object} config - Configuración del input
   * @returns {string} HTML del input
   */
  input(config) {
    const {
      id,
      label,
      type = 'text',
      placeholder = '',
      required = false,
      value = '',
      options = []
    } = config;

    const requiredMark = required ? '<span style="color: red;">*</span>' : '';

    if (type === 'select') {
      return `
        <div class="form-group" style="text-align: left; margin-bottom: 15px;">
          <label for="${id}" style="display: block; margin-bottom: 5px; font-weight: 500;">
            ${label} ${requiredMark}
          </label>
          <select id="${id}" class="swal2-input" style="width: 100%; height: 40px; padding: 8px; border: 1px solid #d9d9d9; border-radius: 8px;">
            <option value="">Seleccionar...</option>
            ${options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
          </select>
        </div>
      `;
    }

    if (type === 'textarea') {
      return `
        <div class="form-group" style="text-align: left; margin-bottom: 15px;">
          <label for="${id}" style="display: block; margin-bottom: 5px; font-weight: 500;">
            ${label} ${requiredMark}
          </label>
          <textarea id="${id}" class="swal2-textarea" placeholder="${placeholder}"
                    style="width: 100%; min-height: 100px; padding: 8px; border: 1px solid #d9d9d9; border-radius: 8px;">${value}</textarea>
        </div>
      `;
    }

    return `
      <div class="form-group" style="text-align: left; margin-bottom: 15px;">
        <label for="${id}" style="display: block; margin-bottom: 5px; font-weight: 500;">
          ${label} ${requiredMark}
        </label>
        <input type="${type}" id="${id}" class="swal2-input" placeholder="${placeholder}" value="${value}"
               style="width: 100%; padding: 8px; border: 1px solid #d9d9d9; border-radius: 8px;">
      </div>
    `;
  }
};

window.Modal = Modal;
window.Notify = Notify;
window.FormHelpers = FormHelpers;

console.log('✅ components/ui.js cargado');
