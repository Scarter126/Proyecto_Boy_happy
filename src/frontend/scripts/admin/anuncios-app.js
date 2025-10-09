/**
 * Anuncios App - Alpine.js Component
 * Gestión de anuncios usando hooks de endpoints
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('anunciosApp', () => ({
    // Hooks
    anuncios: window.useAnuncios(),
    createMutation: window.useCreateAnuncio(),
    deleteMutation: window.useDeleteAnuncio(),

    // State
    nuevoAnuncio: {
      titulo: '',
      contenido: '',
      destinatarios: 'todos'
    },
    mostrarFormulario: false,

    // Lifecycle
    async init() {
      await this.anuncios.init();
      console.log('📢 Anuncios cargados:', this.anuncios.data);
    },

    // Computed: Filtrar solo anuncios (no eventos ni matrículas)
    get anunciosFiltrados() {
      if (!this.anuncios.data) return [];
      return this.anuncios.data.filter(item => item.tipo === 'anuncio');
    },

    // Debug helper
    get debugInfo() {
      return {
        loading: this.anuncios.loading,
        hasData: !!this.anuncios.data,
        totalItems: this.anuncios.data?.length || 0,
        totalAnuncios: this.anunciosFiltrados.length,
        tipos: this.anuncios.data ? [...new Set(this.anuncios.data.map(i => i.tipo))] : []
      };
    },

    // Methods
    async publicarAnuncio() {
      if (!this.nuevoAnuncio.titulo || !this.nuevoAnuncio.contenido) {
        Notify.warning('Por favor completa título y contenido');
        return;
      }

      const payload = {
        tipo: 'anuncio',
        titulo: this.nuevoAnuncio.titulo,
        contenido: this.nuevoAnuncio.contenido,
        destinatarios: this.nuevoAnuncio.destinatarios,
        autor: 'Admin',
        fecha: new Date().toISOString().split('T')[0]
      };

      console.log('📤 Enviando anuncio:', payload);

      try {
        await this.createMutation.mutate(payload);

        // Invalidar caché y recargar lista
        this.anuncios.invalidate();
        await this.anuncios.fetch(true);

        // Reset form
        this.nuevoAnuncio = {
          titulo: '',
          contenido: '',
          destinatarios: 'todos'
        };
        this.mostrarFormulario = false;

        Notify.success('Anuncio publicado correctamente');
      } catch (error) {
        console.error('Error al publicar anuncio:', error);
        Notify.error(`Error: ${error.message}`);
      }
    },

    async eliminarAnuncio(anuncio) {
      const confirmed = await Swal.fire({
        title: '¿Eliminar anuncio?',
        text: `¿Estás seguro de eliminar el anuncio "${anuncio.titulo}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });

      if (!confirmed.isConfirmed) return;

      try {
        const id = anuncio.id || anuncio.timestamp;
        await this.deleteMutation.mutate(id);

        // Invalidar caché y recargar lista
        this.anuncios.invalidate();
        await this.anuncios.fetch(true);

        Notify.success('Anuncio eliminado correctamente');
      } catch (error) {
        console.error('Error al eliminar anuncio:', error);
        Notify.error(`Error: ${error.message}`);
      }
    },

    formatDate(dateString) {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    },

    getDestinatariosLabel(destinatarios) {
      const labels = {
        'todos': 'Todos',
        'profesores': 'Solo Profesores',
        'alumnos': 'Solo Alumnos'
      };
      return labels[destinatarios] || destinatarios;
    }
  }));

  console.log('✅ anuncios-app.js registrado en Alpine');
});