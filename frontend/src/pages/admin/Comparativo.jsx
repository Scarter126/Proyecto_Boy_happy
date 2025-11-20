/**
 * Comparative Reports Page - Boy Happy
 *
 * Comprehensive production-ready page for comparative analytics and reporting.
 * Provides visual comparison of courses, subjects, and performance metrics.
 *
 * Features:
 * - Multi-dimensional filtering (curso, asignatura, periodo, tipo)
 * - Date range selection
 * - Interactive bar and line charts
 * - Statistical analysis with key metrics
 * - Export to PDF/CSV functionality
 * - Print-friendly layout
 * - Real-time data updates
 * - Responsive design
 * - Loading and error states
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useComparativo } from '../../hooks/useComparativo';
import { useCursos, useAsignaturas } from '../../hooks/useConfiguracion';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import Swal from 'sweetalert2';

function Comparativo() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  // Filter state
  const [compareBy, setCompareBy] = useState('curso'); // curso, asignatura, periodo
  const [comparisonType, setComparisonType] = useState('notas'); // notas, asistencia, materiales - CAMBIADO para coincidir con primera opción del select
  const [selectedCursos, setSelectedCursos] = useState([]);
  const [selectedAsignaturas, setSelectedAsignaturas] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodo, setPeriodo] = useState('');

  // View state
  const [chartType, setChartType] = useState('bar'); // bar, line, table
  const [showPrintView, setShowPrintView] = useState(false);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  // Fetch available cursos and asignaturas from configuration
  const { data: cursosData, isLoading: isLoadingCursos } = useCursos();
  const { data: asignaturasData, isLoading: isLoadingAsignaturas } = useAsignaturas();

  const cursos = cursosData || [];
  const asignaturas = asignaturasData || [];

  const params = useMemo(() => {
    const computedParams = {
      compareBy,
      comparisonType,
      cursos: selectedCursos.join(','),
      asignaturas: selectedAsignaturas.join(','),
      startDate,
      endDate,
      periodo
    };
    console.log('📊 [Comparativo] Params computed:', computedParams);
    return computedParams;
  }, [compareBy, comparisonType, selectedCursos, selectedAsignaturas, startDate, endDate, periodo]);

  const { data, isLoading, isError, error, refetch } = useComparativo(params);

  // Debug: Log data when it changes
  useEffect(() => {
    console.log('📦 [Comparativo] Data received from backend:', {
      data,
      isLoading,
      isError,
      error: error?.message
    });
  }, [data, isLoading, isError, error]);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Process data for visualization
  const chartData = useMemo(() => {
    console.log('🔄 [Comparativo] Processing chartData...', {
      hasData: !!data,
      hasComparisons: !!data?.comparisons,
      comparisonsLength: data?.comparisons?.length,
      comparisonType
    });

    if (!data?.comparisons) {
      console.log('⚠️ [Comparativo] No comparisons data available');
      return [];
    }

    const processedData = data.comparisons.map(item => {
      // Para asistencia: usar porcentajeAsistencia
      if (comparisonType === 'asistencia') {
        const result = {
          label: item.label,
          value: item.porcentajeAsistencia || 0,
          count: item.count || 0,
          color: getColorForValue(item.porcentajeAsistencia || 0),
          distribucion: item.distribucionAsistencia,
          distribucionPorcentual: item.distribucionAsistenciaPorcentual
        };
        console.log('📈 [Comparativo] Processed asistencia item:', result);
        return result;
      }

      // Para notas: calcular valor basado en distribución L/NL/OD/NT
      // L = 100%, OD = 66%, NL = 33%, NT = 0%
      if (comparisonType === 'notas') {
        const dist = item.distribucionLogro || {};
        const total = item.count || 1;
        const value = ((dist.L || 0) * 100 + (dist.OD || 0) * 66 + (dist.NL || 0) * 33 + (dist.NT || 0) * 0) / total;

        const result = {
          label: item.label,
          value: value,
          count: item.count || 0,
          color: getColorForValue(value),
          distribucion: item.distribucionLogro,
          distribucionPorcentual: item.distribucionLogroPorcentual
        };
        console.log('📈 [Comparativo] Processed notas item:', {
          label: result.label,
          distribucion: dist,
          total,
          calculatedValue: value,
          result
        });
        return result;
      }

      // Fallback
      console.log('⚠️ [Comparativo] Using fallback for item:', item);
      return {
        label: item.label,
        value: 0,
        count: item.count || 0,
        color: '#667eea',
        distribucion: null,
        distribucionPorcentual: null
      };
    });

    console.log('✅ [Comparativo] ChartData processed:', processedData);
    return processedData;
  }, [data, comparisonType]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!chartData.length) {
      return {
        best: { label: '-', value: 0 },
        worst: { label: '-', value: 0 },
        average: 0,
        improvement: 0
      };
    }

    const sorted = [...chartData].sort((a, b) => b.value - a.value);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const average = chartData.reduce((sum, item) => sum + item.value, 0) / chartData.length;

    // Calculate improvement percentage (comparing first and last in time series)
    const improvement = chartData.length > 1
      ? ((chartData[chartData.length - 1].value - chartData[0].value) / chartData[0].value) * 100
      : 0;

    return { best, worst, average, improvement };
  }, [chartData]);

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  function getColorForValue(value) {
    if (comparisonType === 'notas') {
      if (value >= 6.0) return '#48bb78'; // green
      if (value >= 5.0) return '#ed8936'; // orange
      return '#e53e3e'; // red
    } else if (comparisonType === 'asistencia') {
      if (value >= 85) return '#48bb78';
      if (value >= 70) return '#ed8936';
      return '#e53e3e';
    }
    return '#667eea'; // default purple
  }

  function formatValue(value) {
    if (comparisonType === 'asistencia') {
      return `${value.toFixed(1)}%`;
    } else if (comparisonType === 'notas') {
      // Para logro académico, mostrar el valor ponderado
      return `${value.toFixed(1)}%`;
    }
    return Math.round(value);
  }

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleApplyFilters = () => {
    console.log('🔍 [Comparativo] Applying filters...', {
      compareBy,
      comparisonType,
      selectedCursos,
      selectedAsignaturas,
      startDate,
      endDate,
      periodo
    });

    // Validaciones
    if (compareBy === 'curso' && selectedCursos.length === 0) {
      console.log('⚠️ [Comparativo] Validation failed: No courses selected');
      Swal.fire({
        icon: 'warning',
        title: 'Selección Requerida',
        text: 'Debes seleccionar al menos un curso para comparar',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    if (compareBy === 'asignatura' && selectedAsignaturas.length === 0) {
      console.log('⚠️ [Comparativo] Validation failed: No subjects selected');
      Swal.fire({
        icon: 'warning',
        title: 'Selección Requerida',
        text: 'Debes seleccionar al menos una asignatura para comparar',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Validación especial: asistencia no se puede comparar por asignatura
    if (compareBy === 'asignatura' && comparisonType === 'asistencia') {
      console.log('⚠️ [Comparativo] Validation failed: Cannot compare attendance by subject');
      Swal.fire({
        icon: 'info',
        title: 'Comparación No Disponible',
        text: 'La asistencia se registra por curso y día, no por asignatura. Por favor selecciona "Comparar por Curso".',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Validación de fechas
    if (startDate && endDate && startDate > endDate) {
      console.log('⚠️ [Comparativo] Validation failed: Invalid date range');
      Swal.fire({
        icon: 'warning',
        title: 'Rango de Fechas Inválido',
        text: 'La fecha de inicio debe ser anterior a la fecha de fin',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    console.log('✅ [Comparativo] Validation passed, triggering refetch...');
    refetch();
  };

  const handleClearFilters = () => {
    setCompareBy('curso');
    setComparisonType('notas');
    setSelectedCursos([]);
    setSelectedAsignaturas([]);
    setStartDate('');
    setEndDate('');
    setPeriodo('');
  };

  const handleExportPDF = async () => {
    try {
      // Show print preview
      setShowPrintView(true);
      setTimeout(() => {
        window.print();
        setShowPrintView(false);
      }, 100);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al exportar',
        text: 'No se pudo generar el PDF'
      });
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ['Nombre', 'Valor', 'Cantidad'];
      const rows = chartData.map(item => [
        item.label,
        formatValue(item.value),
        item.count
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `reporte_comparativo_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      Swal.fire({
        icon: 'success',
        title: 'Exportado',
        text: 'El reporte se ha descargado exitosamente',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al exportar',
        text: 'No se pudo generar el archivo CSV'
      });
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className={`page-content ${showPrintView ? 'print-view' : ''}`}>
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-view .card { box-shadow: none; }
          .page-content { padding: 0; }
        }
      `}</style>

      {/* Page Header */}
      <div className="no-print">
        <SectionHeader
          title="Reportes Comparativos"
          icon="fa-chart-bar"
        />
      </div>

      {/* Statistics Cards */}
      {!isLoading && !isError && chartData.length > 0 && (
        <StatCardGrid>
          <div className="indicator-card">
            <div className="card-icon">
              <i className="fas fa-trophy"></i>
            </div>
            <div className="card-content">
              <h3>{formatValue(stats.best.value)}</h3>
              <p>Mejor: {stats.best.label}</p>
            </div>
          </div>

          <div className="indicator-card">
            <div className="card-icon">
              <i className="fas fa-arrow-down"></i>
            </div>
            <div className="card-content">
              <h3>{formatValue(stats.worst.value)}</h3>
              <p>Más Bajo: {stats.worst.label}</p>
            </div>
          </div>

          <div className="indicator-card">
            <div className="card-icon">
              <i className="fas fa-chart-line"></i>
            </div>
            <div className="card-content">
              <h3>{formatValue(stats.average)}</h3>
              <p>Promedio General</p>
            </div>
          </div>

          <div className="indicator-card">
            <div className="card-icon">
              <i className={`fas fa-${stats.improvement >= 0 ? 'trending-up' : 'trending-down'}`}></i>
            </div>
            <div className="card-content">
              <h3>{stats.improvement.toFixed(1)}%</h3>
              <p>Variación</p>
            </div>
          </div>
        </StatCardGrid>
      )}

      {/* Filter Panel */}
      <div className="no-print">
        <FilterPanel
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
        >
          {/* Comparison Type */}
          <div className="form-group">
              <label htmlFor="comparisonType">
                <i className="fas fa-tasks"></i> Tipo de Comparación
              </label>
              <select
                id="comparisonType"
                value={comparisonType}
                onChange={(e) => setComparisonType(e.target.value)}
              >
                <option value="notas">Logro Académico (L/NL/OD/NT)</option>
                <option value="asistencia">Asistencia</option>
                <option value="materiales" disabled>Materiales Entregados (próximamente)</option>
              </select>
            </div>

            {/* Compare By */}
            <div className="form-group">
              <label htmlFor="compareBy">
                <i className="fas fa-exchange-alt"></i> Comparar Por
              </label>
              <select
                id="compareBy"
                value={compareBy}
                onChange={(e) => setCompareBy(e.target.value)}
              >
                <option value="curso">Curso</option>
                <option value="asignatura">Asignatura</option>
                <option value="periodo" disabled>Período (próximamente)</option>
              </select>
            </div>

            {/* Multi-Select Cursos or Asignaturas */}
            {compareBy === 'curso' ? (
              <MultiSelect
                id="cursos"
                label="Seleccionar Cursos"
                options={cursos}
                value={selectedCursos}
                onChange={setSelectedCursos}
                loading={isLoadingCursos}
              />
            ) : (
              <MultiSelect
                id="asignaturas"
                label="Seleccionar Asignaturas"
                options={asignaturas}
                value={selectedAsignaturas}
                onChange={setSelectedAsignaturas}
                loading={isLoadingAsignaturas}
              />
            )}

            {/* Period */}
            <div className="form-group">
              <label htmlFor="periodo">
                <i className="fas fa-calendar"></i> Período
              </label>
              <select
                id="periodo"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              >
                <option value="">Todo el año</option>
                <option value="1">Primer Semestre</option>
                <option value="2">Segundo Semestre</option>
                <option value="trimestre1">Trimestre 1</option>
                <option value="trimestre2">Trimestre 2</option>
                <option value="trimestre3">Trimestre 3</option>
              </select>
            </div>

            {/* Fila 2 */}
            {/* Multi-Select Asignaturas opcional (solo cuando compareBy === 'curso' y comparisonType === 'notas') */}
            {compareBy === 'curso' && comparisonType === 'notas' ? (
              <MultiSelect
                id="asignaturas"
                label="Seleccionar Asignaturas (opcional)"
                options={asignaturas}
                value={selectedAsignaturas}
                onChange={setSelectedAsignaturas}
                loading={isLoadingAsignaturas}
              />
            ) : (
              <div />
            )}

            {/* Date Range - Desde */}
            <div className="form-group">
              <label htmlFor="startDate">
                <i className="fas fa-calendar-alt"></i> Desde
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* Date Range - Hasta */}
            <div className="form-group">
              <label htmlFor="endDate">
                <i className="fas fa-calendar-check"></i> Hasta
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
        </FilterPanel>
      </div>

      {/* Action Bar */}
      {!isLoading && !isError && chartData.length > 0 && (
        <div className="no-print">
          <ActionBar count={`${chartData.length} elementos`}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Chart Type Toggle */}
              <div style={{ display: 'flex', gap: '5px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <button
                  className={`btn btn-sm ${chartType === 'bar' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setChartType('bar')}
                  title="Vista de barras"
                  style={{ borderRadius: 0 }}
                >
                  <i className="fas fa-chart-bar"></i>
                </button>
                <button
                  className={`btn btn-sm ${chartType === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setChartType('table')}
                  title="Vista de tabla"
                  style={{ borderRadius: 0 }}
                >
                  <i className="fas fa-table"></i>
                </button>
              </div>

              {/* Export Buttons */}
              <button
                className="btn btn-success"
                onClick={handleExportCSV}
              >
                <i className="fas fa-file-csv"></i>
                <span>Exportar CSV</span>
              </button>
              <button
                className="btn btn-danger"
                onClick={handleExportPDF}
              >
                <i className="fas fa-file-pdf"></i>
                <span>Exportar PDF</span>
              </button>
            </div>
          </ActionBar>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#667eea' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Generando reporte comparativo...</h3>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#e53e3e' }}></i>
          <h3 style={{ marginTop: '20px', color: '#666' }}>Error al cargar el reporte</h3>
          <p style={{ color: '#999', marginTop: '10px' }}>
            {error?.message || 'Ha ocurrido un error inesperado'}
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '20px' }}
            onClick={() => refetch()}
          >
            <i className="fas fa-redo"></i>
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && chartData.length === 0 && (
        <EmptyStateCard
          icon="fa-chart-bar"
          title={
            (compareBy === 'curso' && selectedCursos.length === 0) ||
            (compareBy === 'asignatura' && selectedAsignaturas.length === 0)
              ? "Selecciona filtros para comenzar"
              : "No hay datos para comparar"
          }
          description={
            (compareBy === 'curso' && selectedCursos.length === 0)
              ? "Selecciona al menos un curso y haz clic en 'Aplicar Filtros' para generar el reporte"
              : (compareBy === 'asignatura' && selectedAsignaturas.length === 0)
              ? "Selecciona al menos una asignatura y haz clic en 'Aplicar Filtros' para generar el reporte"
              : "Los filtros seleccionados no generaron resultados. Intenta con otros criterios."
          }
          iconColor="#667eea"
        />
      )}

      {/* Chart Visualization */}
      {!isLoading && !isError && chartData.length > 0 && (
        <>
          {/* Bar Chart */}
          {chartType === 'bar' && (
            <div className="card">
              <h3 style={{ marginBottom: '30px' }}>
                <i className="fas fa-chart-bar"></i> Comparación por {compareBy}
              </h3>
              <div style={{ padding: '20px 0' }}>
                <BarChart data={chartData} formatValue={formatValue} />
              </div>
            </div>
          )}

          {/* Table View */}
          {chartType === 'table' && (
            <div className="card">
              <h3 style={{ marginBottom: '20px' }}>
                <i className="fas fa-table"></i> Vista Detallada
              </h3>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Posición</th>
                      <th>Nombre</th>
                      <th>Valor</th>
                      <th>Cantidad</th>
                      <th>Distribución</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData
                      .sort((a, b) => b.value - a.value)
                      .map((item, index) => (
                        <tr key={index}>
                          <td>
                            <strong>{index + 1}</strong>
                          </td>
                          <td>{item.label}</td>
                          <td>
                            <strong style={{ color: item.color }}>
                              {formatValue(item.value)}
                            </strong>
                          </td>
                          <td>{item.count}</td>
                          <td style={{ fontSize: '12px' }}>
                            {item.distribucionPorcentual && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {comparisonType === 'notas' && item.distribucion && (
                                  <>
                                    <span style={{ color: '#48bb78' }}>L: {item.distribucionPorcentual.L}</span>
                                    <span style={{ color: '#ed8936' }}>OD: {item.distribucionPorcentual.OD}</span>
                                    <span style={{ color: '#e53e3e' }}>NL: {item.distribucionPorcentual.NL}</span>
                                    <span style={{ color: '#999' }}>NT: {item.distribucionPorcentual.NT}</span>
                                  </>
                                )}
                                {comparisonType === 'asistencia' && item.distribucion && (
                                  <>
                                    <span style={{ color: '#48bb78' }}>P: {item.distribucionPorcentual.presente}</span>
                                    <span style={{ color: '#e53e3e' }}>A: {item.distribucionPorcentual.ausente}</span>
                                    <span style={{ color: '#ed8936' }}>R: {item.distribucionPorcentual.atrasado}</span>
                                    <span style={{ color: '#667eea' }}>J: {item.distribucionPorcentual.justificado}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: `${item.color}20`,
                                color: item.color
                              }}
                            >
                              {item.value >= stats.average ? 'Sobre promedio' : 'Bajo promedio'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Print Summary */}
          {showPrintView && (
            <div className="card" style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '20px' }}>Resumen del Reporte</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <div>
                  <p><strong>Tipo de Comparación:</strong> {comparisonType}</p>
                  <p><strong>Comparar Por:</strong> {compareBy}</p>
                  <p><strong>Período:</strong> {periodo || 'Todo el año'}</p>
                </div>
                <div>
                  <p><strong>Fecha de Generación:</strong> {formatDate(new Date())}</p>
                  <p><strong>Total de Elementos:</strong> {chartData.length}</p>
                  <p><strong>Promedio General:</strong> {formatValue(stats.average)}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ==========================================
// CHART COMPONENTS
// ==========================================

/**
 * Bar Chart Component
 */
function BarChart({ data, formatValue }) {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {data.map((item, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Label */}
          <div style={{ width: '150px', fontWeight: '600', fontSize: '14px', textAlign: 'right' }}>
            {item.label}
          </div>

          {/* Bar */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div
              style={{
                height: '40px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color,
                  transition: 'width 0.5s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '10px'
                }}
              >
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                  {formatValue(item.value)}
                </span>
              </div>
            </div>
          </div>

          {/* Count */}
          <div style={{ width: '80px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
            ({item.count})
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * MultiSelect Component - Dropdown style with checkboxes
 * Similar behavior to native select but supports multiple selection
 */
function MultiSelect({ id, label, options, value, onChange, loading }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Helper to get displayable text from option (string or object)
  const getOptionText = (option) => {
    return typeof option === 'string' ? option : option.nombre;
  };

  // Helper to get option value (string or object codigo)
  const getOptionValue = (option) => {
    return typeof option === 'string' ? option : option.codigo;
  };

  // Get display text for selected items
  const getDisplayText = () => {
    if (value.length === 0) return 'Selecciona una o más opciones';

    // Find matching options to display their names
    const displayItems = value.map(val => {
      const matchingOption = options.find(opt => getOptionValue(opt) === val);
      return matchingOption ? getOptionText(matchingOption) : val;
    });

    if (displayItems.length === 1) return displayItems[0];
    if (displayItems.length === 2) return `${displayItems[0]}, ${displayItems[1]}`;
    return `${displayItems[0]}, ${displayItems[1]}, +${displayItems.length - 2} más`;
  };

  return (
    <div className="form-group" style={{ position: 'relative' }} ref={dropdownRef}>
      <label htmlFor={id}>
        <i className={label.includes('Curso') ? 'fas fa-users-class' : 'fas fa-book'}></i> {label} {loading && <i className="fas fa-spinner fa-spin"></i>}
      </label>

      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '10px 35px 10px 12px',
          backgroundColor: '#fff',
          cursor: 'pointer',
          position: 'relative',
          minHeight: '42px',
          display: 'flex',
          alignItems: 'center',
          transition: 'border-color 0.2s',
          borderColor: isOpen ? '#667eea' : '#ddd'
        }}
      >
        <span style={{
          fontSize: '14px',
          color: value.length === 0 ? '#999' : '#333',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {getDisplayText()}
        </span>

        {/* Dropdown Arrow */}
        <i
          className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#999',
            fontSize: '12px'
          }}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: '#fff',
          border: '1px solid #ddd',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {options.length === 0 ? (
            <div style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '20px 10px' }}>
              No hay opciones disponibles
            </div>
          ) : (
            options.map((option) => {
              const optionValue = getOptionValue(option);
              const optionText = getOptionText(option);
              const isChecked = value.includes(optionValue);

              return (
                <label
                  key={optionValue}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    transition: 'background-color 0.2s',
                    backgroundColor: isChecked ? '#f3f4f6' : 'transparent',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isChecked) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isChecked) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([...value, optionValue]);
                      } else {
                        onChange(value.filter(v => v !== optionValue));
                      }
                    }}
                    style={{
                      width: '16px',
                      height: '16px',
                      flexShrink: 0,
                      cursor: 'pointer',
                      margin: 0
                    }}
                  />
                  <span style={{
                    fontSize: '14px',
                    color: '#333',
                    flex: 1,
                    userSelect: 'none',
                    lineHeight: '1.4'
                  }}>{optionText}</span>
                </label>
              );
            })
          )}
        </div>
      )}

      {/* Helper Text */}
      <small style={{ color: '#666', fontSize: '11px', marginTop: '4px', display: 'block' }}>
        {value.length > 0 ? `${value.length} seleccionado(s)` : 'Haz clic para seleccionar'}
      </small>
    </div>
  );
}

export default Comparativo;
