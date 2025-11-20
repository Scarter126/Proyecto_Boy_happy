/**
 * ConfigListManager - Componente reutilizable para gestionar listas de configuración
 *
 * Maneja CRUD completo para configuraciones de lista genéricas:
 * - Agregar items con múltiples campos
 * - Editar items existentes
 * - Eliminar items con confirmación
 * - Validación de formularios
 * - Estados de carga
 * - Notificaciones
 *
 * @component
 * @example
 * ```jsx
 * <ConfigListManager
 *   configKey="categorias-materiales"
 *   title="Categorías de Materiales"
 *   icon="fa-calculator"
 *   color="#667eea"
 *   useHook={useCategoriaMateriales}
 *   formFields={[
 *     { name: 'value', label: 'Código', type: 'text', required: true },
 *     { name: 'label', label: 'Nombre', type: 'text', required: true },
 *     { name: 'icon', label: 'Ícono FontAwesome', type: 'text', placeholder: 'fa-calculator' }
 *   ]}
 * />
 * ```
 */

import { useState, useEffect } from 'react';
import { useUpdateConfiguracion } from '../../hooks/useConfiguracion';
import Swal from 'sweetalert2';

/**
 * @param {Object} props
 * @param {string} props.configKey - Clave de configuración en DynamoDB
 * @param {string} props.title - Título de la sección
 * @param {string} props.icon - Ícono FontAwesome (ej: 'fa-calculator')
 * @param {string} props.color - Color principal de la sección (hex)
 * @param {Function} props.useHook - Hook de React Query para obtener datos
 * @param {Array} props.formFields - Configuración de campos del formulario
 * @param {string} [props.description] - Descripción opcional de la sección
 */
export default function ConfigListManager({
  configKey,
  title,
  icon,
  color,
  useHook,
  formFields,
  description
}) {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [formData, setFormData] = useState({});
  const [editingValue, setEditingValue] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [localItems, setLocalItems] = useState([]);

  // ==========================================
  // REACT QUERY HOOKS
  // ==========================================

  const { data: items = [], isLoading, refetch } = useHook();
  const updateMutation = useUpdateConfiguracion();

  // ==========================================
  // EFFECTS
  // ==========================================

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Initialize form data with empty values
  useEffect(() => {
    const initialFormData = {};
    formFields.forEach(field => {
      initialFormData[field.name] = '';
    });
    setFormData(initialFormData);
  }, [formFields]);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const isSaving = updateMutation.isPending;

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  const handleFormChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleEditFormChange = (fieldName, value) => {
    setEditFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const validateForm = (data) => {
    for (const field of formFields) {
      if (field.required && !data[field.name]) {
        Swal.fire({
          icon: 'warning',
          title: 'Campo requerido',
          text: `El campo "${field.label}" es obligatorio`
        });
        return false;
      }
    }
    return true;
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!validateForm(formData)) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        key: configKey,
        action: 'add',
        item: { ...formData }
      });

      // Clear form
      const emptyForm = {};
      formFields.forEach(field => {
        emptyForm[field.name] = '';
      });
      setFormData(emptyForm);

      // Refetch data
      refetch();

      Swal.fire({
        icon: 'success',
        title: 'Item agregado',
        text: `${formData.label || 'El item'} ha sido agregado correctamente`,
        timer: 2000
      });
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleEdit = (item) => {
    setEditingValue(item.value);
    setEditFormData({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingValue(null);
    setEditFormData({});
  };

  const handleSaveEdit = async (originalValue) => {
    if (!validateForm(editFormData)) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        key: configKey,
        action: 'update',
        value: originalValue,
        nuevoItem: { ...editFormData }
      });

      // Clear edit state
      setEditingValue(null);
      setEditFormData({});

      // Refetch data
      refetch();

      Swal.fire({
        icon: 'success',
        title: 'Item actualizado',
        text: 'El item ha sido actualizado correctamente',
        timer: 2000
      });
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleRemove = async (value, label) => {
    const result = await Swal.fire({
      title: '¿Eliminar item?',
      html: `<p>¿Estás seguro de eliminar <strong>${label || value}</strong>?</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await updateMutation.mutateAsync({
          key: configKey,
          action: 'remove',
          value: value
        });

        // Refetch data
        refetch();
      } catch (error) {
        console.error('Error removing item:', error);
      }
    }
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const renderFormField = (field, data, onChange) => {
    const value = data[field.name] || '';

    return (
      <div key={field.name} className="form-group" style={{ flex: field.flex || '1 1 200px' }}>
        <label htmlFor={`${configKey}-${field.name}`}>
          {field.icon && <i className={`fas ${field.icon}`}></i>} {field.label}
          {field.required && <span style={{ color: 'red' }}> *</span>}
        </label>
        <input
          id={`${configKey}-${field.name}`}
          type={field.type || 'text'}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder || ''}
          maxLength={field.maxLength}
        />
        {field.help && (
          <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
            {field.help}
          </small>
        )}
      </div>
    );
  };

  const renderItemCard = (item) => {
    const isEditing = editingValue === item.value;
    const displayLabel = item.label || item.value;

    return (
      <div
        key={item.value}
        style={{
          padding: '15px',
          backgroundColor: isEditing ? `${color}15` : '#f7fafc',
          borderRadius: '8px',
          border: isEditing ? `2px solid ${color}` : '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!isEditing) {
            e.currentTarget.style.borderColor = color;
            e.currentTarget.style.backgroundColor = `${color}10`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isEditing) {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.backgroundColor = '#f7fafc';
          }
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {/* Icon preview if exists */}
            {item.icon && !isEditing && (
              <i className={`fas ${item.icon}`} style={{ color: color, marginRight: '8px', fontSize: '16px' }}></i>
            )}

            {/* Value badge */}
            {!isEditing && (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                backgroundColor: `${color}20`,
                color: color,
                borderRadius: '4px',
                fontWeight: 'bold',
                marginRight: '8px'
              }}>
                {item.value}
              </span>
            )}

            {/* Edit mode or display mode */}
            {isEditing ? (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {formFields.map(field => (
                  <div key={field.name}>
                    <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
                      {field.label}
                    </label>
                    <input
                      type={field.type || 'text'}
                      value={editFormData[field.name] || ''}
                      onChange={(e) => handleEditFormChange(field.name, e.target.value)}
                      placeholder={field.placeholder || ''}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '14px',
                        border: '1px solid #cbd5e0',
                        borderRadius: '4px',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = color}
                      onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#4a5568', fontSize: '14px', fontWeight: '500' }}>
                {displayLabel}
              </div>
            )}

            {/* Color preview if exists */}
            {item.color && !isEditing && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: item.color,
                  border: '1px solid #e2e8f0'
                }}></div>
                <span style={{ fontSize: '12px', color: '#718096' }}>{item.color}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isEditing && (
            <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
              <button
                className="btn btn-sm btn-info"
                onClick={() => handleEdit(item)}
                disabled={isSaving || editingValue !== null}
                title="Editar item"
                style={{ padding: '4px 8px' }}
              >
                <i className="fas fa-edit"></i>
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleRemove(item.value, item.label)}
                disabled={isSaving || editingValue !== null}
                title="Eliminar item"
                style={{ padding: '4px 8px' }}
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          )}
        </div>

        {/* Edit mode action buttons */}
        {isEditing && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleCancelEdit}
              disabled={isSaving}
              style={{ padding: '4px 12px' }}
            >
              <i className="fas fa-times"></i>
              <span style={{ marginLeft: '4px' }}>Cancelar</span>
            </button>
            <button
              className="btn btn-sm btn-success"
              onClick={() => handleSaveEdit(item.value)}
              disabled={isSaving}
              style={{ padding: '4px 12px' }}
            >
              {isSaving ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-check"></i>
              )}
              <span style={{ marginLeft: '4px' }}>Guardar</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="card">
      {/* Section Header */}
      <div style={{ borderBottom: `2px solid ${color}`, paddingBottom: '15px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className={`fas ${icon}`} style={{ color: color }}></i>
          {title}
        </h2>
        {description && (
          <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
            {description}
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <i className="fas fa-spinner fa-spin fa-2x" style={{ color: color }}></i>
          <p style={{ marginTop: '15px', color: '#666' }}>Cargando...</p>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && (
        <>
          {/* Add Form */}
          <form onSubmit={handleAdd} style={{ marginBottom: '30px' }}>
            <div className="form-row" style={{ flexWrap: 'wrap' }}>
              {formFields.map(field => renderFormField(field, formData, handleFormChange))}

              <div className="form-group" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn"
                  style={{ backgroundColor: color, color: 'white' }}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fas fa-plus"></i>
                  )}
                  <span>Agregar</span>
                </button>
              </div>
            </div>
          </form>

          {/* Items List */}
          <div>
            <h3 style={{ marginBottom: '15px', color: '#555', fontSize: '16px' }}>
              <i className="fas fa-list"></i> Items Registrados ({localItems.length})
            </h3>

            {localItems.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                backgroundColor: `${color}10`,
                borderRadius: '8px',
                border: `2px dashed ${color}40`
              }}>
                <i className={`fas ${icon} fa-3x`} style={{ color: `${color}60`, marginBottom: '15px' }}></i>
                <p style={{ color: color, margin: 0 }}>No hay items registrados</p>
                <p style={{ color: `${color}90`, fontSize: '14px', margin: '5px 0 0 0' }}>
                  Agrega el primer item usando el formulario de arriba
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '15px'
              }}>
                {localItems.map(item => renderItemCard(item))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
