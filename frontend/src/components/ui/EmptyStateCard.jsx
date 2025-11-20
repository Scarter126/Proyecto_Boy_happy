/**
 * EmptyStateCard Component
 *
 * Card to display when there is no data
 * Used in: all sections with listings
 *
 * @param {Object} props
 * @param {string} [props.icon='fa-inbox'] - FontAwesome icon class
 * @param {string} [props.title='No hay datos'] - Empty state title
 * @param {string} [props.description] - Optional description text
 * @param {string} [props.iconColor='#cbd5e1'] - Icon color (hex or CSS color)
 * @param {string} [props.actionText] - Optional action button text
 * @param {Function} [props.onAction] - Action button click handler
 *
 * @example
 * <EmptyStateCard
 *   icon="fa-users"
 *   title="No hay usuarios registrados"
 *   description="Comienza agregando tu primer usuario al sistema"
 *   iconColor="#667eea"
 *   actionText="Agregar Usuario"
 *   onAction={() => abrirModalUsuario()}
 * />
 */
const EmptyStateCard = ({
  icon = 'fa-inbox',
  title = 'No hay datos',
  description = '',
  iconColor = '#cbd5e1',
  actionText = '',
  onAction = null
}) => {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
      <i
        className={`fas fa-3x ${icon}`}
        style={{ color: iconColor }}
      ></i>

      <h3 style={{ marginTop: '20px', color: '#666' }}>
        {title}
      </h3>

      {description && (
        <p
          style={{
            color: '#999',
            marginTop: '10px',
            fontSize: '0.95em',
            maxWidth: '500px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          {description}
        </p>
      )}

      {actionText && (
        <button
          className="btn btn-primary"
          style={{ marginTop: '20px' }}
          onClick={onAction}
        >
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
};

export default EmptyStateCard;
