/**
 * Stores Index - Exportación centralizada de todos los stores
 *
 * USAGE:
 * ```jsx
 * // Importar todos los stores
 * import { useAuthStore, useUIStore, useMenuStore, useConfigStore } from './';
 *
 * // O importar individualmente
 * import useAuthStore from './authStore';
 * ```
 */

export { default as useAuthStore } from './authStore';
export { default as useUIStore } from './uiStore';
export { default as useMenuStore } from './menuStore';
export { default as useConfigStore } from './configStore';
