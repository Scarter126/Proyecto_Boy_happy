/**
 * Materiales App - Alpine.js Component
 * Supervisión de materiales pedagógicos con aprobación/rechazo
 */
function materialesApp() {
  return {
    // Estado
    filtros: {
      estado: '',
      curso: ''
    },

    // Hooks reutilizables
    materiales: useMateriales(),
    updateMaterialMutation: useUpdateMaterial(),

    // Lifecycle
    async init() {
      if (this.materiales.init) await this.materiales.init();
      await this.cargarDatos();
    },

    async cargarDatos() {
      const params = {};
      if (this.filtros.curso) params.curso = this.filtros.curso;

      this.materiales = useMateriales(params);
      await this.materiales.fetch();
    },

    async aplicarFiltros() {
      await this.cargarDatos();
    },

    // Computed: Materiales filtrados por estado
    get materialesFiltrados() {
      if (!this.materiales.data) return [];

      let lista = this.materiales.data.materiales || this.materiales.data;

      // Filtrar por estado si está seleccionado
      if (this.filtros.estado) {
        lista = lista.filter(m => m.estado === this.filtros.estado);
      }

      return lista;
    },

    // Acciones reutilizables
    async verDetalle(material) {
      await Swal.fire({
        icon: 'info',
        title: material.titulo,
        html: `
          <div style="text-align: left;">
            <p><strong>📚 Curso:</strong> ${material.curso}</p>
            <p><strong>📖 Asignatura:</strong> ${material.asignatura}</p>
            <p><strong>👨‍🏫 Profesor:</strong> ${material.profesor}</p>
            <p><strong>📅 Fecha:</strong> ${new Date(material.fechaSubida).toLocaleString('es-CL')}</p>
            <p><strong>📝 Descripción:</strong> ${material.descripcion || 'Sin descripción'}</p>
            <p><strong>📁 Archivo:</strong> ${material.nombreArchivo}</p>
            <p><strong>⚙️ Estado:</strong> ${this.$store.utils.getEstadoTexto(material.estado)}</p>
            ${material.observaciones ? `<p><strong>💬 Observaciones:</strong> ${material.observaciones}</p>` : ''}
          </div>
        `,
        confirmButtonText: 'Cerrar'
      });
    },

    async aprobar(material) {
      const confirmed = await Swal.fire({
        title: '¿Aprobar material?',
        text: `"${material.titulo}"`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, aprobar',
        cancelButtonText: 'Cancelar'
      });

      if (confirmed.isConfirmed) {
        await this.updateMaterialMutation.mutate({
          id: material.id,
          data: { estado: 'aprobado' }
        });
        await this.materiales.refetch();
        Notify.success('Material aprobado correctamente');
      }
    },

    async rechazar(material) {
      const { value: observaciones } = await Swal.fire({
        title: `Rechazar material "${material.titulo}"`,
        input: 'textarea',
        inputLabel: 'Motivo del rechazo',
        inputPlaceholder: 'Escribe el motivo del rechazo...',
        showCancelButton: true,
        confirmButtonText: 'Rechazar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef5350'
      });

      if (observaciones) {
        await this.updateMaterialMutation.mutate({
          id: material.id,
          data: {
            estado: 'rechazado',
            observaciones
          }
        });
        await this.materiales.refetch();
        Notify.success('Material rechazado');
      }
    },

    async solicitarCorreccion(material) {
      const { value: observaciones } = await Swal.fire({
        title: `Solicitar corrección para "${material.titulo}"`,
        input: 'textarea',
        inputLabel: 'Indicaciones para corrección',
        inputPlaceholder: 'Escribe qué debe corregirse...',
        showCancelButton: true,
        confirmButtonText: 'Solicitar Corrección',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ff9800'
      });

      if (observaciones) {
        await this.updateMaterialMutation.mutate({
          id: material.id,
          data: {
            estado: 'requiere_correccion',
            observaciones
          }
        });
        await this.materiales.refetch();
        Notify.success('Se solicitó la corrección del material');
      }
    }
  };
}

window.materialesApp = materialesApp;
