/**
 * useAnuncios - React Query hooks para anuncios
 * Migrado a factory pattern
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { customMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

export const useAnuncios = () => {
  return useQuery({
    queryKey: ['anuncios'],
    queryFn: () => apiClient.get('/anuncios'),
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

export const useCreateAnuncio = customMutationHook(
  (data) => apiClient.post('/anuncios', data),
  'anuncios',
  { success: 'Anuncio creado correctamente', error: 'Error al crear el anuncio' }
);

export const useUpdateAnuncio = customMutationHook(
  ({ id, ...data }) => apiClient.put(`/anuncios/${id}`, data),
  'anuncios',
  { success: 'Anuncio actualizado correctamente', error: 'Error al actualizar el anuncio' }
);

export const useDeleteAnuncio = customMutationHook(
  (id) => apiClient.delete(`/anuncios/${id}`),
  'anuncios',
  { success: 'Anuncio eliminado correctamente', error: 'Error al eliminar el anuncio' }
);
