import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook, customMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

export const useAsistencia = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `/asistencia?${params}` : '/asistencia';

  return useQuery({
    queryKey: ['asistencia', filters],
    queryFn: () => apiClient.get(url),
    staleTime: 0, // Always fresh
  });
};

export const useAsistenciaAlumno = (rutAlumno) => {
  return useQuery({
    queryKey: ['asistencia', rutAlumno],
    queryFn: () => apiClient.get(`/asistencia?rutAlumno=${rutAlumno}`),
    enabled: !!rutAlumno,
    staleTime: 1 * 60 * 1000,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

export const useRegistrarAsistencia = createMutationHook(
  '/asistencia',
  'asistencia',
  'asistencia',
  { successMessage: 'Asistencia registrada correctamente' }
);

export const useActualizarAsistencia = customMutationHook(
  ({ id, ...data }) => apiClient.put(`/asistencia?id=${id}`, data),
  'asistencia',
  { success: 'Asistencia actualizada', error: 'Error al actualizar asistencia' }
);

export const useDeleteAsistencia = customMutationHook(
  (id) => apiClient.delete(`/asistencia?id=${id}`),
  'asistencia',
  { success: 'Registro de asistencia eliminado', error: 'Error al eliminar registro' }
);
