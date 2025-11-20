/**
 * Hook para gestionar noticias públicas
 *
 * Features:
 * - Carga noticias desde la API
 * - Cache de 1 hora para reducir peticiones
 */

import { useQuery } from '@tanstack/react-query';
import { getApiConfig } from '../stores/configStore';

const { baseURL: API_URL } = getApiConfig();

/**
 * Hook para obtener noticias públicas
 * Cache: 1 hora
 */
export const useNoticias = () => {
  return useQuery({
    queryKey: ['noticias'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/anuncios`);
      if (!response.ok) {
        throw new Error('Error al cargar noticias');
      }
      const result = await response.json();
      return result.data || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hora
    gcTime: 60 * 60 * 1000, // 1 hora
    refetchOnWindowFocus: false,
  });
};
