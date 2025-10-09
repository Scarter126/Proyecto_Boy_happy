/**
 * Utils Store - Wrapper para window.Constants + window.Helpers
 *
 * Responsabilidad:
 * - Exponer funciones de Constants y Helpers como Alpine store
 * - Seguir el mismo patrón que auth.js (wrapper sobre global utility)
 */

document.addEventListener('alpine:init', () => {
  Alpine.store('utils', {
    // Constants (colores, textos, etc)
    ...window.Constants,
    // Helpers (formatDate, etc)
    ...window.Helpers
  });
});

console.log('✅ store/utils.js cargado');
