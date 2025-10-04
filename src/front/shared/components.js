/**
 * Sistema de Componentes Reutilizables
 * Usando SweetAlert2 + Alpine.js
 *
 * Uso:
 * 1. Incluir en HTML:
 *    <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
 *    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
 *    <script src="../shared/components.js"></script>
 *
 * 2. Usar componentes:
 *    Modal.confirm('¿Eliminar?', () => eliminar());
 *    Notify.success('Guardado correctamente');
 */

// ==========================================
// SISTEMA DE MODALES CON SWEETALERT2
// ==========================================

const Modal = {
  /**
   * Modal de confirmación estilizado
   * @param {string} message - Mensaje a mostrar
   * @param {Function} onConfirm - Callback si confirma
   * @param {Object} options - Opciones adicionales
   */
  confirm(message, onConfirm, options = {}) {
    return Swal.fire({
      title: options.title || '¿Estás seguro?',
      text: message,
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
   * Modal informativo simple
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
   * Modal de carga/procesamiento
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
   * Cerrar modal de carga
   */
  close() {
    Swal.close();
  },

  /**
   * Modal de vista previa de imagen
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
// SISTEMA DE NOTIFICACIONES TOAST
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
   * Notificación de proceso completado con acción
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
   * Generar HTML de input con estilo
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

    if (type === 'select') {
      return `
        <div class="form-group" style="text-align: left; margin-bottom: 15px;">
          <label for="${id}" style="display: block; margin-bottom: 5px; font-weight: 500;">
            ${label} ${required ? '<span style="color: red;">*</span>' : ''}
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
            ${label} ${required ? '<span style="color: red;">*</span>' : ''}
          </label>
          <textarea id="${id}" class="swal2-textarea" placeholder="${placeholder}"
                    style="width: 100%; min-height: 100px; padding: 8px; border: 1px solid #d9d9d9; border-radius: 8px;">${value}</textarea>
        </div>
      `;
    }

    return `
      <div class="form-group" style="text-align: left; margin-bottom: 15px;">
        <label for="${id}" style="display: block; margin-bottom: 5px; font-weight: 500;">
          ${label} ${required ? '<span style="color: red;">*</span>' : ''}
        </label>
        <input type="${type}" id="${id}" class="swal2-input" placeholder="${placeholder}" value="${value}"
               style="width: 100%; padding: 8px; border: 1px solid #d9d9d9; border-radius: 8px;">
      </div>
    `;
  }
};

// ==========================================
// COMPONENTES ALPINE.JS
// ==========================================

/**
 * Componente de Tabla Reutilizable
 * Uso en HTML:
 * <div x-data="DataTable({
 *   columns: [...],
 *   loadData: async () => {...}
 * })" x-init="init()">
 *   ...
 * </div>
 */
window.DataTable = function(config) {
  return {
    data: [],
    filteredData: [],
    search: '',
    sortKey: '',
    sortDirection: 'asc',
    loading: false,
    currentPage: 1,
    perPage: config.perPage || 10,
    columns: config.columns || [],

    async init() {
      this.loading = true;
      try {
        this.data = await config.loadData();
        this.filteredData = [...this.data];
      } catch (error) {
        console.error('Error cargando datos:', error);
        Notify.error('Error al cargar los datos');
      } finally {
        this.loading = false;
      }
    },

    async refresh() {
      await this.init();
      Notify.success('Datos actualizados');
    },

    filter() {
      if (!this.search.trim()) {
        this.filteredData = [...this.data];
        return;
      }

      const searchLower = this.search.toLowerCase();
      this.filteredData = this.data.filter(row => {
        return this.columns.some(col => {
          const value = String(row[col.key] || '').toLowerCase();
          return value.includes(searchLower);
        });
      });
    },

    sort(key) {
      if (this.sortKey === key) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortDirection = 'asc';
      }

      this.filteredData.sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];

        if (aVal === bVal) return 0;

        const comparison = aVal > bVal ? 1 : -1;
        return this.sortDirection === 'asc' ? comparison : -comparison;
      });
    },

    get paginatedData() {
      const start = (this.currentPage - 1) * this.perPage;
      const end = start + this.perPage;
      return this.filteredData.slice(start, end);
    },

    get totalPages() {
      return Math.ceil(this.filteredData.length / this.perPage);
    },

    nextPage() {
      if (this.currentPage < this.totalPages) this.currentPage++;
    },

    prevPage() {
      if (this.currentPage > 1) this.currentPage--;
    },

    exportToExcel() {
      if (typeof XLSX === 'undefined') {
        Notify.error('Librería XLSX no cargada');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(this.filteredData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
      XLSX.writeFile(workbook, `export_${Date.now()}.xlsx`);
      Notify.success('Exportado correctamente');
    },

    async confirmDelete(row) {
      Modal.confirm(
        `¿Eliminar ${row.nombre || 'este registro'}?`,
        async () => {
          if (config.onDelete) {
            Modal.loading('Eliminando...');
            try {
              await config.onDelete(row);
              await this.refresh();
              Notify.success('Eliminado correctamente');
            } catch (error) {
              Notify.error('Error al eliminar');
            } finally {
              Modal.close();
            }
          }
        }
      );
    }
  };
};

/**
 * Componente de Tabs
 * Uso en HTML:
 * <div x-data="{ activeTab: 'tab1' }">
 *   <button @click="activeTab = 'tab1'" :class="{ active: activeTab === 'tab1' }">Tab 1</button>
 *   <div x-show="activeTab === 'tab1'" x-transition>Contenido 1</div>
 * </div>
 */
window.TabManager = function(defaultTab = null) {
  return {
    activeTab: defaultTab,

    switchTo(tab) {
      this.activeTab = tab;

      // Callback opcional al cambiar tab
      if (this.onTabChange) {
        this.onTabChange(tab);
      }
    },

    isActive(tab) {
      return this.activeTab === tab;
    }
  };
};

/**
 * Componente de Formulario con Validación
 */
window.FormValidator = function(config) {
  return {
    fields: config.fields || {},
    errors: {},
    submitting: false,

    validate(field) {
      const rules = this.fields[field];
      const value = this[field];

      if (rules.required && !value) {
        this.errors[field] = `${rules.label} es requerido`;
        return false;
      }

      if (rules.email && value && !this.isValidEmail(value)) {
        this.errors[field] = 'Email inválido';
        return false;
      }

      if (rules.min && value && value.length < rules.min) {
        this.errors[field] = `Mínimo ${rules.min} caracteres`;
        return false;
      }

      delete this.errors[field];
      return true;
    },

    validateAll() {
      let isValid = true;
      Object.keys(this.fields).forEach(field => {
        if (!this.validate(field)) {
          isValid = false;
        }
      });
      return isValid;
    },

    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    async submit() {
      if (!this.validateAll()) {
        Notify.error('Corrige los errores del formulario');
        return;
      }

      this.submitting = true;
      try {
        await config.onSubmit(this.getData());
        Notify.success('Guardado correctamente');
        this.reset();
      } catch (error) {
        Notify.error(error.message || 'Error al guardar');
      } finally {
        this.submitting = false;
      }
    },

    getData() {
      const data = {};
      Object.keys(this.fields).forEach(field => {
        data[field] = this[field];
      });
      return data;
    },

    reset() {
      Object.keys(this.fields).forEach(field => {
        this[field] = '';
      });
      this.errors = {};
    }
  };
};

// ==========================================
// EXPORTAR COMPONENTES
// ==========================================

window.Components = {
  Modal,
  Notify,
  Toast,
  FormHelpers,
  DataTable,
  TabManager,
  FormValidator
};

// Hacer disponibles globalmente para compatibilidad
window.Modal = Modal;
window.Notify = Notify;
window.FormHelpers = FormHelpers;

console.log('✅ Sistema de componentes cargado correctamente');
