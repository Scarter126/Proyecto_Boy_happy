/**
 * Asistencia App - Alpine.js Component
 * Supervisión de asistencia con filtros y estadísticas por alumno
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('asistenciaApp', () => ({
    // Estado
    asistencia: null,
    cursosQuery: null,
    busqueda: '',
    filtros: {
      curso: '',
      estado: '',
      fechaInicio: '',
      fechaFin: ''
    },

    // Lifecycle
    async init() {
      // Cargar cursos y asistencia
      this.cursosQuery = window.useConfiguracion('cursos');
      this.asistencia = window.useAsistencia({});

      await Promise.all([
        this.cursosQuery.init(),
        this.asistencia.init()
      ]);
    },

    // Computed: Lista de cursos
    get cursos() {
      return this.cursosQuery?.data?.cursosNombres || [];
    },

    async aplicarFiltros() {
      if (!this.asistencia) return;
      const params = {};
      if (this.filtros.curso) params.curso = this.filtros.curso;
      await this.asistencia.refetch();
    },

    // Computed: Registros filtrados
    get registrosFiltrados() {
      if (!this.asistencia) return [];
      if (!this.asistencia.data) return [];
      let registros = this.asistencia.data;

      // Filtro por estado
      if (this.filtros.estado) {
        registros = registros.filter(r => r.estado === this.filtros.estado);
      }

      // Filtro por fechas
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

      // Ordenar de más reciente a más antigua
      registros = [...registros].sort((a, b) => {
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        return fechaB - fechaA;
      });

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
            total: 0,
            registros: []
          };
        }
        if (porAlumno[r.rutAlumno][r.estado] !== undefined) {
          porAlumno[r.rutAlumno][r.estado]++;
        }
        porAlumno[r.rutAlumno].total++;
        porAlumno[r.rutAlumno].registros.push(r);
      });
      // Convertir a array y agregar porcentaje y alerta
      return Object.values(porAlumno).map(a => {
        const porcentaje = a.total > 0 ? parseFloat(((a.presente / a.total) * 100).toFixed(1)) : 0;
        const tieneAlerta = porcentaje < 70;
        return {
          ...a,
          porcentaje,
          tieneAlerta
        };
      });
    },

    // Computed: Detalle filtrado por búsqueda
    get detalleAlumnosFiltrados() {
      let alumnos = this.detalleAlumnos;

      // Búsqueda por nombre o RUT
      if (this.busqueda) {
        const search = this.busqueda.toLowerCase().trim();
        alumnos = alumnos.filter(a => {
          return (
            (a.nombre?.toLowerCase() || '').includes(search) ||
            (a.rut?.toLowerCase() || '').includes(search)
          );
        });
      }

      // Ordenar por porcentaje de asistencia (menor a mayor para ver primero los críticos)
      return [...alumnos].sort((a, b) => a.porcentaje - b.porcentaje);
    },

    // Methods
    limpiarFiltros() {
      this.filtros.curso = '';
      this.filtros.estado = '';
      this.filtros.fechaInicio = '';
      this.filtros.fechaFin = '';
      this.busqueda = '';
      this.aplicarFiltros();
    },

    async verHistorialAlumno(alumno) {
      // Ordenar registros por fecha descendente
      const registros = [...alumno.registros].sort((a, b) => {
        return new Date(b.fecha) - new Date(a.fecha);
      });

      const historialHTML = registros.map(r => {
        const estadoColor = r.estado === 'presente' ? '#4caf50' : r.estado === 'ausente' ? '#f44336' : '#ff9800';
        const estadoTexto = r.estado === 'presente' ? 'Presente' : r.estado === 'ausente' ? 'Ausente' : 'Atrasado';
        const fecha = new Date(r.fecha).toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        return `
          <div style="padding: 10px; margin-bottom: 8px; border-left: 4px solid ${estadoColor}; background: #f9f9f9; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 500;">${fecha}</span>
              <span style="background: ${estadoColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85em;">
                ${estadoTexto}
              </span>
            </div>
            ${r.observaciones ? `<p style="margin-top: 8px; font-size: 0.9em; color: #666;">📝 ${r.observaciones}</p>` : ''}
          </div>
        `;
      }).join('');

      await Swal.fire({
        title: `Historial de ${alumno.nombre}`,
        html: `
          <div style="text-align: left; max-height: 500px; overflow-y: auto;">
            <div style="padding: 15px; background: #f0f4ff; border-radius: 8px; margin-bottom: 20px;">
              <p><strong>RUT:</strong> ${alumno.rut}</p>
              <p><strong>Curso:</strong> ${alumno.curso}</p>
              <p><strong>Total Registros:</strong> ${alumno.total} días</p>
              <p><strong>% Asistencia:</strong> <span style="color: ${alumno.porcentaje >= 85 ? '#4caf50' : alumno.porcentaje >= 70 ? '#ff9800' : '#f44336'}; font-weight: bold;">${alumno.porcentaje}%</span></p>
            </div>
            <h4 style="margin-bottom: 15px; color: #667eea;">📅 Historial Detallado</h4>
            ${historialHTML || '<p style="text-align: center; color: #999;">No hay registros</p>'}
          </div>
        `,
        confirmButtonText: 'Cerrar',
        width: '700px'
      });
    },

    exportarExcel() {
      if (!window.XLSX) {
        Modal.error('Error', 'La librería XLSX no está disponible');
        return;
      }

      const data = this.detalleAlumnosFiltrados.map(a => ({
        'Alumno': a.nombre,
        'RUT': a.rut,
        'Curso': a.curso,
        'Presente': a.presente,
        'Ausente': a.ausente,
        'Atrasado': a.atrasado,
        'Total Días': a.total,
        '% Asistencia': a.porcentaje,
        'Estado': a.porcentaje >= 85 ? 'Excelente' : a.porcentaje >= 70 ? 'Regular' : 'Crítico'
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');

      const filename = `asistencia_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
    },

    exportarPDF() {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        Modal.error('Error', 'La librería jsPDF no está disponible');
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text('Reporte de Asistencia', 14, 20);

      doc.setFontSize(11);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`, 14, 30);

      const tableData = this.detalleAlumnosFiltrados.map(a => [
        a.nombre,
        a.rut,
        a.curso,
        a.presente.toString(),
        a.ausente.toString(),
        a.atrasado.toString(),
        a.total.toString(),
        `${a.porcentaje}%`,
        a.porcentaje >= 85 ? 'Excelente' : a.porcentaje >= 70 ? 'Regular' : 'Crítico'
      ]);

      doc.autoTable({
        head: [['Alumno', 'RUT', 'Curso', 'P', 'A', 'At', 'Total', '%', 'Estado']],
        body: tableData,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [102, 126, 234] }
      });

      const filename = `asistencia_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    }
  }));

  console.log('✅ asistencia-app.js registrado en Alpine');
});
