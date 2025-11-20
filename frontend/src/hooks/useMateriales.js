import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook, customMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

export const useMateriales = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `/materiales?${params}` : '/materiales';

  return useQuery({
    queryKey: ['materiales', filters],
    queryFn: () => apiClient.get(url).then(data => data.materiales || data),
    staleTime: 5 * 60 * 1000,
  });
};

export const useMaterial = (id) => {
  return useQuery({
    queryKey: ['materiales', id],
    queryFn: () => apiClient.get(`/materiales?id=${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

/**
 * Hook para crear/subir material
 */
export const useCreateMaterial = createMutationHook(
  '/materiales',
  'material',
  'materiales',
  { successMessage: 'Material subido correctamente' }
);

/**
 * Hook para actualizar material
 */
export const useUpdateMaterial = customMutationHook(
  ({ id, ...data }) => apiClient.put(`/materiales?id=${id}`, data),
  'materiales',
  { success: 'Material actualizado', error: 'Error al actualizar material' }
);

/**
 * Hook para eliminar material
 */
export const useDeleteMaterial = customMutationHook(
  (id) => apiClient.delete(`/materiales?id=${id}`),
  'materiales',
  { success: 'Material eliminado', error: 'Error al eliminar material' }
);

/**
 * Hook para aprobar material
 */
export const useAprobarMaterial = customMutationHook(
  ({ id, revisadoPor, observaciones }) =>
    apiClient.put(`/materiales/aprobar?id=${id}`, { revisadoPor, observaciones }),
  'materiales',
  { success: 'Material aprobado correctamente', error: 'Error al aprobar material' }
);

/**
 * Hook para rechazar material
 */
export const useRechazarMaterial = customMutationHook(
  ({ id, revisadoPor, motivo }) =>
    apiClient.put(`/materiales/rechazar?id=${id}`, { revisadoPor, motivo }),
  'materiales',
  { success: 'Material rechazado', error: 'Error al rechazar material' }
);

/**
 * Hook para solicitar corrección de material
 */
export const useSolicitarCorreccionMaterial = customMutationHook(
  ({ id, revisadoPor, observaciones }) =>
    apiClient.put(`/materiales/corregir?id=${id}`, { revisadoPor, observaciones }),
  'materiales',
  { success: 'Corrección solicitada', error: 'Error al solicitar corrección' }
);
