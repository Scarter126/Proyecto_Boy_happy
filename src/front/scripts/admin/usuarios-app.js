/**
 * Usuarios App - Alpine.js Component
 * Gestión completa de usuarios con CRUD, cambio de roles y activación/desactivación
 */
function usuariosApp() {
  return {
    // Estado
    mostrarFormulario: false,
    usuarioEditando: null,
    filtros: {
      rol: '',
      estado: '',
      busqueda: ''
    },
    nuevoUsuario: {
      rut: '',
      nombre: '',
      apellido: '',
      correo: '',
      telefono: '',
      rol: '',
      activo: true
    },
    cursos: [
      { codigo: 'medio-mayor', nombre: 'Medio Mayor' },
      { codigo: 'prekinder-a', nombre: 'Prekínder A' },
      { codigo: 'prekinder-b', nombre: 'Prekínder B' },
      { codigo: 'kinder', nombre: 'Kínder' },
      { codigo: 'extension', nombre: 'Extensión Horaria' }
    ],

    // Hooks reutilizables
    usuarios: useUsuarios(),
    matriculasPendientes: useMatriculas({ estado: 'pendiente' }),
    crearMutation: useCreateUsuario(),
    updateMutation: useUpdateUsuario(),
    deleteMutation: useDeleteUsuario(),
    cambiarRolMutation: useCambiarRol(),

    // Lifecycle
    async init() {
      // Inicializar hooks primero
      if (this.usuarios.init) await this.usuarios.init();
      if (this.matriculasPendientes.init) await this.matriculasPendientes.init();

      // Luego cargar datos
      await this.cargarDatos();
    },

    async cargarDatos() {
      await this.usuarios.fetch();
    },

    // Computed: Usuarios filtrados
    get usuariosFiltrados() {
      if (!this.usuarios.data) return [];

      return this.usuarios.data.filter(u => {
        // No mostrar admins
        if (u.rol?.toLowerCase() === 'admin') return false;

        // Filtro por rol (case-insensitive, mapear apoderado -> alumno)
        if (this.filtros.rol) {
          const rolUsuario = u.rol?.toLowerCase();
          const rolFiltro = this.filtros.rol.toLowerCase();

          // Mapear "apoderado" a "alumno" para compatibilidad
          const rolNormalizado = rolUsuario === 'apoderado' ? 'alumno' : rolUsuario;

          if (rolNormalizado !== rolFiltro) return false;
        }

        // Filtro por estado
        if (this.filtros.estado === 'activo' && u.activo === false) return false;
        if (this.filtros.estado === 'inactivo' && u.activo !== false) return false;

        // Filtro por búsqueda (nombre, rut, correo)
        if (this.filtros.busqueda) {
          const busqueda = this.filtros.busqueda.toLowerCase();
          const coincide =
            u.nombre?.toLowerCase().includes(busqueda) ||
            u.apellido?.toLowerCase().includes(busqueda) ||
            u.rut?.toLowerCase().includes(busqueda) ||
            u.correo?.toLowerCase().includes(busqueda);
          if (!coincide) return false;
        }

        return true;
      });
    },

    // Helpers reutilizables
    getRolLabel(rol) {
      const roles = {
        'admin': 'Administrador',
        'profesor': 'Profesor',
        'fono': 'Fonoaudiólogo',
        'alumno': 'Apoderado'
      };
      return roles[rol] || rol;
    },

    getRolColor(rol) {
      const colors = {
        'admin': '#e91e63',
        'profesor': '#667eea',
        'fono': '#4facfe',
        'alumno': '#43e97b'
      };
      return colors[rol] || '#999';
    },

    // Helper: Verificar si un usuario tiene matrícula pendiente
    tieneMatriculaPendiente(usuario) {
      if (!this.matriculasPendientes.data) return false;
      return this.matriculasPendientes.data.some(m => m.rut === usuario.rut);
    },

    // Aprobar matrícula directamente desde la tabla
    async aprobarMatricula(usuario) {
      const matricula = this.matriculasPendientes.data?.find(m => m.rut === usuario.rut);
      if (!matricula) {
        Notify.error('No se encontró la matrícula pendiente');
        return;
      }

      const { value: curso } = await Swal.fire({
        title: `Aprobar Matrícula: ${usuario.nombre} ${usuario.apellido || ''}`,
        html: `
          <div style="text-align: left;">
            <p style="margin-bottom: 15px;">Selecciona el curso para este alumno:</p>
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Curso *</label>
            <select id="swal-curso-aprobacion" class="swal2-input" style="width: 100%;">
              <option value="">Selecciona un curso</option>
              <option value="medio-mayor">Medio Mayor</option>
              <option value="prekinder-a">Prekínder A</option>
              <option value="prekinder-b">Prekínder B</option>
              <option value="kinder">Kínder</option>
              <option value="extension">Extensión Horaria</option>
            </select>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Aprobar Matrícula',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const curso = document.getElementById('swal-curso-aprobacion').value;
          if (!curso) {
            Swal.showValidationMessage('Debes seleccionar un curso');
          }
          return curso;
        }
      });

      if (curso) {
        try {
          // Actualizar matrícula
          await window.apiClient.put(`/matriculas/${matricula.rut}`, {
            ...matricula,
            estado: 'aprobada',
            curso: curso
          });

          // Actualizar usuario con el curso
          await this.updateMutation.mutate({
            rut: usuario.rut,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            correo: usuario.correo,
            telefono: usuario.telefono,
            rol: usuario.rol,
            curso: curso,
            activo: usuario.activo
          });

          Notify.success('Matrícula aprobada y usuario actualizado');
          await this.usuarios.refetch();
          await this.matriculasPendientes.refetch();
        } catch (error) {
          Notify.error('Error al aprobar la matrícula');
          console.error(error);
        }
      }
    },

    // Formulario
    cancelarFormulario() {
      this.mostrarFormulario = false;
      this.usuarioEditando = null;
      this.nuevoUsuario = {
        rut: '',
        nombre: '',
        apellido: '',
        correo: '',
        telefono: '',
        rol: '',
        activo: true
      };
    },

    // Validaciones reutilizables
    validarRUT(rut) {
      return /^\d{7,8}-[\dkK]$/.test(rut);
    },

    validarEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // CRUD Operations
    async guardarUsuario() {
      const { rut, nombre, apellido, correo, telefono, rol, activo } = this.nuevoUsuario;

      // Validaciones
      if (!rut || !nombre || !apellido || !correo || !rol) {
        Notify.error('Por favor completa todos los campos obligatorios (*)');
        return;
      }

      if (!this.validarRUT(rut)) {
        Notify.error('Formato de RUT inválido. Ejemplo: 12345678-9');
        return;
      }

      if (!this.validarEmail(correo)) {
        Notify.error('Formato de email inválido');
        return;
      }

      if (this.usuarioEditando) {
        // EDITAR
        const result = await this.updateMutation.mutate({
          rut, nombre, apellido, correo, telefono, rol, activo
        });

        if (result.success) {
          Notify.success('Usuario actualizado correctamente');
          this.cancelarFormulario();
          await this.usuarios.refetch();
        }
      } else {
        // CREAR
        const passwordTemporal = Math.random().toString(36).slice(-8).toUpperCase();

        const result = await this.crearMutation.mutate({
          rut, nombre, apellido, correo, telefono, rol,
          activo: true,
          passwordTemporal
        });

        if (result.success) {
          await Swal.fire({
            icon: 'success',
            title: '✅ Usuario creado exitosamente',
            html: `
              <div style="text-align: left; padding: 20px;">
                <p><strong>Nombre:</strong> ${nombre} ${apellido}</p>
                <p><strong>RUT:</strong> ${rut}</p>
                <p><strong>Email:</strong> ${correo}</p>
                <p><strong>Rol:</strong> ${this.getRolLabel(rol)}</p>
                <hr>
                <p style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px;">
                  <strong>🔑 Contraseña temporal:</strong><br>
                  <code style="font-size: 1.3em; color: #e91e63; font-weight: bold;">${passwordTemporal}</code>
                </p>
                <p style="color: #999; font-size: 0.9em; margin-top: 10px;">
                  ⚠️ <strong>IMPORTANTE:</strong> Guarda esta contraseña. El usuario debe cambiarla en su primer inicio de sesión.
                </p>
              </div>
            `,
            confirmButtonText: 'Entendido',
            width: '600px'
          });
          this.cancelarFormulario();
          await this.usuarios.refetch();
        }
      }
    },

    async editarUsuario(usuario) {
      if (usuario.rol === 'admin') {
        Notify.warning('Los usuarios administradores no se pueden editar desde la interfaz');
        return;
      }

      // Obtener matrícula si existe
      let matriculaInfo = null;
      try {
        const matriculasResponse = await window.apiClient.get(`/matriculas?rut=${usuario.rut}`);
        if (matriculasResponse && matriculasResponse.length > 0) {
          matriculaInfo = matriculasResponse[0];
        }
      } catch (error) {
        console.log('No se encontró matrícula para este usuario');
      }

      const { value: formValues } = await Swal.fire({
        title: `Editar Usuario: ${usuario.nombre} ${usuario.apellido || ''}`,
        html: `
          <div style="text-align: left; max-width: 600px; margin: 0 auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">RUT</label>
                <input id="swal-rut" class="swal2-input" value="${usuario.rut}" disabled style="width: 100%; background: #f0f0f0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Nombre *</label>
                <input id="swal-nombre" class="swal2-input" value="${usuario.nombre}" style="width: 100%;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Apellido</label>
                <input id="swal-apellido" class="swal2-input" value="${usuario.apellido || ''}" style="width: 100%;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Email *</label>
                <input id="swal-correo" class="swal2-input" type="email" value="${usuario.correo}" style="width: 100%;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Teléfono</label>
                <input id="swal-telefono" class="swal2-input" value="${usuario.telefono || ''}" style="width: 100%;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Rol *</label>
                <select id="swal-rol" class="swal2-input" style="width: 100%;">
                  <option value="profesor" ${usuario.rol === 'profesor' ? 'selected' : ''}>Profesor/Docente</option>
                  <option value="fono" ${usuario.rol === 'fono' ? 'selected' : ''}>Fonoaudiólogo/a</option>
                  <option value="alumno" ${usuario.rol === 'alumno' ? 'selected' : ''}>Alumno/Apoderado</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Curso</label>
                <select id="swal-curso" class="swal2-input" style="width: 100%;">
                  <option value="">Sin curso asignado</option>
                  <option value="medio-mayor" ${usuario.curso === 'medio-mayor' ? 'selected' : ''}>Medio Mayor</option>
                  <option value="prekinder-a" ${usuario.curso === 'prekinder-a' ? 'selected' : ''}>Prekínder A</option>
                  <option value="prekinder-b" ${usuario.curso === 'prekinder-b' ? 'selected' : ''}>Prekínder B</option>
                  <option value="kinder" ${usuario.curso === 'kinder' ? 'selected' : ''}>Kínder</option>
                  <option value="extension" ${usuario.curso === 'extension' ? 'selected' : ''}>Extensión Horaria</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Estado</label>
                <select id="swal-activo" class="swal2-input" style="width: 100%;">
                  <option value="true" ${usuario.activo !== false ? 'selected' : ''}>Activo</option>
                  <option value="false" ${usuario.activo === false ? 'selected' : ''}>Inactivo</option>
                </select>
              </div>
            </div>
            ${matriculaInfo && matriculaInfo.estado === 'pendiente' ? `
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <p style="margin: 0 0 10px 0;"><strong>⚠️ Matrícula Pendiente</strong></p>
                <p style="margin: 0; font-size: 0.9em;">Este usuario tiene una solicitud de matrícula pendiente.</p>
                <label style="display: flex; align-items: center; margin-top: 10px; cursor: pointer;">
                  <input type="checkbox" id="swal-aprobar-matricula" style="margin-right: 8px;">
                  <span>Aprobar matrícula al guardar</span>
                </label>
              </div>
            ` : ''}
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        cancelButtonText: 'Cancelar',
        width: '700px',
        preConfirm: () => {
          return {
            nombre: document.getElementById('swal-nombre').value,
            apellido: document.getElementById('swal-apellido').value,
            correo: document.getElementById('swal-correo').value,
            telefono: document.getElementById('swal-telefono').value,
            rol: document.getElementById('swal-rol').value,
            curso: document.getElementById('swal-curso').value || null,
            activo: document.getElementById('swal-activo').value === 'true',
            aprobarMatricula: document.getElementById('swal-aprobar-matricula')?.checked || false
          };
        }
      });

      if (formValues) {
        // Validaciones
        if (!formValues.nombre || !formValues.correo || !formValues.rol) {
          Notify.error('Por favor completa todos los campos obligatorios (*)');
          return;
        }

        if (!this.validarEmail(formValues.correo)) {
          Notify.error('Formato de email inválido');
          return;
        }

        // Actualizar usuario
        const result = await this.updateMutation.mutate({
          rut: usuario.rut,
          nombre: formValues.nombre,
          apellido: formValues.apellido,
          correo: formValues.correo,
          telefono: formValues.telefono,
          rol: formValues.rol,
          curso: formValues.curso,
          activo: formValues.activo
        });

        if (result.success) {
          // Si se aprobó la matrícula, actualizarla
          if (formValues.aprobarMatricula && matriculaInfo) {
            try {
              await window.apiClient.put(`/matriculas/${matriculaInfo.rut}`, {
                ...matriculaInfo,
                estado: 'aprobada',
                curso: formValues.curso || matriculaInfo.curso
              });
              Notify.success('Usuario actualizado y matrícula aprobada');
            } catch (error) {
              Notify.warning('Usuario actualizado pero hubo un error al aprobar la matrícula');
            }
          } else {
            Notify.success('Usuario actualizado correctamente');
          }

          await this.usuarios.refetch();
        }
      }
    },

    async cambiarRol(usuario) {
      if (usuario.rol === 'admin') {
        Notify.warning('Los usuarios administradores no se pueden modificar desde la interfaz');
        return;
      }

      const rolesDisponibles = {
        'profesor': 'Profesor/Docente',
        'fono': 'Fonoaudiólogo/a',
        'alumno': 'Alumno/Apoderado'
      };

      delete rolesDisponibles[usuario.rol];

      const { value: nuevoRol } = await Swal.fire({
        title: `Cambiar rol de ${usuario.nombre} ${usuario.apellido || ''}`,
        html: `Rol actual: <strong>${this.getRolLabel(usuario.rol)}</strong>`,
        input: 'select',
        inputOptions: rolesDisponibles,
        inputPlaceholder: 'Selecciona el nuevo rol',
        showCancelButton: true,
        confirmButtonText: 'Cambiar Rol',
        cancelButtonText: 'Cancelar'
      });

      if (nuevoRol) {
        const confirmed = await Swal.fire({
          title: '¿Confirmar cambio de rol?',
          html: `
            <p><strong>Usuario:</strong> ${usuario.nombre} ${usuario.apellido || ''}</p>
            <p><strong>Cambio:</strong> ${this.getRolLabel(usuario.rol)} → ${this.getRolLabel(nuevoRol)}</p>
            <p style="color: #ff9800; margin-top: 15px;">
              ⚠️ Este cambio afectará los permisos y accesos del usuario.
            </p>
          `,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, cambiar',
          cancelButtonText: 'Cancelar'
        });

        if (confirmed.isConfirmed) {
          const result = await this.cambiarRolMutation.mutate({
            rut: usuario.rut,
            nuevoRol
          });

          if (result.success) {
            await this.usuarios.refetch();
            Notify.success(`Rol actualizado: ${this.getRolLabel(usuario.rol)} → ${this.getRolLabel(nuevoRol)}`);
          }
        }
      }
    },

    async toggleEstadoUsuario(usuario) {
      if (usuario.rol === 'admin') {
        Notify.warning('Los usuarios administradores no se pueden desactivar desde la interfaz');
        return;
      }

      const nuevoEstado = !usuario.activo;
      const accion = nuevoEstado ? 'activar' : 'desactivar';

      const confirmed = await Swal.fire({
        title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} usuario?`,
        html: `
          <p><strong>Usuario:</strong> ${usuario.nombre} ${usuario.apellido || ''}</p>
          <p><strong>RUT:</strong> ${usuario.rut}</p>
          <p><strong>Acción:</strong> ${nuevoEstado ? '✅ Activar' : '❌ Desactivar'}</p>
          ${!nuevoEstado ? '<p style="color: #f44336; margin-top: 15px;">⚠️ El usuario no podrá acceder al sistema.</p>' : ''}
        `,
        icon: nuevoEstado ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonText: nuevoEstado ? 'Activar' : 'Desactivar',
        cancelButtonText: 'Cancelar'
      });

      if (confirmed.isConfirmed) {
        const result = await this.updateMutation.mutate({
          rut: usuario.rut,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          correo: usuario.correo,
          telefono: usuario.telefono,
          rol: usuario.rol,
          activo: nuevoEstado
        });

        if (result.success) {
          await this.usuarios.refetch();
          Notify.success(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`);
        }
      }
    },

  };
}

window.usuariosApp = usuariosApp;
