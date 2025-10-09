/**
 * Configuración App - Alpine.js Component
 * Gestión de configuración del sistema: cursos, asignaturas, categorías
 *
 * REFACTORIZADO: Usa hooks reactivos (useQuery, useMutation)
 */

document.addEventListener('alpine:init', () => {
  // Componente para manejar información general del jardín
  Alpine.data('informacionGeneralData', () => ({
    loading: true,
    guardando: false,
    info: {
      nombre: 'Boy Happy',
      direccion: '',
      telefono: '',
      email: '',
      anoEscolar: new Date().getFullYear()
    },

    async init() {
      await this.cargarInformacion();
    },

    async cargarInformacion() {
      this.loading = true;
      try {
        const response = await apiRequest('/configuracion?key=informacion-general', {
          method: 'GET'
        });

        if (response && response.id) {
          this.info = {
            nombre: response.nombre || 'Boy Happy',
            direccion: response.direccion || '',
            telefono: response.telefono || '',
            email: response.email || '',
            anoEscolar: response.anoEscolar || new Date().getFullYear()
          };
        }
      } catch (error) {
        console.error('Error cargando información general:', error);
      } finally {
        this.loading = false;
      }
    },

    async guardarInformacion() {
      this.guardando = true;
      try {
        await apiRequest('/configuracion', {
          method: 'PUT',
          body: JSON.stringify({
            key: 'informacion-general',
            ...this.info
          })
        });

        Notify.success('Información guardada correctamente');
      } catch (error) {
        console.error('Error guardando información:', error);
        Notify.error('Error al guardar la información');
      } finally {
        this.guardando = false;
      }
    }
  }));

  Alpine.data('configuracionApp', () => ({
    // Estado
    loading: true,
    activeTab: 'general',

    // Hooks reactivos
    cursosQuery: null,
    asignaturasQuery: null,
    categoriasQuery: null,
    updateConfigMutation: null,
    createCategoriaMutation: null,
    updateCategoriaMutation: null,
    deleteCategoriaMutation: null,

    // Lifecycle
    async init() {
      // Inicializar hooks
      this.cursosQuery = useConfiguracion('cursos');
      this.asignaturasQuery = useConfiguracion('asignaturas');
      this.categoriasQuery = useCategorias();

      this.updateConfigMutation = useUpdateConfiguracion();
      this.createCategoriaMutation = useCreateCategoria();
      this.updateCategoriaMutation = useUpdateCategoria();
      this.deleteCategoriaMutation = useDeleteCategoria();

      // Cargar datos iniciales
      await this.cargarDatos();
    },

    // Cargar todos los datos
    async cargarDatos() {
      this.loading = true;
      try {
        await Promise.all([
          this.cursosQuery.init(),
          this.asignaturasQuery.init(),
          this.categoriasQuery.init()
        ]);
      } catch (error) {
        console.error('Error cargando configuración:', error);
        Notify.error('Error al cargar la configuración');
      } finally {
        this.loading = false;
      }
    },

    // Computed: Datos desde los hooks
    get cursos() {
      return this.cursosQuery?.data?.cursosNombres || [];
    },

    get asignaturas() {
      return this.asignaturasQuery?.data?.asignaturas || [];
    },

    get categorias() {
      return this.categoriasQuery?.data?.categorias || this.categoriasQuery?.data || [];
    },

    get isLoadingData() {
      return this.cursosQuery?.loading || this.asignaturasQuery?.loading || this.categoriasQuery?.loading;
    },

    // Cambiar tab
    cambiarTab(tab) {
      this.activeTab = tab;
    },

    // Agregar curso
    async agregarCurso() {
      const { value: formValues } = await Swal.fire({
        title: 'Agregar Nuevo Curso',
        html: `
          <div style="text-align: left;">
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Nombre del Curso</label>
              <input id="nombreCurso" class="swal2-input" placeholder="Ej: Prekínder C" style="width: 100%;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Código del Curso</label>
              <input id="codigoCurso" class="swal2-input" placeholder="Ej: prekinder-c" style="width: 100%;">
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Agregar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const nombre = document.getElementById('nombreCurso').value;
          const codigo = document.getElementById('codigoCurso').value;

          if (!nombre || !codigo) {
            Swal.showValidationMessage('Todos los campos son requeridos');
            return false;
          }

          return { nombre, codigo };
        }
      });

      if (formValues) {
        try {
          await this.updateConfigMutation.mutate({
            key: 'cursos',
            action: 'add',
            curso: formValues
          });
          await this.cursosQuery.refetch();
        } catch (error) {
          console.error('Error agregando curso:', error);
        }
      }
    },

    // Eliminar curso
    async eliminarCurso(curso) {
      const result = await Swal.fire({
        title: '¿Eliminar curso?',
        text: `Se eliminará el curso "${curso.nombre}"`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        try {
          await this.updateConfigMutation.mutate({
            key: 'cursos',
            action: 'remove',
            codigo: curso.codigo
          });
          await this.cursosQuery.refetch();
        } catch (error) {
          console.error('Error eliminando curso:', error);
        }
      }
    },

    // Agregar asignatura
    async agregarAsignatura() {
      const { value: nombre } = await Swal.fire({
        title: 'Agregar Nueva Asignatura',
        input: 'text',
        inputLabel: 'Nombre de la asignatura',
        inputPlaceholder: 'Ej: Lenguaje Verbal',
        showCancelButton: true,
        confirmButtonText: 'Agregar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
          if (!value) {
            return 'Debes ingresar un nombre';
          }
        }
      });

      if (nombre) {
        try {
          await this.updateConfigMutation.mutate({
            key: 'asignaturas',
            action: 'add',
            asignatura: nombre
          });
          await this.asignaturasQuery.refetch();
        } catch (error) {
          console.error('Error agregando asignatura:', error);
        }
      }
    },

    // Eliminar asignatura
    async eliminarAsignatura(asignatura) {
      const result = await Swal.fire({
        title: '¿Eliminar asignatura?',
        text: `Se eliminará la asignatura "${asignatura}"`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        try {
          await this.updateConfigMutation.mutate({
            key: 'asignaturas',
            action: 'remove',
            asignatura: asignatura
          });
          await this.asignaturasQuery.refetch();
        } catch (error) {
          console.error('Error eliminando asignatura:', error);
        }
      }
    },

    // Agregar categoría
    async agregarCategoria() {
      const { value: formValues } = await Swal.fire({
        title: 'Nueva Categoría de Material',
        html: `
          <div style="text-align: left;">
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Nombre</label>
              <input id="nombreCategoria" class="swal2-input" placeholder="Ej: Guías de Trabajo" style="width: 100%;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Descripción</label>
              <textarea id="descripcionCategoria" class="swal2-textarea" placeholder="Descripción de la categoría" style="width: 100%;"></textarea>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Color (Hex)</label>
              <input id="colorCategoria" type="color" class="swal2-input" value="#667eea" style="width: 100%; height: 50px;">
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Crear',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const nombre = document.getElementById('nombreCategoria').value;
          const descripcion = document.getElementById('descripcionCategoria').value;
          const color = document.getElementById('colorCategoria').value;

          if (!nombre) {
            Swal.showValidationMessage('El nombre es requerido');
            return false;
          }

          return { nombre, descripcion, color };
        }
      });

      if (formValues) {
        try {
          await this.createCategoriaMutation.mutate(formValues);
          await this.categoriasQuery.refetch();
        } catch (error) {
          console.error('Error creando categoría:', error);
        }
      }
    },

    // Editar categoría
    async editarCategoria(categoria) {
      const { value: formValues } = await Swal.fire({
        title: 'Editar Categoría',
        html: `
          <div style="text-align: left;">
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Nombre</label>
              <input id="nombreCategoria" class="swal2-input" value="${categoria.nombre}" style="width: 100%;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Descripción</label>
              <textarea id="descripcionCategoria" class="swal2-textarea" style="width: 100%;">${categoria.descripcion || ''}</textarea>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Color (Hex)</label>
              <input id="colorCategoria" type="color" class="swal2-input" value="${categoria.color || '#667eea'}" style="width: 100%; height: 50px;">
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const nombre = document.getElementById('nombreCategoria').value;
          const descripcion = document.getElementById('descripcionCategoria').value;
          const color = document.getElementById('colorCategoria').value;

          if (!nombre) {
            Swal.showValidationMessage('El nombre es requerido');
            return false;
          }

          return { nombre, descripcion, color };
        }
      });

      if (formValues) {
        try {
          await this.updateCategoriaMutation.mutate({
            id: categoria.id,
            ...formValues
          });
          await this.categoriasQuery.refetch();
        } catch (error) {
          console.error('Error actualizando categoría:', error);
        }
      }
    },

    // Eliminar categoría
    async eliminarCategoria(categoria) {
      const result = await Swal.fire({
        title: '¿Eliminar categoría?',
        text: `Se eliminará la categoría "${categoria.nombre}"`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        try {
          await this.deleteCategoriaMutation.mutate(categoria.id);
          await this.categoriasQuery.refetch();
        } catch (error) {
          console.error('Error eliminando categoría:', error);
        }
      }
    }
  }));
});

console.log('✅ configuracion-app.js registrado en Alpine');
