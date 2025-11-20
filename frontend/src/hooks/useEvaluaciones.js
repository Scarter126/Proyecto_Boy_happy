/**
 * useEvaluaciones - React Query hooks para evaluaciones y notas
 * Migrado a factory pattern
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

export const useEvaluaciones = (filters = {}) => {
  return useQuery({
    queryKey: ['evaluaciones', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters).toString();
      const response = await apiClient.get(`/notas${params ? `?${params}` : ''}`);
      // La API retorna {notas: [...], total: N}, extraer el array notas
      return response.data?.notas || response.notas || [];
    },
  });
};

export const useEvaluacionesAlumno = (rutAlumno) => {
  return useQuery({
    queryKey: ['evaluaciones', 'alumno', rutAlumno],
    queryFn: async () => {
      const response = await apiClient.get(`/notas?rutAlumno=${rutAlumno}`);
      // La API retorna {notas: [...], total: N}, extraer el array notas
      return response.data?.notas || response.notas || [];
    },
    enabled: !!rutAlumno,
  });
};

export const useEvaluacion = (evaluacionId) => {
  return useQuery({
    queryKey: ['evaluacion', evaluacionId],
    queryFn: () => apiClient.get(`/notas/${evaluacionId}`),
    enabled: !!evaluacionId,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

export const useCreateEvaluacion = createMutationHook(
  '/notas',
  'evaluación',
  'evaluaciones'
);
