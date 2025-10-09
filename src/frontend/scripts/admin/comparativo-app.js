/**
 * Comparativo App - Alpine.js Component
 * Análisis comparativo multi-curso con gráficos Chart.js
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('comparativoApp', () => ({
    // Estado
    cursosSeleccionados: ['medio-mayor', 'prekinder-a', 'prekinder-b', 'kinder', 'extension'],
    fechaInicio: '',
    fechaFin: '',
    // Hooks
    asistenciaHook: window.useAsistencia({}),
    notasHook: window.useNotas({}),
    materialesHook: window.useMateriales(),
    // Cursos disponibles
    cursos: [
      { codigo: 'medio-mayor', nombre: 'Medio Mayor' },
      { codigo: 'prekinder-a', nombre: 'Prekínder A' },
      { codigo: 'prekinder-b', nombre: 'Prekínder B' },
      { codigo: 'kinder', nombre: 'Kínder' },
      { codigo: 'extension', nombre: 'Extensión Horaria' }
    ],
    // Instancias de gráficos
    chartAsistencia: null,
    chartEvolucion: null,
    chartNiveles: null,

    // Loading state
    get loading() {
      return this.asistenciaHook.loading || this.notasHook.loading || this.materialesHook.loading;
    },

    // Computed: Datos desde hooks
    get asistencia() {
      return this.asistenciaHook.data || [];
    },
    get notas() {
      return this.notasHook.data?.notas || this.notasHook.data || [];
    },
    get materiales() {
      return this.materialesHook.data?.materiales || this.materialesHook.data || [];
    },

    // Lifecycle
    async init() {
      await Promise.all([
        this.asistenciaHook.init(),
        this.notasHook.init(),
        this.materialesHook.init()
      ]);

      // Watchers para regenerar gráficos
      this.$watch('cursosSeleccionados', () => this.generarGraficos());
      this.$watch('fechaInicio', () => this.generarGraficos());
      this.$watch('fechaFin', () => this.generarGraficos());

      // Generar gráficos iniciales
      await this.$nextTick();
      this.generarGraficos();
    },
    // Computed: Datos comparativos en formato tabla
    get datosComparativos() {
      if (!this.cursosSeleccionados.length) return [];
      return this.cursosSeleccionados.map(codigo => {
        const curso = this.cursos.find(c => c.codigo === codigo);
        // Filtrar por curso y fechas
        const asistenciaCurso = this.filtrarPorFechas(
          this.asistencia.filter(a => a.curso === codigo)
        );
        const notasCurso = this.notas.filter(n => n.curso === codigo);
        const materialesCurso = this.materiales.filter(m => m.curso === codigo);
        // Calcular asistencia
        const presentes = asistenciaCurso.filter(a => a.estado === 'presente').length;
        const asistenciaPorcentaje = asistenciaCurso.length > 0
          ? ((presentes / asistenciaCurso.length) * 100).toFixed(1)
          : 0;
        // Calcular niveles usando nivelLogro (campo real en DB)
        const niveles = { logrado: 0, enDesarrollo: 0, noLogrado: 0, noTrabajado: 0 };
        let totalConceptuales = 0;

        notasCurso.forEach(n => {
          // DB usa 'nivelLogro' para evaluaciones conceptuales
          if (n.nivelLogro) {
            totalConceptuales++;
            const nivel = n.nivelLogro;
            if (nivel === 'L') niveles.logrado++;
            else if (nivel === 'OD') niveles.enDesarrollo++;
            else if (nivel === 'NL') niveles.noLogrado++;
            else if (nivel === 'NT') niveles.noTrabajado++;
          }
        });

        // Calcular promedio solo si hay evaluaciones conceptuales
        const promedio = totalConceptuales > 0
          ? ((niveles.logrado * 3 + niveles.enDesarrollo * 2 + niveles.noLogrado * 1) / totalConceptuales).toFixed(2)
          : '0.00';
        return {
          codigo,
          curso: curso?.nombre || codigo,
          asistencia: parseFloat(asistenciaPorcentaje),
          totalEvaluaciones: notasCurso.length,
          logrado: niveles.logrado,
          enDesarrollo: niveles.enDesarrollo,
          noLogrado: niveles.noLogrado,
          noTrabajado: niveles.noTrabajado,
          promedioNumerico: promedio,
          materiales: materialesCurso.length
        };
      });
    },
    // Helper: Filtrar por fechas
    filtrarPorFechas(datos) {
      if (!this.fechaInicio && !this.fechaFin) return datos;
      return datos.filter(item => {
        const fecha = new Date(item.fecha || item.fechaSubida);
        const inicio = this.fechaInicio ? new Date(this.fechaInicio) : null;
        const fin = this.fechaFin ? new Date(this.fechaFin) : null;
        if (inicio && fin) return fecha >= inicio && fecha <= fin;
        if (inicio) return fecha >= inicio;
        if (fin) return fecha <= fin;
        return true;
      });
    },
    // Helper: Color de fondo para tabla
    getColorFondo(valor, tipo = 'asistencia') {
      if (tipo === 'asistencia') {
        if (valor >= 90) return '#e8f5e9';
        if (valor >= 80) return '#fff9c4';
        return '#ffebee';
      }
      return 'transparent';
    },
    // Generar gráficos
    generarGraficos() {
      this.generarGraficoAsistencia();
      this.generarGraficoEvolucion();
      this.generarGraficoNiveles();
    },
    generarGraficoAsistencia() {
      const canvas = document.getElementById('chartAsistencia');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (this.chartAsistencia) {
        this.chartAsistencia.destroy();
      }
      const datos = this.datosComparativos;
      this.chartAsistencia = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: datos.map(d => d.curso),
          datasets: [{
            label: 'Asistencia (%)',
            data: datos.map(d => d.asistencia),
            backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100
            }
          }
        }
      });
    },
    generarGraficoEvolucion() {
      const canvas = document.getElementById('chartEvolucion');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (this.chartEvolucion) {
        this.chartEvolucion.destroy();
      }
      // Agrupar asistencia por fecha y curso
      const porFecha = {};
      this.cursosSeleccionados.forEach(codigo => {
        const asistenciaCurso = this.filtrarPorFechas(
          this.asistencia.filter(a => a.curso === codigo)
        );
        asistenciaCurso.forEach(a => {
          const fecha = a.fecha;
          if (!porFecha[fecha]) porFecha[fecha] = {};
          if (!porFecha[fecha][codigo]) porFecha[fecha][codigo] = { presentes: 0, total: 0 };
          porFecha[fecha][codigo].total++;
          if (a.estado === 'presente') porFecha[fecha][codigo].presentes++;
        });
      });
      const fechas = Object.keys(porFecha).sort();
      const datasets = this.cursosSeleccionados.map((codigo, index) => {
        const curso = this.cursos.find(c => c.codigo === codigo);
        const colores = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'];
        return {
          label: curso?.nombre || codigo,
          data: fechas.map(fecha => {
            const datos = porFecha[fecha][codigo];
            return datos ? ((datos.presentes / datos.total) * 100).toFixed(1) : 0;
          }),
          borderColor: colores[index],
          backgroundColor: colores[index] + '33',
          fill: true
        };
      });
      this.chartEvolucion = new Chart(ctx, {
        type: 'line',
        data: {
          labels: fechas,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100
            }
          }
        }
      });
    },
    generarGraficoNiveles() {
      const canvas = document.getElementById('chartNiveles');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (this.chartNiveles) {
        this.chartNiveles.destroy();
      }
      const datos = this.datosComparativos;
      this.chartNiveles = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Logrado', 'En Desarrollo', 'No Logrado', 'No Trabajado'],
          datasets: [{
            data: [
              datos.reduce((sum, d) => sum + d.logrado, 0),
              datos.reduce((sum, d) => sum + d.enDesarrollo, 0),
              datos.reduce((sum, d) => sum + d.noLogrado, 0),
              datos.reduce((sum, d) => sum + d.noTrabajado, 0)
            ],
            backgroundColor: ['#4caf50', '#ff9800', '#f44336', '#9e9e9e']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    },
    // Exportación
    exportarGrafico(chartId, filename) {
      const canvas = document.getElementById(chartId);
      if (!canvas) return;
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${filename}.png`;
      link.click();
    },
    exportarTablaExcel() {
      if (!this.datosComparativos.length) {
        Notify.warning('No hay datos para exportar');
        return;
      }
      const ws = XLSX.utils.json_to_sheet(this.datosComparativos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Comparativo');
      XLSX.writeFile(wb, `comparativo_${new Date().toISOString().slice(0,10)}.xlsx`);
      Notify.success('Tabla exportada exitosamente');
    }
  }));

  console.log('✅ comparativo-app.js registrado en Alpine');
});
