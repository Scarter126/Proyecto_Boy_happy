/**
 * Hook para gestionar profesionales
 *
 * Features:
 * - Carga lista de profesionales
 * - Cache de 1 hora para reducir peticiones
 */

import { useQuery } from '@tanstack/react-query';
import { getApiConfig } from '../stores/configStore';

const { baseURL: API_URL } = getApiConfig();

/**
 * Hook para obtener todos los profesionales
 * Cache: 1 hora
 */
export const useProfesionales = () => {
  return useQuery({
    queryKey: ['profesionales'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/profesionales`);
      if (!response.ok) {
        throw new Error('Error al cargar profesionales');
      }
      const result = await response.json();
      return result.data || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hora
    gcTime: 60 * 60 * 1000, // 1 hora
    refetchOnWindowFocus: false,
  });
};
