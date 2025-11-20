/**
 * useNotas - React Query hooks para gestión de notas y evaluaciones
 * Migrado a factory pattern
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook, customMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

export const useNotas = (filters = {}, options = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `/notas?${params}` : '/notas';

  return useQuery({
    queryKey: ['notas', filters],
    queryFn: async () => {
      const response = await apiClient.get(url);
      // API returns {notas: [...], total: N}, extract the notas array
      return response.notas || [];
    },
    enabled: options.enabled !== undefined ? options.enabled : true,
    staleTime: 3 * 60 * 1000,
  });
};

export const useNotasAgrupadas = (rutAlumno) => {
  return useQuery({
    queryKey: ['notas', 'agrupadas', rutAlumno],
    queryFn: () => apiClient.get(`/notas/agrupadas?rutAlumno=${rutAlumno}`),
    enabled: !!rutAlumno,
    staleTime: 5 * 60 * 1000,
  });
};

export const usePromedios = (rutAlumno) => {
  return useQuery({
    queryKey: ['notas', 'promedios', rutAlumno],
    queryFn: () => apiClient.get(`/notas/promedios?rutAlumno=${rutAlumno}`),
    enabled: !!rutAlumno,
    staleTime: 5 * 60 * 1000,
  });
};

export const useNotasPorCurso = (curso, asignatura = null) => {
  const filters = { curso };
  if (asignatura) filters.asignatura = asignatura;
  return useNotas(filters);
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

/**
 * Hook personalizado para crear notas
 * Invalida múltiples query keys relacionadas con notas
 */
export const useCreateNota = () => {
  const queryClient = useQueryClient();
  const baseMutation = createMutationHook(
    '/notas',
    'evaluación',
    'notas',
    { successMessage: 'Evaluación registrada correctamente' }
  );

  return baseMutation({
    onSuccess: () => {
      // Invalidar todas las queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['notas'] });
      queryClient.invalidateQueries({ queryKey: ['notas', 'promedios'] });
      queryClient.invalidateQueries({ queryKey: ['notas', 'agrupadas'] });
    }
  });
};

/**
 * Hook personalizado para actualizar notas
 * Invalida múltiples query keys relacionadas con notas
 */
export const useUpdateNota = () => {
  const queryClient = useQueryClient();

  return customMutationHook(
    ({ id, ...data }) => apiClient.put(`/notas?id=${id}`, data),
    null, // No invalidar automáticamente
    { success: 'Evaluación actualizada', error: 'Error al actualizar evaluación' },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['notas'] });
        queryClient.invalidateQueries({ queryKey: ['notas', 'promedios'] });
        queryClient.invalidateQueries({ queryKey: ['notas', 'agrupadas'] });
      }
    }
  )();
};

/**
 * Hook personalizado para eliminar notas
 * Invalida múltiples query keys relacionadas con notas
 */
export const useDeleteNota = () => {
  const queryClient = useQueryClient();

  return customMutationHook(
    (id) => apiClient.delete(`/notas?id=${id}`),
    null, // No invalidar automáticamente
    { success: 'Evaluación eliminada', error: 'Error al eliminar evaluación' },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['notas'] });
        queryClient.invalidateQueries({ queryKey: ['notas', 'promedios'] });
        queryClient.invalidateQueries({ queryKey: ['notas', 'agrupadas'] });
      }
    }
  )();
};
