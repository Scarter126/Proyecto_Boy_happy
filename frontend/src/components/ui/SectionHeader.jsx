/**
 * SectionHeader Component
 *
 * Section header with icon and optional action button
 * Used in: admin (9x), profesor (5x), fono (3x)
 *
 * @param {Object} props
 * @param {string} props.title - Section title text
 * @param {string} [props.icon='fa-cog'] - FontAwesome icon class (e.g., 'fa-tachometer-alt')
 * @param {string} [props.buttonText] - Optional button text (button hidden if not provided)
 * @param {string} [props.buttonIcon] - Optional button icon class
 * @param {string} [props.buttonColor='primary'] - Button color variant (primary, success, danger, etc.)
 * @param {Function} [props.onButtonClick] - Button click handler
 *
 * @example
 * <SectionHeader
 *   title="Dashboard de Indicadores"
 *   icon="fa-tachometer-alt"
 *   buttonText="Exportar"
 *   buttonIcon="fa-download"
 *   buttonColor="success"
 *   onButtonClick={() => exportarDatos()}
 * />
 */
const SectionHeader = ({
  title = 'Título',
  icon = 'fa-cog',
  buttonText = '',
  buttonIcon = '',
  buttonColor = 'primary',
  onButtonClick = null
}) => {
  return (
    <div className="content-header">
      <h1>
        <i className={`fas ${icon}`}></i>
        <span>{title}</span>
      </h1>

      {buttonText && (
        <button
          className={`btn btn-${buttonColor}`}
          onClick={onButtonClick}
        >
          {buttonIcon && <i className={`fas ${buttonIcon}`}></i>}
          <span>{buttonText}</span>
        </button>
      )}
    </div>
  );
};

export default SectionHeader;
