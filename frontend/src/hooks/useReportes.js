/**
 * useReportes - React Query hooks para reportes fonoaudiológicos
 * Migrado a factory pattern
 *
 * Hooks para gestionar reportes y estadísticas del fonoaudiólogo
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

/**
 * Hook para obtener lista de reportes
 */
export const useReportes = (filters = {}) => {
  return useQuery({
    queryKey: ['reportes', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters).toString();
      return apiClient.get(`/reportes${params ? `?${params}` : ''}`);
    },
  });
};

/**
 * Hook para obtener un reporte específico
 */
export const useReporte = (reporteId) => {
  return useQuery({
    queryKey: ['reporte', reporteId],
    queryFn: () => apiClient.get(`/reportes/${reporteId}`),
    enabled: !!reporteId,
  });
};

/**
 * Hook para obtener reportes por alumno
 */
export const useReportesAlumno = (alumnoId) => {
  return useQuery({
    queryKey: ['reportes', 'alumno', alumnoId],
    queryFn: () => apiClient.get(`/reportes?alumnoId=${alumnoId}`),
    enabled: !!alumnoId,
  });
};

/**
 * Hook para exportar reporte
 */
export const useExportReporte = (reporteId, format = 'pdf') => {
  return useQuery({
    queryKey: ['reporte', 'export', reporteId, format],
    queryFn: () => apiClient.get(`/exportar-reportes?reporteId=${reporteId}&format=${format}`),
    enabled: !!reporteId,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

/**
 * Hook para generar un reporte
 */
export const useGenerateReporte = createMutationHook(
  '/reportes',
  'reporte',
  'reportes',
  { successMessage: 'Reporte generado correctamente' }
);
