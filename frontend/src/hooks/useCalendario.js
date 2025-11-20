/**
 * useCalendario - React Query hooks para calendario y eventos
 *
 * Hooks para gestionar eventos y actividades del calendario
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';

/**
 * Hook para obtener eventos del calendario
 */
export const useEventos = (filters = {}) => {
  return useQuery({
    queryKey: ['eventos', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters).toString();
      return apiClient.get(`/eventos${params ? `?${params}` : ''}`);
    },
  });
};

/**
 * Hook para obtener un evento específico
 */
export const useEvento = (eventoId) => {
  return useQuery({
    queryKey: ['evento', eventoId],
    queryFn: () => apiClient.get(`/eventos/${eventoId}`),
    enabled: !!eventoId,
  });
};
