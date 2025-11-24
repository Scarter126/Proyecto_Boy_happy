/**
 * Hook para gestionar profesionales
 *
 * Features:
 * - Carga lista de profesionales
 * - Cache de 1 hora para reducir peticiones
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';

/**
 * Hook para obtener todos los profesionales
 * Cache: 1 hora
 */
export const useProfesionales = () => {
  return useQuery({
    queryKey: ['profesionales'],
    queryFn: async () => {
      const result = await apiClient.get('/profesionales');
      return result.data || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hora
    gcTime: 60 * 60 * 1000, // 1 hora
    refetchOnWindowFocus: false,
  });
};
