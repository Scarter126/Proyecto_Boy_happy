/**
 * useInformes - React Query hooks para informes fonoaudiológicos
 * Migrado a factory pattern
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook, customMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

export const useInformesFono = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `/informes?${params}` : '/informes';

  return useQuery({
    queryKey: ['informes', filters],
    queryFn: () => apiClient.get(url),
    staleTime: 5 * 60 * 1000,
  });
};

export const useInformeFono = (id) => {
  return useQuery({
    queryKey: ['informes', id],
    queryFn: () => apiClient.get(`/informes?id=${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

export const useCreateInformeFono = createMutationHook(
  '/informes',
  'informe',
  'informes',
  { successMessage: 'Informe creado correctamente' }
);

export const useUpdateInformeFono = customMutationHook(
  ({ id, ...data }) => apiClient.put(`/informes?id=${id}`, data),
  'informes',
  { success: 'Informe actualizado', error: 'Error al actualizar informe' }
);

export const useDeleteInformeFono = customMutationHook(
  (id) => apiClient.delete(`/informes?id=${id}`),
  'informes',
  { success: 'Informe eliminado', error: 'Error al eliminar informe' }
);
