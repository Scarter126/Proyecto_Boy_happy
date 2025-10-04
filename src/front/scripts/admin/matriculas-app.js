// =====================================================
// MATRÍCULAS APP - Alpine.js Component
// Gestión completa de solicitudes de matrícula
// =====================================================

function matriculasApp() {
  return {
    // State
    matriculas: useMatriculas(),
    updateMutation: useUpdateEstadoMatricula(),
    convertirMutation: useConvertirMatriculaAUsuario(),
    filtroEstado: '',
    cursos: [
      { codigo: 'medio-mayor', nombre: 'Medio Mayor' },
      { codigo: 'prekinder-a', nombre: 'Prekínder A' },
      { codigo: 'prekinder-b', nombre: 'Prekínder B' },
      { codigo: 'kinder', nombre: 'Kínder' },
      { codigo: 'extension', nombre: 'Extensión Horaria' }
    ],

    // Lifecycle
    init() {
      if (this.matriculas.init) this.matriculas.init();
    },

    // Computed
    get matriculasFiltradas() {
      if (!this.matriculas.data) return [];

      const items = this.matriculas.data.matriculas || this.matriculas.data;

      if (!this.filtroEstado) return items;

      return items.filter(m => m.estado === this.filtroEstado);
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
        `¿Deseas aprobar la matrícula de <strong>${matricula.nombre}</strong>?`
      );

      if (!confirmed) return;

      const result = await this.updateMutation.mutate({
        id: matricula.id,
        estado: 'aprobada',
        revisadoPor: 'Admin'
      });

      if (result.success) {
        await Modal.success('¡Aprobada!', 'Se ha enviado un email de confirmación al apoderado');
        await this.matriculas.refetch();
      }
    },

    async rechazarMatricula(matricula) {
      const { value: motivo } = await Swal.fire({
        title: 'Rechazar matrícula',
        html: `<p>Solicitud de: <strong>${matricula.nombre}</strong></p>`,
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
        const result = await this.updateMutation.mutate({
          id: matricula.id,
          estado: 'rechazada',
          motivo,
          revisadoPor: 'Admin'
        });

        if (result.success) {
          await Modal.success('Rechazada', 'Se ha enviado un email al apoderado con el motivo');
          await this.matriculas.refetch();
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
          <p>Alumno: <strong>${matricula.nombre}</strong></p>
          <p>RUT: ${matricula.rut}</p>
          <p>Email: ${matricula.correo}</p>
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
          `Se creará usuario para <strong>${matricula.nombre}</strong> en el curso <strong>${this.getNombreCurso(curso)}</strong>`
        );

        if (confirmed) {
          const result = await this.convertirMutation.mutate({
            id: matricula.id,
            curso
          });

          if (result.success) {
            await Swal.fire({
              icon: 'success',
              title: '¡Usuario creado!',
              html: `
                <p>Se ha creado exitosamente el usuario para <strong>${matricula.nombre}</strong></p>
                <p style="margin-top: 10px;">✉️ Se ha enviado un email con las credenciales de acceso</p>
                ${result.data?.passwordTemporal ? `<p style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px; font-family: monospace;"><strong>Contraseña temporal:</strong> ${result.data.passwordTemporal}</p>` : ''}
              `,
              confirmButtonText: 'Entendido'
            });

            await this.matriculas.refetch();
          }
        }
      }
    },

    async verDetalle(matricula) {
      await Swal.fire({
        title: 'Detalle de Matrícula',
        html: `
          <div style="text-align: left; padding: 10px;">
            <p><strong>Nombre:</strong> ${matricula.nombre}</p>
            <p><strong>RUT:</strong> ${matricula.rut}</p>
            <p><strong>Fecha Nacimiento:</strong> ${matricula.fechaNacimiento || '-'}</p>
            <p><strong>Último Curso:</strong> ${matricula.ultimoCurso || '-'}</p>
            <p><strong>Email:</strong> ${matricula.correo}</p>
            <p><strong>Teléfono:</strong> ${matricula.telefono || '-'}</p>
            <p><strong>Estado:</strong> <span style="padding: 4px 8px; border-radius: 4px; background: ${this.getEstadoColor(matricula.estado)}; color: white;">${this.getEstadoTexto(matricula.estado)}</span></p>
            <p><strong>Fecha Registro:</strong> ${this.formatDate(matricula.fechaRegistro)}</p>
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
      const colores = {
        'pendiente': '#ff9800',
        'aprobada': '#4caf50',
        'rechazada': '#f44336'
      };
      return colores[estado] || '#999';
    },

    getEstadoTexto(estado) {
      const textos = {
        'pendiente': 'Pendiente',
        'aprobada': 'Aprobada',
        'rechazada': 'Rechazada'
      };
      return textos[estado] || estado;
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
    }
  };
}
