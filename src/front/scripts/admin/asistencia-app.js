/**
 * Asistencia App - Alpine.js Component
 * Supervisión de asistencia con filtros y estadísticas por alumno
 */
function asistenciaApp() {
  return {
    // Estado
    filtros: {
      curso: '',
      fechaInicio: '',
      fechaFin: ''
    },

    // Hooks reutilizables
    asistencia: useAsistencia({}),

    // Lifecycle
    async init() {
      if (this.asistencia.init) await this.asistencia.init();
      await this.cargarDatos();
    },

    async cargarDatos() {
      const params = {};
      if (this.filtros.curso) params.curso = this.filtros.curso;

      this.asistencia = useAsistencia(params);
      await this.asistencia.fetch();
    },

    async aplicarFiltros() {
      await this.cargarDatos();
    },

    // Computed: Registros filtrados por fechas
    get registrosFiltrados() {
      if (!this.asistencia.data) return [];

      let registros = this.asistencia.data;
      const { fechaInicio, fechaFin } = this.filtros;

      if (fechaInicio || fechaFin) {
        registros = registros.filter(r => {
          const fecha = new Date(r.fecha);
          const inicio = fechaInicio ? new Date(fechaInicio) : null;
          const fin = fechaFin ? new Date(fechaFin) : null;

          if (inicio && fin) {
            return fecha >= inicio && fecha <= fin;
          } else if (inicio) {
            return fecha >= inicio;
          } else if (fin) {
            return fecha <= fin;
          }
          return true;
        });
      }

      return registros;
    },

    // Computed: Resumen general
    get resumen() {
      const registros = this.registrosFiltrados;
      const totales = { presente: 0, ausente: 0, atrasado: 0 };

      registros.forEach(r => {
        if (totales[r.estado] !== undefined) {
          totales[r.estado]++;
        }
      });

      const total = registros.length;
      const porcentaje = total > 0 ? ((totales.presente / total) * 100).toFixed(1) : '0';

      return {
        presente: totales.presente,
        ausente: totales.ausente,
        atrasado: totales.atrasado,
        porcentaje
      };
    },

    // Computed: Detalle por alumno
    get detalleAlumnos() {
      const registros = this.registrosFiltrados;
      const porAlumno = {};

      registros.forEach(r => {
        if (!porAlumno[r.rutAlumno]) {
          porAlumno[r.rutAlumno] = {
            nombre: r.nombreAlumno,
            rut: r.rutAlumno,
            curso: r.curso,
            presente: 0,
            ausente: 0,
            atrasado: 0,
            total: 0
          };
        }
        if (porAlumno[r.rutAlumno][r.estado] !== undefined) {
          porAlumno[r.rutAlumno][r.estado]++;
        }
        porAlumno[r.rutAlumno].total++;
      });

      // Convertir a array y agregar porcentaje y alerta
      return Object.values(porAlumno).map(a => {
        const porcentaje = a.total > 0 ? ((a.presente / a.total) * 100).toFixed(1) : 0;
        const tieneAlerta = porcentaje < 85;

        return {
          ...a,
          porcentaje,
          tieneAlerta
        };
      });
    }
  };
}

window.asistenciaApp = asistenciaApp;
