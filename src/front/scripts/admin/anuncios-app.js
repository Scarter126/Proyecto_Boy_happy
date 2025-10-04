// =====================================================
// ANUNCIOS APP - Alpine.js Component
// =====================================================

function anunciosApp() {
  return {
    // State
    anuncios: { data: null, loading: false, error: null },
    nuevoAnuncio: {
      titulo: '',
      contenido: '',
      destinatarios: 'todos'
    },
    mostrarFormulario: false,

    // Lifecycle
    init() {
      this.cargarAnuncios();
    },

    // Methods
    async cargarAnuncios() {
      this.anuncios.loading = true;
      this.anuncios.error = null;

      try {
        const PREFIX = window.APP_CONFIG?.API_URL || '';
        const data = await window.apiClient.get(`${PREFIX}/anuncios`);
        this.anuncios.data = data || [];
      } catch (err) {
        console.error('Error cargando anuncios:', err);
        this.anuncios.error = err.message;
        await Modal.error('Error al cargar anuncios', err.message);
      } finally {
        this.anuncios.loading = false;
      }
    },

    async publicarAnuncio() {
      if (!this.nuevoAnuncio.titulo || !this.nuevoAnuncio.contenido) {
        await Modal.warning('Campos requeridos', 'Por favor completa título y contenido');
        return;
      }

      try {
        const PREFIX = window.APP_CONFIG?.API_URL || '';
        await window.apiClient.post(`${PREFIX}/anuncios`, {
          tipo: 'anuncio',
          titulo: this.nuevoAnuncio.titulo,
          contenido: this.nuevoAnuncio.contenido,
          destinatarios: this.nuevoAnuncio.destinatarios,
          autor: 'Admin',
          fecha: new Date().toISOString().split('T')[0]
        });

        await Modal.success('¡Anuncio publicado!', 'El anuncio ha sido publicado exitosamente');

        // Reset form
        this.nuevoAnuncio = {
          titulo: '',
          contenido: '',
          destinatarios: 'todos'
        };
        this.mostrarFormulario = false;

        // Reload
        await this.cargarAnuncios();
      } catch (err) {
        console.error('Error publicando anuncio:', err);
        await Modal.error('Error al publicar', err.message);
      }
    },

    async eliminarAnuncio(anuncio) {
      const confirmed = await Modal.confirm(
        '¿Eliminar anuncio?',
        `¿Estás seguro de eliminar el anuncio "${anuncio.titulo}"?`
      );

      if (!confirmed) return;

      try {
        const PREFIX = window.APP_CONFIG?.API_URL || '';
        const id = anuncio.id || anuncio.timestamp;
        await window.apiClient.delete(`${PREFIX}/anuncios?id=${id}`);

        await Modal.success('¡Eliminado!', 'El anuncio ha sido eliminado');
        await this.cargarAnuncios();
      } catch (err) {
        console.error('Error eliminando anuncio:', err);
        await Modal.error('Error al eliminar', err.message);
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
  };
}