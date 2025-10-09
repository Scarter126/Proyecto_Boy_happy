/**
 * Dashboard App - Alpine.js Component
 * Gestión del dashboard de indicadores con semáforos
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('dashboardApp', () => ({
    // Hooks
    usuarios: window.useUsuarios(),
    asistencia: window.useAsistencia({}),
    materiales: window.useMateriales(),

    // Loading state
    get loading() {
      return this.usuarios.loading || this.asistencia.loading || this.materiales.loading;
    },

    // ✅ Computed: Indicadores
    get indicadores() {
      if (!this.usuarios.data || !this.asistencia.data || !this.materiales.data) return {
        totalUsuarios: 0,
        trendUsuarios: '0%',
        promedioAsistencia: '0%',
        semaforoAsistencia: 'gray',
        materialesActivos: 0,
        semaforoMateriales: 'gray'
      };

      const usuarios = this.usuarios.data;
      const asistencia = this.asistencia.data;
      const materiales = this.materiales.data?.materiales || this.materiales.data;

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
      if (!this.usuarios.data || !this.asistencia.data || !this.materiales.data) return [];

      const alertas = [];
      const asistencia = this.asistencia.data;
      const materiales = this.materiales.data?.materiales || this.materiales.data;

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

      // Invertir orden: mostrar las más recientes primero
      return alertas.reverse();
    },

    // ✅ Computed: Resumen por curso
    get resumenCursos() {
      if (!this.usuarios.data || !this.asistencia.data || !this.materiales.data) return [];

      const cursos = [
        { codigo: 'medio-mayor', nombre: 'Medio Mayor' },
        { codigo: 'prekinder-a', nombre: 'Prekínder A' },
        { codigo: 'prekinder-b', nombre: 'Prekínder B' },
        { codigo: 'kinder', nombre: 'Kínder' },
        { codigo: 'extension', nombre: 'Extensión Horaria' }
      ];

      const asistencia = this.asistencia.data;
      const materiales = this.materiales.data?.materiales || this.materiales.data;

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

    // Computed: Data consolidado (para compatibilidad)
    get data() {
      if (!this.usuarios.data || !this.asistencia.data || !this.materiales.data) return null;
      return {
        usuarios: this.usuarios.data,
        asistencia: this.asistencia.data,
        materiales: this.materiales.data?.materiales || this.materiales.data
      };
    },

    // Métodos
    async init() {
      await Promise.all([
        this.usuarios.init(),
        this.asistencia.init(),
        this.materiales.init()
      ]);
    },

    async refrescar() {
      await Promise.all([
        this.usuarios.refetch(),
        this.asistencia.refetch(),
        this.materiales.refetch()
      ]);
      Notify.success('Dashboard actualizado');
    }
  }));

  console.log('✅ dashboard-app.js registrado en Alpine');
});
