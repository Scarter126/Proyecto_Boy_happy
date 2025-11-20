import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook, customMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

export const useEventos = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `/eventos?${params}` : '/eventos';

  return useQuery({
    queryKey: ['eventos', filters],
    queryFn: () => apiClient.get(url),
    staleTime: 5 * 60 * 1000,
  });
};

export const useEvento = (id) => {
  return useQuery({
    queryKey: ['eventos', id],
    queryFn: () => apiClient.get(`/eventos?id=${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

export const useCreateEvento = createMutationHook(
  '/eventos',
  'evento',
  'eventos'
);

export const useUpdateEvento = customMutationHook(
  ({ id, ...data }) => apiClient.put(`/eventos?id=${id}`, data),
  'eventos',
  { success: 'Evento actualizado correctamente', error: 'Error al actualizar evento' }
);

export const useDeleteEvento = customMutationHook(
  (id) => apiClient.delete(`/eventos?id=${id}`),
  'eventos',
  { success: 'Evento eliminado', error: 'Error al eliminar evento' }
);
