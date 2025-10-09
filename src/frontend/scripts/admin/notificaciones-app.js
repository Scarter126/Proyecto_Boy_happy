/**
 * Notificaciones App - Alpine.js Component
 * Envío de notificaciones por email usando hooks
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('notificacionesApp', () => ({
    // Hooks
    sendMutation: window.useSendNotificacion(),

    // State
    notificacion: {
      destinatarios: 'todos',
      asunto: '',
      mensaje: ''
    },
    enviando: false,

    // Lifecycle
    init() {
      // No necesita cargar datos iniciales
    },

    // Methods
    async enviarNotificacion() {
      if (!this.notificacion.asunto || !this.notificacion.mensaje) {
        Notify.warning('Por favor completa asunto y mensaje');
        return;
      }

      this.enviando = true;

      const result = await this.sendMutation.mutate({
        destinatarios: this.notificacion.destinatarios,
        asunto: this.notificacion.asunto,
        mensaje: this.notificacion.mensaje,
        fecha: new Date().toISOString()
      });

      this.enviando = false;

      if (result.success) {
        // Reset form
        this.notificacion = {
          destinatarios: 'todos',
          asunto: '',
          mensaje: ''
        };
      }
    },

    getRolLabel(rol) {
      const labels = {
        'todos': 'Todos los usuarios',
        'admin': 'Solo Administradores',
        'profesor': 'Solo Profesores',
        'fono': 'Solo Fonoaudiólogos',
        'alumno': 'Solo Alumnos/Apoderados'
      };
      return labels[rol] || rol;
    }
  }));

  console.log('✅ notificaciones-app.js registrado en Alpine');
});
