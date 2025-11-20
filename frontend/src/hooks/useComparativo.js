/**
 * useComparativo - React Query hooks para reportes comparativos
 *
 * Hooks para gestionar reportes comparativos del sistema
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';

/**
 * Hook para obtener datos comparativos
 * @param {Object} params - Parámetros opcionales para filtrar el reporte
 * @param {Object} options - Opciones adicionales de React Query
 */
export const useComparativo = (params = {}, options = {}) => {
  // Deshabilitar auto-fetch: solo ejecutar cuando se haga clic en "Aplicar Filtros"
  // Se requiere al menos un curso o asignatura para ejecutar la query
  const hasRequiredFilters =
    (params.compareBy === 'curso' && params.cursos && params.cursos.length > 0) ||
    (params.compareBy === 'asignatura' && params.asignaturas && params.asignaturas.length > 0);

  console.log('🎯 [useComparativo] Hook invoked:', {
    params,
    hasRequiredFilters,
    enabled: hasRequiredFilters && (options.enabled !== false)
  });

  return useQuery({
    queryKey: ['comparativo', params],
    queryFn: async () => {
      console.log('🌐 [useComparativo] Making API request to /comparativo with params:', params);
      try {
        const response = await apiClient.get('/comparativo', { params });
        console.log('✅ [useComparativo] API response received:', response);
        return response;
      } catch (error) {
        console.error('❌ [useComparativo] API request failed:', error);
        throw error;
      }
    },
    enabled: hasRequiredFilters && (options.enabled !== false),
    ...options
  });
};
