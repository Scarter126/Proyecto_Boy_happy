/**
 * FilterPanel Component
 *
 * Reusable filter panel with dynamic fields
 * Used in: matrículas, asistencia, materiales, usuarios
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Filter fields to render
 * @param {Function} props.onApplyFilters - Handler for applying filters
 * @param {Function} props.onClearFilters - Handler for clearing filters
 *
 * @example
 * <FilterPanel
 *   onApplyFilters={aplicarFiltros}
 *   onClearFilters={limpiarFiltros}
 * >
 *   <div className="form-group">
 *     <label>Curso</label>
 *     <select value={filtros.curso} onChange={handleCursoChange}>
 *       <option value="">Todos</option>
 *       <option value="1A">1° A</option>
 *     </select>
 *   </div>
 *   <div className="form-group">
 *     <label>Estado</label>
 *     <select value={filtros.estado} onChange={handleEstadoChange}>
 *       <option value="">Todos</option>
 *       <option value="activo">Activo</option>
 *     </select>
 *   </div>
 * </FilterPanel>
 */
const FilterPanel = ({
  children,
  onApplyFilters,
  onClearFilters
}) => {
  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <h3>
        <i className="fas fa-filter"></i> Filtros
      </h3>

      <div className="form-row" style={{ marginTop: '15px' }}>
        {children}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        <button className="btn btn-primary" onClick={onApplyFilters}>
          <i className="fas fa-search"></i> Aplicar Filtros
        </button>
        <button className="btn btn-secondary" onClick={onClearFilters}>
          <i className="fas fa-times"></i> Limpiar
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
