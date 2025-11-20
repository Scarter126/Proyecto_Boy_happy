/**
 * ActionBar Component
 *
 * Action bar with common buttons (create, export, filter)
 * Used in: all sections with listings
 *
 * @param {Object} props
 * @param {number|string} [props.count] - Optional item count to display
 * @param {React.ReactNode} props.children - Action buttons to render
 *
 * @example
 * <ActionBar count={25}>
 *   <button className="btn btn-primary" onClick={crearNuevo}>
 *     <i className="fas fa-plus"></i> Crear
 *   </button>
 *   <button className="btn btn-success" onClick={exportar}>
 *     <i className="fas fa-download"></i> Exportar
 *   </button>
 * </ActionBar>
 */
const ActionBar = ({ count = '', children }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}
    >
      {/* Left side: Title or counter */}
      <div>
        {count && (
          <h3 style={{ margin: 0, color: '#666' }}>
            Total: {count}
          </h3>
        )}
      </div>

      {/* Right side: Action buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {children}
      </div>
    </div>
  );
};

export default ActionBar;
