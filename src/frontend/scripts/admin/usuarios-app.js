/**
 * Usuarios App - Alpine.js Component
 * Gestión completa de usuarios con CRUD, cambio de roles y activación/desactivación
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('usuariosApp', () => ({
    // Estado
    usuarioEditando: null,
    usuarios: window.useUsuarios(),
    matriculas: window.useMatriculas(),
    filtros: {
      rol: '',
      estado: '',
      busqueda: ''
    },
    cursos: [
      { codigo: 'medio-mayor', nombre: 'Medio Mayor' },
      { codigo: 'prekinder-a', nombre: 'Prekínder A' },
      { codigo: 'prekinder-b', nombre: 'Prekínder B' },
      { codigo: 'kinder', nombre: 'Kínder' },
      { codigo: 'extension', nombre: 'Extensión Horaria' }
    ],

    // Lifecycle
    async init() {
      await this.usuarios.init();
      await this.matriculas.init();
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
        'alumno': 'Alumno'
      };
      return roles[rol] || rol;
    },
    getRolColor(rol) {
      const colors = {
        'admin': '#e91e63',
        'profesor': '#667eea',
        'fono': '#4facfe',
        'alumno': '#059669'
      };
      return colors[rol] || '#999';
    },
    // Helper: Verificar si un usuario tiene matrícula pendiente
    tieneMatriculaPendiente(usuario) {
      const matriculas = this.matriculas.data?.matriculas || this.matriculas.data;
      if (!matriculas) return false;
      return matriculas.some(m => m.rut === usuario.rut && m.estado === 'pendiente');
    },
    // Aprobar matrícula directamente desde la tabla
    async aprobarMatricula(usuario) {
      const matriculas = this.matriculas.data?.matriculas || this.matriculas.data;
      const matricula = matriculas?.find(m => m.rut === usuario.rut && m.estado === 'pendiente');
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
          await window.useUpdateUsuario().mutate({
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
          await this.matriculas.refetch();
        } catch (error) {
          Notify.error('Error al aprobar la matrícula');
          console.error(error);
        }
      }
    },
    // Validaciones reutilizables
    validarRUT(rut) {
      return /^\d{7,8}-[\dkK]$/.test(rut);
    },
    validarEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    // CRUD Operations
    async crearUsuario() {
      const { value: formValues } = await Swal.fire({
        title: 'Crear Nuevo Usuario',
        html: `
          <div style="text-align: left; max-width: 600px; margin: 0 auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">RUT *</label>
                <input id="swal-rut" class="swal2-input" placeholder="12345678-9" style="width: 100%; margin: 0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Nombre *</label>
                <input id="swal-nombre" class="swal2-input" placeholder="Nombre" style="width: 100%; margin: 0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Apellido *</label>
                <input id="swal-apellido" class="swal2-input" placeholder="Apellido" style="width: 100%; margin: 0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Email *</label>
                <input id="swal-correo" class="swal2-input" type="email" placeholder="correo@ejemplo.com" style="width: 100%; margin: 0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Teléfono</label>
                <input id="swal-telefono" class="swal2-input" placeholder="+56 9 1234 5678" style="width: 100%; margin: 0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Rol *</label>
                <select id="swal-rol" class="swal2-input" style="width: 100%; margin: 0;">
                  <option value="">Seleccione un rol</option>
                  <option value="profesor">Profesor/Docente</option>
                  <option value="fono">Fonoaudiólogo/a</option>
                  <option value="alumno">Alumno/Apoderado</option>
                </select>
              </div>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Crear Usuario',
        cancelButtonText: 'Cancelar',
        width: '700px',
        preConfirm: () => {
          const rutRaw = document.getElementById('swal-rut').value;
          const nombre = document.getElementById('swal-nombre').value;
          const apellido = document.getElementById('swal-apellido').value;
          const correo = document.getElementById('swal-correo').value;
          const telefono = document.getElementById('swal-telefono').value;
          const rol = document.getElementById('swal-rol').value;

          // Validaciones
          if (!rutRaw || !nombre || !apellido || !correo || !rol) {
            Swal.showValidationMessage('Por favor completa todos los campos obligatorios (*)');
            return false;
          }

          // Validar RUT usando la función de helpers
          if (!window.Helpers || !window.Helpers.validateRut) {
            Swal.showValidationMessage('Error: Sistema de validación no disponible. Recarga la página.');
            console.error('window.Helpers no está disponible');
            return false;
          }

          if (!window.Helpers.validateRut(rutRaw)) {
            Swal.showValidationMessage('❌ RUT inválido. El dígito verificador no corresponde. Ejemplo de RUT válido: 12.345.678-5');
            return false;
          }

          // Formatear RUT al formato esperado por el backend (12345678-9)
          const rut = window.Helpers.formatRut(rutRaw);

          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            Swal.showValidationMessage('Formato de email inválido');
            return false;
          }

          return {
            rut,
            nombre,
            apellido,
            correo,
            telefono,
            rol
          };
        }
      });

      if (formValues) {
        // CREAR usuario - Generar contraseña temporal que cumpla política de Cognito
        // Debe tener: mayúsculas, minúsculas, números (mínimo 8 caracteres)
        const generarPassword = () => {
          const mayusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          const minusculas = 'abcdefghijklmnopqrstuvwxyz';
          const numeros = '0123456789';
          const todos = mayusculas + minusculas + numeros;

          let password = '';
          // Asegurar al menos 1 mayúscula, 1 minúscula, 1 número
          password += mayusculas[Math.floor(Math.random() * mayusculas.length)];
          password += minusculas[Math.floor(Math.random() * minusculas.length)];
          password += numeros[Math.floor(Math.random() * numeros.length)];

          // Completar hasta 10 caracteres con caracteres aleatorios
          for (let i = 0; i < 7; i++) {
            password += todos[Math.floor(Math.random() * todos.length)];
          }

          // Mezclar los caracteres
          return password.split('').sort(() => Math.random() - 0.5).join('');
        };

        const passwordTemporal = generarPassword();

        try {
          await window.useCreateUsuario().mutate({
            rut: formValues.rut,
            nombre: formValues.nombre,
            apellido: formValues.apellido,
            correo: formValues.correo,
            telefono: formValues.telefono,
            rol: formValues.rol,
            activo: true,
            passwordTemporal
          });

          // Invalidar caché y forzar recarga de la lista
          this.usuarios.invalidate();
          await this.usuarios.fetch(true); // force = true para ignorar caché

          await Swal.fire({
            icon: 'success',
            title: '✅ Usuario creado exitosamente',
            html: `
              <div style="text-align: left; padding: 20px;">
                <p><strong>Nombre:</strong> ${formValues.nombre} ${formValues.apellido}</p>
                <p><strong>RUT:</strong> ${formValues.rut}</p>
                <p><strong>Email:</strong> ${formValues.correo}</p>
                <p><strong>Rol:</strong> ${this.getRolLabel(formValues.rol)}</p>
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
        } catch (error) {
          console.error('Error al crear usuario:', error);
          // El error ya fue mostrado por useMutation, no necesitamos hacer nada más
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
                <input id="swal-rut" class="swal2-input" value="${usuario.rut}" disabled style="width: 100%; margin: 0; background: #f0f0f0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Nombre *</label>
                <input id="swal-nombre" class="swal2-input" value="${usuario.nombre}" style="width: 100%; margin: 0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Apellido</label>
                <input id="swal-apellido" class="swal2-input" value="${usuario.apellido || ''}" style="width: 100%; margin: 0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Email *</label>
                <input id="swal-correo" class="swal2-input" type="email" value="${usuario.correo}" style="width: 100%; margin: 0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Teléfono</label>
                <input id="swal-telefono" class="swal2-input" value="${usuario.telefono || ''}" style="width: 100%; margin: 0;">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Rol *</label>
                <select id="swal-rol" class="swal2-input" style="width: 100%; margin: 0;">
                  <option value="profesor" ${usuario.rol === 'profesor' ? 'selected' : ''}>Profesor/Docente</option>
                  <option value="fono" ${usuario.rol === 'fono' ? 'selected' : ''}>Fonoaudiólogo/a</option>
                  <option value="alumno" ${usuario.rol === 'alumno' ? 'selected' : ''}>Alumno/Apoderado</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Curso</label>
                <select id="swal-curso" class="swal2-input" style="width: 100%; margin: 0;">
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
                <select id="swal-activo" class="swal2-input" style="width: 100%; margin: 0;">
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
        try {
          await window.useUpdateUsuario().mutate({
            rut: usuario.rut,
            nombre: formValues.nombre,
            apellido: formValues.apellido,
            correo: formValues.correo,
            telefono: formValues.telefono,
            rol: formValues.rol,
            curso: formValues.curso,
            activo: formValues.activo
          });

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
          }

          // Invalidar caché y recargar lista
          this.usuarios.invalidate();
          await this.usuarios.fetch(true);
        } catch (error) {
          console.error('Error al editar usuario:', error);
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
          try {
            await window.useCambiarRol().mutate({
              rut: usuario.rut,
              nuevoRol
            });

            // Invalidar caché y recargar lista
            this.usuarios.invalidate();
            await this.usuarios.fetch(true);
          } catch (error) {
            console.error('Error al cambiar rol:', error);
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
        try {
          await window.useUpdateUsuario().mutate({
            rut: usuario.rut,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            correo: usuario.correo,
            telefono: usuario.telefono,
            rol: usuario.rol,
            activo: nuevoEstado
          });

          // Invalidar caché y recargar lista
          this.usuarios.invalidate();
          await this.usuarios.fetch(true);
        } catch (error) {
          console.error('Error al cambiar estado del usuario:', error);
        }
      }
    }
  }));

  console.log('✅ usuarios-app.js registrado en Alpine');
});
