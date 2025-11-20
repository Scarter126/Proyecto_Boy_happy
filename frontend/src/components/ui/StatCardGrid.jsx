/**
 * StatCardGrid Component
 *
 * Responsive grid to display 3-4 statistics cards
 * Used in: dashboard, asistencia, materiales
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Stat cards to render
 *
 * @example
 * <StatCardGrid>
 *   <div className="indicator-card">
 *     <h3>250</h3>
 *     <p>Total Usuarios</p>
 *   </div>
 *   <div className="indicator-card">
 *     <h3>85%</h3>
 *     <p>Asistencia</p>
 *   </div>
 *   <div className="indicator-card">
 *     <h3>42</h3>
 *     <p>Materiales</p>
 *   </div>
 * </StatCardGrid>
 */
const StatCardGrid = ({ children }) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      {children || (
        <p style={{
          textAlign: 'center',
          color: '#999',
          padding: '2.5rem',
          gridColumn: '1 / -1'
        }}>
          No hay indicadores configurados
        </p>
      )}
    </div>
  );
};

export default StatCardGrid;
