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
const StatCardGrid = ({ stats = [], children }) => {

  const content =
    children ||
    (stats.length > 0
      ? stats.map((s, i) => (
          <div
            key={i}
            style={{
              background: '#fff',
              padding: '1.5rem',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              borderLeft: `6px solid ${s.color}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className={`fas ${s.icon}`} style={{ fontSize: '20px', color: s.color }} />
              <span style={{ fontSize: '14px', color: '#666' }}>{s.title}</span>
            </div>
            <strong style={{ fontSize: '28px', color: '#333' }}>{s.value}</strong>
          </div>
        ))
      : (
          <p
            style={{
              textAlign: 'center',
              color: '#999',
              padding: '2.5rem',
              gridColumn: '1 / -1',
            }}
          >
            No hay indicadores configurados
          </p>
        ));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem',
      }}
    >
      {content}
    </div>
  );
};

export default StatCardGrid;
