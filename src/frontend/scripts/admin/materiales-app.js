/**
 * Materiales App - Alpine.js Component
 * Supervisión de materiales pedagógicos con aprobación/rechazo
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('materialesApp', () => ({
    // Estado
    materiales: window.useMateriales(),
    cursosQuery: null,
    busqueda: '',
    filtros: {
      estado: '',
      curso: '',
      categoria: '',
      fechaDesde: '',
      fechaHasta: ''
    },

    // Lifecycle
    async init() {
      this.cursosQuery = window.useConfiguracion('cursos');
      await Promise.all([
        this.materiales.init(),
        this.cursosQuery.init()
      ]);
    },

    // Computed: Lista de cursos
    get cursos() {
      return this.cursosQuery?.data?.cursosNombres || [];
    },

    async aplicarFiltros() {
      const params = {};
      if (this.filtros.curso) params.curso = this.filtros.curso;
      await this.materiales.fetch(params);
    },

    // Computed: Estadísticas
    get estadisticas() {
      if (!this.materiales.data) return { pendientes: 0, aprobados: 0, rechazados: 0, total: 0 };
      const items = this.materiales.data.materiales || this.materiales.data;
      return {
        pendientes: items.filter(m => m.estado === 'pendiente').length,
        aprobados: items.filter(m => m.estado === 'aprobado').length,
        rechazados: items.filter(m => m.estado === 'rechazado').length,
        total: items.length
      };
    },

    // Computed: Materiales filtrados
    get materialesFiltrados() {
      if (!this.materiales.data) return [];
      let lista = this.materiales.data.materiales || this.materiales.data;

      // Ordenar por fecha (más reciente primero)
      lista = [...lista].sort((a, b) => {
        const fechaA = new Date(a.fechaSubida || a.fecha);
        const fechaB = new Date(b.fechaSubida || b.fecha);
        return fechaB - fechaA;
      });

      // Filtro por estado
      if (this.filtros.estado) {
        lista = lista.filter(m => m.estado === this.filtros.estado);
      }

      // Filtro por curso
      if (this.filtros.curso) {
        lista = lista.filter(m => m.curso === this.filtros.curso);
      }

      // Filtro por categoría
      if (this.filtros.categoria) {
        lista = lista.filter(m => m.categoria === this.filtros.categoria);
      }

      // Filtro por fecha desde
      if (this.filtros.fechaDesde) {
        lista = lista.filter(m => {
          const fecha = m.fechaSubida || m.fecha;
          return fecha >= this.filtros.fechaDesde;
        });
      }

      // Filtro por fecha hasta
      if (this.filtros.fechaHasta) {
        lista = lista.filter(m => {
          const fecha = m.fechaSubida || m.fecha;
          return fecha <= this.filtros.fechaHasta;
        });
      }

      // Búsqueda por texto
      if (this.busqueda) {
        const search = this.busqueda.toLowerCase().trim();
        lista = lista.filter(m => {
          return (
            (m.titulo?.toLowerCase() || '').includes(search) ||
            (m.profesor?.toLowerCase() || '').includes(search) ||
            (m.asignatura?.toLowerCase() || '').includes(search)
          );
        });
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
            <p><strong>⚙️ Estado:</strong> ${window.Constants.getEstadoTexto(material.estado)}</p>
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
        await window.useUpdateMaterial().mutate({
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
        await window.useUpdateMaterial().mutate({
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
        await window.useUpdateMaterial().mutate({
          id: material.id,
          data: {
            estado: 'requiere_correccion',
            observaciones
          }
        });
        await this.materiales.refetch();
        Notify.success('Se solicitó la corrección del material');
      }
    },
    async eliminar(material) {
      console.log('🗑️ Intentando eliminar material:', material.id, material.titulo);
      const confirmed = await Modal.confirm(
        'Eliminar material',
        `¿Estás seguro de eliminar el material <strong>"${material.titulo}"</strong>?<br><br>Esta acción no se puede deshacer.`
      );
      if (!confirmed) return;
      try {
        console.log('📤 Enviando DELETE para ID:', material.id);
        await window.useDeleteMaterial().mutate(material.id);

        // Invalidar caché y recargar lista
        this.materiales.invalidate();
        await this.materiales.fetch(true);

        await Modal.success('Eliminado', 'El material ha sido eliminado correctamente');
      } catch (error) {
        console.error('❌ Error al eliminar material:', error);
        await Modal.error('Error', `No se pudo eliminar el material: ${error.message}`);
      }
    },
    async descargarArchivo(material) {
      // Por ahora solo mostrar info, luego se puede implementar descarga real
      await Swal.fire({
        icon: 'info',
        title: 'Descargar Archivo',
        html: `
          <p><strong>Archivo:</strong> ${material.nombreArchivo}</p>
          <p><strong>URL:</strong> ${material.urlArchivo}</p>
          <p style="margin-top: 15px; color: #666;">La descarga directa desde S3 se implementará próximamente.</p>
        `,
        confirmButtonText: 'Cerrar'
      });
    },
    limpiarFiltros() {
      this.filtros.estado = '';
      this.filtros.curso = '';
      this.filtros.categoria = '';
      this.filtros.fechaDesde = '';
      this.filtros.fechaHasta = '';
      this.busqueda = '';
    },
    // Helpers
    formatDate(dateString) {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    },
    getCategoriaNombre(categoria) {
      const categorias = {
        'guia': 'Guía',
        'presentacion': 'Presentación',
        'video': 'Video',
        'lectura': 'Lectura',
        'evaluacion': 'Evaluación',
        'general': 'General'
      };
      return categorias[categoria] || categoria || 'General';
    },
    getCategoriaStyle(categoria) {
      const estilos = {
        'guia': 'background: #4caf50; color: white;',
        'presentacion': 'background: #2196f3; color: white;',
        'video': 'background: #f44336; color: white;',
        'lectura': 'background: #ff9800; color: white;',
        'evaluacion': 'background: #9c27b0; color: white;',
        'general': 'background: #757575; color: white;'
      };
      return estilos[categoria] || estilos['general'];
    }
  }));

  console.log('✅ materiales-app.js registrado en Alpine');
});
