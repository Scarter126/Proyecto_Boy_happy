/**
 * Hook para gestionar noticias públicas
 *
 * Features:
 * - Carga noticias desde la API
 * - Cache de 1 hora para reducir peticiones
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';

/**
 * Hook para obtener noticias públicas
 * Cache: 1 hora
 */
export const useNoticias = () => {
  return useQuery({
    queryKey: ['noticias'],
    queryFn: async () => {
      const result = await apiClient.get('/anuncios');
      return result.data || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hora
    gcTime: 60 * 60 * 1000, // 1 hora
    refetchOnWindowFocus: false,
  });
};
