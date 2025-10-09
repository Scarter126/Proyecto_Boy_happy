// =====================================================
// MATRÍCULAS APP - Alpine.js Component
// Gestión completa de solicitudes de matrícula
// =====================================================
document.addEventListener('alpine:init', () => {
  Alpine.data('matriculasApp', () => ({
    // State
    matriculas: window.useMatriculas(),
    filtroEstado: '',
    busqueda: '',
    fechaDesde: '',
    fechaHasta: '',
    cursos: [
      { codigo: 'medio-mayor', nombre: 'Medio Mayor' },
      { codigo: 'prekinder-a', nombre: 'Prekínder A' },
      { codigo: 'prekinder-b', nombre: 'Prekínder B' },
      { codigo: 'kinder', nombre: 'Kínder' },
      { codigo: 'extension', nombre: 'Extensión Horaria' }
    ],

    // Lifecycle
    async init() {
      await this.matriculas.init();
    },

    // Computed
    get matriculasFiltradas() {
      if (!this.matriculas.data) return [];
      let items = this.matriculas.data.matriculas || this.matriculas.data;

      // Eliminar duplicados por ID
      items = items.reduce((acc, item) => {
        if (!acc.find(i => i.id === item.id)) {
          acc.push(item);
        }
        return acc;
      }, []);

      // Ordenar de más reciente a más antigua
      items = [...items].sort((a, b) => {
        const fechaA = new Date(a.fecha || a.timestamp);
        const fechaB = new Date(b.fecha || b.timestamp);
        return fechaB - fechaA; // Descendente (más reciente primero)
      });

      // Filtro por estado
      if (this.filtroEstado) {
        items = items.filter(m => m.estado === this.filtroEstado);
      }

      // Filtro por rango de fechas
      if (this.fechaDesde) {
        items = items.filter(m => {
          const fecha = m.fecha || m.timestamp?.split('T')[0];
          return fecha >= this.fechaDesde;
        });
      }
      if (this.fechaHasta) {
        items = items.filter(m => {
          const fecha = m.fecha || m.timestamp?.split('T')[0];
          return fecha <= this.fechaHasta;
        });
      }

      // Búsqueda por texto
      if (this.busqueda) {
        const search = this.busqueda.toLowerCase().trim();
        items = items.filter(m => {
          return (
            (m.nombreAlumno?.toLowerCase() || '').includes(search) ||
            (m.nombreApoderado?.toLowerCase() || '').includes(search) ||
            (m.rutAlumno?.toLowerCase() || '').includes(search) ||
            (m.correoApoderado?.toLowerCase() || '').includes(search) ||
            (m.telefonoApoderado?.toLowerCase() || '').includes(search)
          );
        });
      }

      return items;
    },
    get estadisticas() {
      if (!this.matriculas.data) return { pendientes: 0, aprobadas: 0, rechazadas: 0, total: 0 };
      const items = this.matriculas.data.matriculas || this.matriculas.data;
      return {
        total: items.length,
        pendientes: items.filter(m => m.estado === 'pendiente').length,
        aprobadas: items.filter(m => m.estado === 'aprobada').length,
        rechazadas: items.filter(m => m.estado === 'rechazada').length
      };
    },
    // Methods
    async aprobarMatricula(matricula) {
      const confirmed = await Modal.confirm(
        'Aprobar matrícula',
        `¿Deseas aprobar la matrícula de <strong>${matricula.nombreAlumno}</strong>?`
      );
      if (!confirmed) return;
      try {
        await window.useUpdateEstadoMatricula().mutate({
          id: matricula.id,
          estado: 'aprobada',
          revisadoPor: 'Admin'
        });

        // Invalidar caché y recargar lista
        this.matriculas.invalidate();
        await this.matriculas.fetch(true);

        await Modal.success('¡Aprobada!', 'Se ha enviado un email de confirmación al apoderado');
      } catch (error) {
        console.error('Error al aprobar matrícula:', error);
      }
    },
    async rechazarMatricula(matricula) {
      const { value: motivo } = await Swal.fire({
        title: 'Rechazar matrícula',
        html: `<p>Solicitud de: <strong>${matricula.nombreAlumno}</strong></p>`,
        input: 'textarea',
        inputLabel: 'Motivo del rechazo',
        inputPlaceholder: 'Escribe el motivo...',
        inputAttributes: {
          'aria-label': 'Motivo del rechazo'
        },
        showCancelButton: true,
        confirmButtonText: 'Rechazar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
          if (!value) {
            return 'Debes escribir un motivo para el rechazo';
          }
        }
      });
      if (motivo) {
        try {
          await window.useUpdateEstadoMatricula().mutate({
            id: matricula.id,
            estado: 'rechazada',
            motivo,
            revisadoPor: 'Admin'
          });

          // Invalidar caché y recargar lista
          this.matriculas.invalidate();
          await this.matriculas.fetch(true);

          await Modal.success('Rechazada', 'Se ha enviado un email al apoderado con el motivo');
        } catch (error) {
          console.error('Error al rechazar matrícula:', error);
        }
      }
    },
    async crearUsuarioDesdeMatricula(matricula) {
      // Verificar que esté aprobada
      if (matricula.estado !== 'aprobada') {
        await Modal.warning('Estado incorrecto', 'Solo se pueden convertir matrículas aprobadas');
        return;
      }
      // Verificar que no se haya convertido ya
      if (matricula.usuarioCreado) {
        await Modal.warning('Usuario ya creado', 'Esta matrícula ya fue convertida en usuario');
        return;
      }
      // Mostrar modal para seleccionar curso
      const { value: curso } = await Swal.fire({
        title: 'Crear Usuario',
        html: `
          <p>Alumno: <strong>${matricula.nombreAlumno}</strong></p>
          <p>RUT: ${matricula.rutAlumno}</p>
          <p>Email: ${matricula.correoApoderado}</p>
          <hr style="margin: 15px 0;">
          <p style="color: #666; font-size: 0.9em;">
            Se creará un usuario tipo <strong>Alumno</strong> con acceso al sistema.
            Se enviará un email con las credenciales de acceso.
          </p>
        `,
        input: 'select',
        inputLabel: 'Selecciona el curso',
        inputOptions: this.cursos.reduce((acc, c) => {
          acc[c.codigo] = c.nombre;
          return acc;
        }, {}),
        inputPlaceholder: 'Selecciona un curso',
        showCancelButton: true,
        confirmButtonText: 'Crear Usuario',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
          if (!value) {
            return 'Debes seleccionar un curso';
          }
        }
      });
      if (curso) {
        const confirmed = await Modal.confirm(
          '¿Confirmar creación de usuario?',
          `Se creará usuario para <strong>${matricula.nombreAlumno}</strong> en el curso <strong>${this.getNombreCurso(curso)}</strong>`
        );
        if (confirmed) {
          try {
            const result = await window.useConvertirMatriculaAUsuario().mutate({
              id: matricula.id,
              curso
            });

            // Invalidar caché y recargar lista
            this.matriculas.invalidate();
            await this.matriculas.fetch(true);

            await Swal.fire({
              icon: 'success',
              title: '¡Usuario creado!',
              html: `
                <p>Se ha creado exitosamente el usuario para <strong>${matricula.nombreAlumno}</strong></p>
                <p style="margin-top: 10px;">✉️ Se ha enviado un email con las credenciales de acceso</p>
                ${result?.passwordTemporal ? `<p style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px; font-family: monospace;"><strong>Contraseña temporal:</strong> ${result.passwordTemporal}</p>` : ''}
              `,
              confirmButtonText: 'Entendido'
            });
          } catch (error) {
            console.error('Error al convertir matrícula:', error);
          }
        }
      }
    },
    async verDetalle(matricula) {
      await Swal.fire({
        title: 'Detalle de Matrícula',
        html: `
          <div style="text-align: left; padding: 10px;">
            <p><strong>Nombre Alumno:</strong> ${matricula.nombreAlumno}</p>
            <p><strong>RUT Alumno:</strong> ${matricula.rutAlumno}</p>
            <p><strong>Curso:</strong> ${matricula.curso || '-'}</p>
            <p><strong>Nombre Apoderado:</strong> ${matricula.nombreApoderado || '-'}</p>
            <p><strong>Email Apoderado:</strong> ${matricula.correoApoderado}</p>
            <p><strong>Teléfono Apoderado:</strong> ${matricula.telefonoApoderado || '-'}</p>
            <p><strong>Estado:</strong> <span style="padding: 4px 8px; border-radius: 4px; background: ${this.getEstadoColor(matricula.estado)}; color: white;">${this.getEstadoTexto(matricula.estado)}</span></p>
            <p><strong>Fecha Registro:</strong> ${this.formatDate(matricula.fecha)}</p>
            ${matricula.revisadoPor ? `<p><strong>Revisado por:</strong> ${matricula.revisadoPor}</p>` : ''}
            ${matricula.motivo ? `<p><strong>Motivo:</strong> ${matricula.motivo}</p>` : ''}
            ${matricula.usuarioCreado ? `<p style="color: #4caf50;"><strong>✅ Usuario ya creado</strong></p>` : ''}
          </div>
        `,
        confirmButtonText: 'Cerrar',
        width: '600px'
      });
    },
    // Helpers
    getEstadoColor(estado) {
      return window.Constants.getEstadoColor(estado);
    },
    getEstadoTexto(estado) {
      return window.Constants.getEstadoTexto(estado);
    },
    getNombreCurso(codigo) {
      const curso = this.cursos.find(c => c.codigo === codigo);
      return curso ? curso.nombre : codigo;
    },
    formatDate(dateString) {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    },
    async eliminarMatricula(matricula) {
      const confirmed = await Modal.confirm(
        'Eliminar matrícula',
        `¿Estás seguro de eliminar la solicitud de matrícula de <strong>${matricula.nombreAlumno}</strong>?<br><br>Esta acción no se puede deshacer.`
      );
      if (!confirmed) return;
      try {
        await window.useDeleteMatricula().mutate(matricula.id);

        // Invalidar caché y recargar lista
        this.matriculas.invalidate();
        await this.matriculas.fetch(true);

        await Modal.success('Eliminada', 'La solicitud de matrícula ha sido eliminada');
      } catch (error) {
        console.error('Error al eliminar matrícula:', error);
      }
    },
    limpiarFiltros() {
      this.filtroEstado = '';
      this.busqueda = '';
      this.fechaDesde = '';
      this.fechaHasta = '';
    }
  }));

  console.log('✅ matriculas-app.js registrado en Alpine');
});
