/**
 * Dashboard App - Alpine.js Component
 * Gestión del dashboard de indicadores con semáforos
 */
function dashboardApp() {
  return {
    // Estado local
    loading: false,
    refreshing: false,
    data: null,

    // Acceso a stores globales
    get usuariosData() {
      return this.$store.usuarios.data || [];
    },

    get asistenciaData() {
      return this.$store.asistencia.data || [];
    },

    get materialesData() {
      return this.$store.materiales.data || [];
    },

    // ✅ Computed: Indicadores
    get indicadores() {
      if (!this.data) return {
        totalUsuarios: 0,
        trendUsuarios: '0%',
        promedioAsistencia: '0%',
        semaforoAsistencia: 'gray',
        materialesActivos: 0,
        semaforoMateriales: 'gray'
      };

      const { usuarios, asistencia, materiales } = this.data;

      // Usuarios activos
      const usuariosActivos = usuarios.filter(u => u.activo !== false).length;

      // Asistencia promedio + semáforo
      const presentes = asistencia.filter(r => r.estado === 'presente').length;
      const promedioAsistencia = asistencia.length > 0
        ? ((presentes / asistencia.length) * 100).toFixed(1)
        : 0;

      let semaforoAsistencia = 'gray';
      if (asistencia.length > 0) {
        if (promedioAsistencia >= 90) semaforoAsistencia = 'green';
        else if (promedioAsistencia >= 80) semaforoAsistencia = 'yellow';
        else semaforoAsistencia = 'red';
      }

      // Materiales activos
      const materialesAprobados = materiales.filter(m => m.estado === 'aprobado').length;

      // Materiales pendientes + semáforo
      const materialesPendientes = materiales.filter(m =>
        m.estado === 'pendiente' || m.estado === 'requiere_correccion'
      ).length;

      let semaforoMateriales = 'green';
      if (materialesPendientes > 5) semaforoMateriales = 'red';
      else if (materialesPendientes > 2) semaforoMateriales = 'yellow';

      return {
        totalUsuarios: usuariosActivos,
        trendUsuarios: '+12% este mes',
        promedioAsistencia: promedioAsistencia + '%',
        semaforoAsistencia,
        materialesActivos: materialesAprobados,
        semaforoMateriales
      };
    },

    // ✅ Computed: Alertas críticas
    get alertas() {
      if (!this.data) return [];

      const alertas = [];
      const { asistencia, materiales, usuarios } = this.data;

      // Alerta: Ausentismo crítico
      const porAlumno = {};
      asistencia.forEach(r => {
        if (!porAlumno[r.rutAlumno]) {
          porAlumno[r.rutAlumno] = { nombre: r.nombreAlumno, presente: 0, total: 0 };
        }
        if (r.estado === 'presente') porAlumno[r.rutAlumno].presente++;
        porAlumno[r.rutAlumno].total++;
      });

      Object.values(porAlumno).forEach(alumno => {
        const porcentaje = (alumno.presente / alumno.total) * 100;
        if (porcentaje < 85 && alumno.total >= 5) {
          alertas.push({
            tipo: 'danger',
            icono: 'fa-exclamation-circle',
            mensaje: `Ausentismo crítico: ${alumno.nombre} (${porcentaje.toFixed(1)}% asistencia)`,
            prioridad: 'alta',
            color: '#f44336',
            accion: 'Ver Detalles',
            seccion: 'asistencia'
          });
        }
      });

      // Alerta: Materiales pendientes
      const pendientes = materiales.filter(m => m.estado === 'pendiente').length;
      if (pendientes > 5) {
        alertas.push({
          tipo: 'warning',
          icono: 'fa-folder-open',
          mensaje: `${pendientes} materiales pendientes de revisión`,
          prioridad: 'media',
          color: '#ff9800',
          accion: 'Revisar',
          seccion: 'materiales'
        });
      }

      return alertas;
    },

    // ✅ Computed: Resumen por curso
    get resumenCursos() {
      if (!this.data) return [];

      const cursos = [
        { codigo: 'medio-mayor', nombre: 'Medio Mayor' },
        { codigo: 'prekinder-a', nombre: 'Prekínder A' },
        { codigo: 'prekinder-b', nombre: 'Prekínder B' },
        { codigo: 'kinder', nombre: 'Kínder' },
        { codigo: 'extension', nombre: 'Extensión Horaria' }
      ];

      const { asistencia, materiales, usuarios } = this.data;

      return cursos.map((curso, index) => {
        // Asistencia del curso
        const asistenciaCurso = asistencia.filter(r => r.curso === curso.codigo);
        const presentes = asistenciaCurso.filter(r => r.estado === 'presente').length;
        const promedioAsistencia = asistenciaCurso.length > 0
          ? ((presentes / asistenciaCurso.length) * 100).toFixed(1)
          : 0;

        // Materiales del curso
        const materialesCurso = materiales.filter(m => m.curso === curso.codigo);
        const materialesPublicados = materialesCurso.filter(m => m.estado === 'aprobado').length;

        // Alumnos (estimado)
        const alumnosUnicos = new Set(asistenciaCurso.map(r => r.rutAlumno));

        // Semáforo de salud del curso
        let semaforoColor = '#4caf50'; // Verde
        if (promedioAsistencia < 80) semaforoColor = '#f44336'; // Rojo
        else if (promedioAsistencia < 90) semaforoColor = '#ff9800'; // Amarillo

        return {
          ...curso,
          alumnos: alumnosUnicos.size,
          asistencia: promedioAsistencia + '%',
          materialesPublicados,
          materialesTotal: materialesCurso.length,
          registrosAsistencia: asistenciaCurso.length,
          semaforoColor
        };
      });
    },

    // Métodos
    async init() {
      await this.cargarDatos();
    },

    async cargarDatos() {
      this.loading = true;

      try {
        // Fetch directo con apiClient
        const [usuarios, asistencia, materiales] = await Promise.all([
          window.apiClient.get('/usuarios'),
          window.apiClient.get('/asistencia'),
          window.apiClient.get('/materiales')
        ]);

        // Consolidar datos
        this.data = {
          usuarios: usuarios || [],
          asistencia: asistencia || [],
          materiales: materiales?.materiales || materiales || []
        };

        if (!this.refreshing) {
          Notify.success('Dashboard cargado correctamente');
        }

      } catch (error) {
        console.error('Error cargando dashboard:', error);

        await Swal.fire({
          icon: 'error',
          title: '❌ Error al cargar Dashboard',
          html: `
            <p>No se pudo cargar la información del dashboard.</p>
            <p style="color: #999; font-size: 0.9em; margin-top: 10px;">
              <strong>Detalle:</strong> ${error.message || 'Error desconocido'}
            </p>
          `,
          confirmButtonText: 'Reintentar',
          showCancelButton: true,
          cancelButtonText: 'Cerrar'
        }).then((result) => {
          if (result.isConfirmed) {
            this.cargarDatos();
          }
        });
      } finally {
        this.loading = false;
        this.refreshing = false;
      }
    },

    async refrescar() {
      this.refreshing = true;
      await this.cargarDatos();
    }
  };
}

// Exportar globalmente
window.dashboardApp = dashboardApp;
