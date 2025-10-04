/**
 * Configuración Global de SweetAlert2 con estilos Boy Happy
 * Este archivo configura SweetAlert2 con los colores y estilos del sistema
 */

// Configurar SweetAlert2 con los colores del CSS global
const SwalConfig = Swal.mixin({
  customClass: {
    confirmButton: 'swal-btn-confirm',
    cancelButton: 'swal-btn-cancel',
    denyButton: 'swal-btn-deny',
    popup: 'swal-popup',
    title: 'swal-title',
    htmlContainer: 'swal-text'
  },
  buttonsStyling: false,
  showClass: {
    popup: 'swal-show',
    backdrop: 'swal-backdrop-show'
  },
  hideClass: {
    popup: 'swal-hide',
    backdrop: 'swal-backdrop-hide'
  }
});

// Reemplazar Swal global con la configuración personalizada
window.Swal = SwalConfig;
