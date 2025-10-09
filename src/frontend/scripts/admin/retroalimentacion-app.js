/**
 * Retroalimentación App - Alpine.js Component
 * Gestión de retroalimentación usando hooks de endpoints
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('retroalimentacionApp', () => ({
    // Hooks
    retroalimentaciones: window.useRetroalimentacion(),
    usuarios: window.useUsuarios(),
    createMutation: window.useCreateRetroalimentacion(),
    updateMutation: window.useActualizarRetroalimentacion(),
    deleteMutation: window.useDeleteRetroalimentacion(),

    // State
    nuevaRetro: {
      rutUsuario: '',
      nombreUsuario: '',
      tipo: '',
      comentario: '',
      visibilidad: 'privada',
      ambito: '',
      curso: '',
      creadoPor: ''
    },
    filtros: {
      rutUsuario: '',
      tipo: ''
    },
    cursos: [
      { codigo: '', nombre: '-- Sin especificar --' },
      { codigo: 'medio-mayor', nombre: 'Medio Mayor' },
      { codigo: 'prekinder-a', nombre: 'Prekínder A' },
      { codigo: 'prekinder-b', nombre: 'Prekínder B' },
      { codigo: 'kinder', nombre: 'Kínder' },
      { codigo: 'extension', nombre: 'Extensión Horaria' }
    ],

    // Lifecycle
    async init() {
      await Promise.all([
        this.retroalimentaciones.init(),
        this.usuarios.init()
      ]);

      // Obtener usuario actual
      const user = window.getStoredUser ? window.getStoredUser() : null;
      if (user) {
        this.nuevaRetro.creadoPor = user.nombre || user.rut;
      }
    },

    // Computed
    get retroalimentacionesFiltradas() {
      if (!this.retroalimentaciones.data) return [];

      let retros = this.retroalimentaciones.data;

      if (this.filtros.rutUsuario) {
        retros = retros.filter(r => r.rutUsuario === this.filtros.rutUsuario);
      }

      if (this.filtros.tipo) {
        retros = retros.filter(r => r.tipo === this.filtros.tipo);
      }

      return retros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    get usuariosDisponibles() {
      if (!this.usuarios.data) return [];
      // Filtrar solo alumnos y profesores (no admins)
      return this.usuarios.data.filter(u =>
        u.rol === 'alumno' || u.rol === 'profesor' || u.rol === 'fono'
      );
    },

    // Methods
    async enviarRetroalimentacion() {
      if (!this.nuevaRetro.rutUsuario || !this.nuevaRetro.tipo || !this.nuevaRetro.comentario) {
        Notify.warning('Por favor completa los campos obligatorios: Usuario, Tipo y Contenido');
        return;
      }

      // Obtener nombre del usuario seleccionado
      const usuario = this.usuarios.data?.find(u => u.rut === this.nuevaRetro.rutUsuario);
      if (usuario) {
        this.nuevaRetro.nombreUsuario = `${usuario.nombre} ${usuario.apellido || ''}`.trim();
      }

      const result = await this.createMutation.mutate({
        rutUsuario: this.nuevaRetro.rutUsuario,
        nombreUsuario: this.nuevaRetro.nombreUsuario,
        tipo: this.nuevaRetro.tipo,
        comentario: this.nuevaRetro.comentario,
        visibilidad: this.nuevaRetro.visibilidad,
        ambito: this.nuevaRetro.ambito,
        curso: this.nuevaRetro.curso,
        creadoPor: this.nuevaRetro.creadoPor
      });

      if (result.success) {
        // Reset form
        this.nuevaRetro = {
          rutUsuario: '',
          nombreUsuario: '',
          tipo: '',
          comentario: '',
          visibilidad: 'privada',
          ambito: '',
          curso: '',
          creadoPor: this.nuevaRetro.creadoPor // Mantener el creador
        };
        await this.retroalimentaciones.refetch();
      }
    },

    async marcarComoLeida(retro) {
      const result = await this.updateMutation.mutate({
        id: retro.id,
        rutUsuario: retro.rutUsuario,
        timestamp: retro.timestamp,
        leida: true
      });

      if (result.success) {
        await this.retroalimentaciones.refetch();
      }
    },

    async eliminarRetroalimentacion(retro) {
      const confirmed = await Swal.fire({
        title: '¿Eliminar retroalimentación?',
        text: '¿Estás seguro de eliminar esta retroalimentación?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });

      if (!confirmed.isConfirmed) return;

      const result = await this.deleteMutation.mutate(retro.id);

      if (result.success) {
        await this.retroalimentaciones.refetch();
      }
    },

    // Helpers
    getTipoLabel(tipo) {
      const labels = {
        'desempeno_general': '📊 Desempeño General',
        'conducta': '🎭 Conducta',
        'logro_destacado': '⭐ Logro Destacado',
        'area_mejora': '📈 Área de Mejora',
        'observacion_general': '📝 Observación General',
        'retroalimentacion_padres': '👨‍👩‍👧 Retroalimentación a Padres'
      };
      return labels[tipo] || tipo;
    },

    getTipoIcon(tipo) {
      const icons = {
        'desempeno_general': '📊',
        'conducta': '🎭',
        'logro_destacado': '⭐',
        'area_mejora': '📈',
        'observacion_general': '📝',
        'retroalimentacion_padres': '👨‍👩‍👧'
      };
      return icons[tipo] || '📝';
    },

    getAmbitoLabel(ambito) {
      const labels = {
        'academico': '📚 Académico',
        'conductual': '🎯 Conductual',
        'socioemocional': '❤️ Socioemocional',
        'psicomotor': '🤸 Psicomotor'
      };
      return labels[ambito] || ambito;
    },

    formatDate(dateString) {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    formatDateShort(dateString) {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('es-CL');
    }
  }));

  console.log('✅ retroalimentacion-app.js registrado en Alpine');
});
