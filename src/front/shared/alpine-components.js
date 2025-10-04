/**
 * ⭐ COMPONENTES REUTILIZABLES ALPINE.JS
 * Sistema de componentes usando Alpine.data()
 *
 * Uso:
 * <div x-data="dataTable({ endpoint: '/usuarios', columns: [...] })">
 */

// ==========================================
// 🔥 DATA TABLE COMPONENT - Tabla con paginación, filtros, ordenamiento
// ==========================================
document.addEventListener('alpine:init', () => {

  Alpine.data('dataTable', (config) => ({
    // Config
    endpoint: config.endpoint,
    columns: config.columns || [],
    filters: config.filters || {},
    pageSize: config.pageSize || 10,
    searchable: config.searchable !== false,
    sortable: config.sortable !== false,

    // Estado
    data: [],
    loading: false,
    error: null,
    search: '',
    sortColumn: null,
    sortDirection: 'asc',
    currentPage: 1,

    // Lifecycle
    async init() {
      await this.fetchData();
    },

    // Computed: Datos filtrados y ordenados
    get filteredData() {
      let result = this.data;

      // Buscar
      if (this.search) {
        result = result.filter(row => {
          return this.columns.some(col => {
            const value = this.getCellValue(row, col.field);
            return String(value).toLowerCase().includes(this.search.toLowerCase());
          });
        });
      }

      // Ordenar
      if (this.sortColumn) {
        result = [...result].sort((a, b) => {
          const aVal = this.getCellValue(a, this.sortColumn);
          const bVal = this.getCellValue(b, this.sortColumn);

          if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
          if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
      }

      return result;
    },

    // Computed: Paginación
    get paginatedData() {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.filteredData.slice(start, end);
    },

    get totalPages() {
      return Math.ceil(this.filteredData.length / this.pageSize);
    },

    // Métodos
    async fetchData() {
      this.loading = true;
      try {
        const response = await window.apiClient.get(this.endpoint);
        this.data = response.data || response;
      } catch (error) {
        this.error = error.message;
        Notify.error('Error al cargar datos');
      } finally {
        this.loading = false;
      }
    },

    getCellValue(row, field) {
      return field.split('.').reduce((obj, key) => obj?.[key], row);
    },

    sortBy(column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }
    },

    nextPage() {
      if (this.currentPage < this.totalPages) this.currentPage++;
    },

    prevPage() {
      if (this.currentPage > 1) this.currentPage--;
    }
  }));

  // ==========================================
  // 🔥 CRUD FORM COMPONENT - Formulario con validación
  // ==========================================
  Alpine.data('crudForm', (config) => ({
    endpoint: config.endpoint,
    fields: config.fields || [],
    method: config.method || 'POST',

    // Estado
    formData: {},
    errors: {},
    loading: false,

    init() {
      // Inicializar formData con valores por defecto
      this.fields.forEach(field => {
        this.formData[field.name] = field.defaultValue || '';
      });
    },

    // Validación
    validate() {
      this.errors = {};

      this.fields.forEach(field => {
        if (field.required && !this.formData[field.name]) {
          this.errors[field.name] = `${field.label} es requerido`;
        }

        if (field.type === 'email' && this.formData[field.name]) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(this.formData[field.name])) {
            this.errors[field.name] = 'Email inválido';
          }
        }

        if (field.validate) {
          const error = field.validate(this.formData[field.name]);
          if (error) this.errors[field.name] = error;
        }
      });

      return Object.keys(this.errors).length === 0;
    },

    async submit() {
      if (!this.validate()) {
        Notify.error('Por favor corrige los errores');
        return;
      }

      this.loading = true;
      try {
        const client = window.apiClient;
        const response = this.method === 'POST'
          ? await client.post(this.endpoint, this.formData)
          : await client.put(this.endpoint, this.formData);

        Notify.success('Guardado exitosamente');
        this.$dispatch('form-submitted', response);
        this.reset();
      } catch (error) {
        Notify.error(error.message);
      } finally {
        this.loading = false;
      }
    },

    reset() {
      this.fields.forEach(field => {
        this.formData[field.name] = field.defaultValue || '';
      });
      this.errors = {};
    }
  }));

  // ==========================================
  // 🔥 MODAL COMPONENT - Modal reutilizable
  // ==========================================
  Alpine.data('modal', () => ({
    open: false,

    show() {
      this.open = true;
      document.body.style.overflow = 'hidden';
    },

    hide() {
      this.open = false;
      document.body.style.overflow = '';
    },

    toggle() {
      this.open ? this.hide() : this.show();
    }
  }));

  // ==========================================
  // 🔥 TABS COMPONENT - Tabs reutilizable
  // ==========================================
  Alpine.data('tabs', (defaultTab = 0) => ({
    activeTab: defaultTab,

    isActive(tab) {
      return this.activeTab === tab;
    },

    setActive(tab) {
      this.activeTab = tab;
    }
  }));

  // ==========================================
  // 🔥 DROPDOWN COMPONENT - Dropdown con click fuera
  // ==========================================
  Alpine.data('dropdown', () => ({
    open: false,

    toggle() {
      this.open = !this.open;
    },

    close() {
      this.open = false;
    }
  }));

  // ==========================================
  // 🔥 ACCORDION COMPONENT
  // ==========================================
  Alpine.data('accordion', () => ({
    openItems: [],

    toggle(index) {
      if (this.openItems.includes(index)) {
        this.openItems = this.openItems.filter(i => i !== index);
      } else {
        this.openItems.push(index);
      }
    },

    isOpen(index) {
      return this.openItems.includes(index);
    }
  }));

  // ==========================================
  // 🔥 FILTER BAR COMPONENT - Barra de filtros
  // ==========================================
  Alpine.data('filterBar', (config) => ({
    filters: config.filters || {},
    activeFilters: {},

    init() {
      // Inicializar filtros
      Object.keys(this.filters).forEach(key => {
        this.activeFilters[key] = '';
      });
    },

    applyFilters() {
      this.$dispatch('filters-changed', this.activeFilters);
    },

    clearFilters() {
      Object.keys(this.activeFilters).forEach(key => {
        this.activeFilters[key] = '';
      });
      this.applyFilters();
    },

    get hasActiveFilters() {
      return Object.values(this.activeFilters).some(v => v !== '');
    }
  }));

  // ==========================================
  // 🔥 PAGINATION COMPONENT
  // ==========================================
  Alpine.data('pagination', (config) => ({
    currentPage: 1,
    pageSize: config.pageSize || 10,
    totalItems: config.totalItems || 0,

    get totalPages() {
      return Math.ceil(this.totalItems / this.pageSize);
    },

    get pages() {
      const pages = [];
      const maxVisible = 5;
      let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
      let end = Math.min(this.totalPages, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      return pages;
    },

    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
        this.$dispatch('page-changed', this.currentPage);
      }
    },

    nextPage() {
      this.goToPage(this.currentPage + 1);
    },

    prevPage() {
      this.goToPage(this.currentPage - 1);
    }
  }));

  // ==========================================
  // 🔥 STATS CARD COMPONENT - Tarjeta de estadísticas
  // ==========================================
  Alpine.data('statsCard', (config) => ({
    title: config.title,
    value: config.value,
    icon: config.icon,
    color: config.color || '#667eea',
    trend: config.trend || null, // 'up', 'down', null
    trendValue: config.trendValue || '',

    get trendIcon() {
      if (this.trend === 'up') return 'fa-arrow-up';
      if (this.trend === 'down') return 'fa-arrow-down';
      return '';
    },

    get trendColor() {
      if (this.trend === 'up') return '#4caf50';
      if (this.trend === 'down') return '#ef5350';
      return '#999';
    }
  }));

  // ==========================================
  // 🔥 DASHBOARD APP COMPONENT
  // ==========================================
  Alpine.data('dashboardApp', () => ({
    // Estado
    loading: false,
    refreshing: false,
    data: null,
    error: null,

    // Indicadores
    indicadores: {
      totalUsuarios: 0,
      promedioAsistencia: 0,
      materialesActivos: 0,
      semaforoAsistencia: 'gray',
      semaforoMateriales: 'gray',
      trendUsuarios: '',
      trendAsistencia: '',
      trendMateriales: ''
    },

    // Alertas y resúmenes
    alertas: [],
    resumenCursos: [],

    // Lifecycle
    async init() {
      console.log('🔵 dashboardApp.init() ejecutado');
      await this.cargar();
    },

    // Métodos
    async cargar() {
      console.log('🟢 dashboardApp.cargar() - Haciendo fetch de datos...');
      this.loading = true;
      this.error = null;

      try {
        const PREFIX = window.APP_CONFIG?.API_URL ?? '';
        console.log('🟡 Fetching:', `${PREFIX}/usuarios`, `${PREFIX}/asistencia`, `${PREFIX}/materiales`);
        const [usuarios, asistencia, dataMateriales] = await Promise.all([
          window.apiClient.get(`${PREFIX}/usuarios`),
          window.apiClient.get(`${PREFIX}/asistencia`).catch(() => []),
          window.apiClient.get(`${PREFIX}/materiales`).catch(() => ({ materiales: [] }))
        ]);
        console.log('✅ Fetch completado - usuarios:', usuarios.length, 'asistencia:', asistencia.length, 'materiales:', (dataMateriales.materiales || dataMateriales).length);

        const materiales = dataMateriales.materiales || dataMateriales;

        // Calcular indicadores
        this.calcularIndicadorUsuarios(usuarios);
        this.calcularIndicadorAsistencia(asistencia);
        this.calcularIndicadorMateriales(materiales);

        // Generar alertas críticas y resumen por curso
        this.generarAlertasCriticas({ usuarios, asistencia, materiales });
        this.generarResumenCursos({ asistencia, materiales });

        // Guardar data
        this.data = { usuarios, asistencia, materiales };

      } catch (err) {
        console.error('Error cargando dashboard:', err);
        this.error = 'Error al cargar dashboard';
        window.Swal?.fire({
          icon: 'error',
          title: 'Error al cargar Dashboard',
          text: err.message || 'No se pudo cargar la información del dashboard'
        });
      } finally {
        this.loading = false;
      }
    },

    async refrescar() {
      this.refreshing = true;
      await this.cargar();
      this.refreshing = false;
    },

    calcularIndicadorUsuarios(usuarios) {
      const activos = usuarios.filter(u => u.activo !== false).length;
      this.indicadores.totalUsuarios = activos;
      this.indicadores.trendUsuarios = `${usuarios.length} total`;
    },

    calcularIndicadorAsistencia(registros) {
      if (!Array.isArray(registros) || registros.length === 0) {
        this.indicadores.promedioAsistencia = 'N/A';
        this.indicadores.semaforoAsistencia = 'gray';
        return;
      }

      // Calcular porcentaje basado en estados (estructura real de API: 'presente', 'ausente', 'atrasado', 'justificado')
      const presentes = registros.filter(r => r.estado === 'presente' || r.estado === 'atrasado').length;
      const total = registros.length;
      const promedio = Math.round((presentes / total) * 100);

      this.indicadores.promedioAsistencia = promedio + '%';

      // Semáforo
      if (promedio >= 85) {
        this.indicadores.semaforoAsistencia = 'green';
      } else if (promedio >= 70) {
        this.indicadores.semaforoAsistencia = 'yellow';
      } else {
        this.indicadores.semaforoAsistencia = 'red';
      }
    },

    calcularIndicadorMateriales(materiales) {
      if (!Array.isArray(materiales)) {
        this.indicadores.materialesActivos = 0;
        this.indicadores.semaforoMateriales = 'gray';
        return;
      }

      // Contar materiales publicados (estructura real de API)
      const activos = materiales.filter(m => m.estado === 'publicado').length;
      this.indicadores.materialesActivos = activos;

      const total = materiales.length;
      const porcentaje = total > 0 ? (activos / total) * 100 : 0;

      // Semáforo basado en porcentaje de materiales publicados
      if (porcentaje >= 70) {
        this.indicadores.semaforoMateriales = 'green';
      } else if (porcentaje >= 40) {
        this.indicadores.semaforoMateriales = 'yellow';
      } else {
        this.indicadores.semaforoMateriales = 'red';
      }
    },

    // Generar alertas críticas basadas en umbrales
    generarAlertasCriticas({ usuarios, asistencia, materiales }) {
      const alertas = [];

      // Alerta 1: Asistencia crítica (< 60%)
      const presentes = asistencia.filter(r => r.estado === 'presente' || r.estado === 'atrasado').length;
      const promedioAsistencia = Math.round((presentes / asistencia.length) * 100);

      if (promedioAsistencia < 60) {
        alertas.push({
          tipo: 'error',
          icono: 'fa-exclamation-circle',
          color: '#f44336',
          mensaje: `Asistencia crítica: ${promedioAsistencia}% (umbral mínimo: 60%)`,
          accion: 'Ver detalle',
          prioridad: 'alta',
          seccion: 'asistencia'
        });
      } else if (promedioAsistencia < 75) {
        alertas.push({
          tipo: 'warning',
          icono: 'fa-exclamation-triangle',
          color: '#ff9800',
          mensaje: `Asistencia baja: ${promedioAsistencia}% (recomendado: >75%)`,
          accion: 'Ver detalle',
          prioridad: 'media',
          seccion: 'asistencia'
        });
      }

      // Alerta 2: Materiales pendientes de revisión
      const materialesPendientes = materiales.filter(m =>
        m.estado === 'borrador' || m.estado === 'revision'
      ).length;

      if (materialesPendientes > 10) {
        alertas.push({
          tipo: 'warning',
          icono: 'fa-folder-open',
          color: '#ff9800',
          mensaje: `${materialesPendientes} materiales pendientes de revisión`,
          accion: 'Ir a revisión',
          prioridad: 'media',
          seccion: 'materiales'
        });
      }

      // Alerta 3: Pocos materiales publicados
      const materialesPublicados = materiales.filter(m => m.estado === 'publicado').length;
      const porcentajePublicados = Math.round((materialesPublicados / materiales.length) * 100);

      if (porcentajePublicados < 30) {
        alertas.push({
          tipo: 'error',
          icono: 'fa-book',
          color: '#f44336',
          mensaje: `Solo ${porcentajePublicados}% de materiales publicados (${materialesPublicados}/${materiales.length})`,
          accion: 'Revisar materiales',
          prioridad: 'alta',
          seccion: 'materiales'
        });
      }

      // Alerta 4: Usuarios inactivos
      const usuariosInactivos = usuarios.filter(u => u.activo === false).length;
      if (usuariosInactivos > 3) {
        alertas.push({
          tipo: 'info',
          icono: 'fa-user-slash',
          color: '#2196f3',
          mensaje: `${usuariosInactivos} usuarios inactivos en el sistema`,
          accion: 'Ver usuarios',
          prioridad: 'baja',
          seccion: 'usuarios'
        });
      }

      // Ordenar por prioridad (alta > media > baja)
      const prioridadOrden = { alta: 1, media: 2, baja: 3 };
      alertas.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

      this.alertas = alertas;
    },

    // Generar resumen por curso
    generarResumenCursos({ asistencia, materiales }) {
      // Obtener lista única de cursos desde asistencia
      const cursosSet = new Set(asistencia.map(a => a.curso));
      const cursos = Array.from(cursosSet).sort();

      this.resumenCursos = cursos.map(curso => {
        // Calcular asistencia del curso
        const asistenciaCurso = asistencia.filter(a => a.curso === curso);
        const presentesCurso = asistenciaCurso.filter(r =>
          r.estado === 'presente' || r.estado === 'atrasado'
        ).length;
        const promedioAsistencia = asistenciaCurso.length > 0
          ? Math.round((presentesCurso / asistenciaCurso.length) * 100)
          : 0;

        // Calcular materiales del curso
        const materialesCurso = materiales.filter(m => m.curso === curso);
        const materialesPublicados = materialesCurso.filter(m => m.estado === 'publicado').length;

        // Contar alumnos únicos del curso
        const alumnosUnicos = new Set(asistenciaCurso.map(a => a.rutAlumno));
        const totalAlumnos = alumnosUnicos.size;

        // Determinar color del semáforo
        let semaforoColor = '#ddd';
        if (promedioAsistencia >= 85) semaforoColor = '#4caf50';
        else if (promedioAsistencia >= 70) semaforoColor = '#ff9800';
        else if (promedioAsistencia > 0) semaforoColor = '#f44336';

        return {
          codigo: curso,
          nombre: curso,
          alumnos: totalAlumnos,
          asistencia: promedioAsistencia + '%',
          asistenciaNumero: promedioAsistencia,
          semaforoColor,
          materialesTotal: materialesCurso.length,
          materialesPublicados,
          registrosAsistencia: asistenciaCurso.length
        };
      });
    }
  }));
});

console.log('✅ alpine-components.js cargado');
