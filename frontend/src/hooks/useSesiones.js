/**
 * useSesiones - React Query hooks para sesiones terapéuticas
 * Migrado a factory pattern
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook, customMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

export const useSesiones = (filters = {}) => {
  // Transform frontend filters to backend format
  const backendFilters = {};
  if (filters.alumno_id) backendFilters.rutAlumno = filters.alumno_id;
  if (filters.estado) backendFilters.estado = filters.estado;
  if (filters.fechaDesde) backendFilters.fechaInicio = filters.fechaDesde;
  if (filters.fechaHasta) backendFilters.fechaFin = filters.fechaHasta;

  const params = new URLSearchParams(backendFilters).toString();
  const url = params ? `/sesiones?${params}` : '/sesiones';

  return useQuery({
    queryKey: ['sesiones', filters],
    queryFn: async () => {
      const response = await apiClient.get(url);
      // Backend returns { sesiones: [], total: ... }, extract sesiones array
      return response.sesiones || response || [];
    },
    staleTime: 2 * 60 * 1000,
  });
};

export const useSesion = (id) => {
  return useQuery({
    queryKey: ['sesiones', id],
    queryFn: () => apiClient.get(`/sesiones?id=${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

export const useCreateSesion = customMutationHook(
  (data) => {
    // Transform frontend data to backend format
    const backendData = {
      fechaHora: `${data.fecha}T${data.hora_inicio}:00`,
      rutAlumno: data.alumno_id,
      fonoaudiologo: data.fonoaudiologo || 'sistema', // TODO: Get from auth context
      motivo: data.area || '',
      estado: data.estado || 'programada',
      actividadesRealizadas: data.actividades ? [data.actividades] : [],
      materialUtilizado: data.materiales_utilizados ? [data.materiales_utilizados] : [],
      observaciones: data.observaciones || '',
      avanceSesion: data.logros || '',
      tareasCasa: data.tareas_casa ? [data.tareas_casa] : [],
    };

    return apiClient.post('/sesiones', backendData);
  },
  'sesiones',
  { success: 'Sesión registrada correctamente', error: 'Error al registrar sesión' }
);

export const useUpdateSesion = customMutationHook(
  ({ id, ...data }) => {
    // Transform frontend data to backend format for update
    const backendData = {};

    if (data.observaciones !== undefined) backendData.observaciones = data.observaciones;
    if (data.tareas_casa) backendData.tareasCasa = [data.tareas_casa];
    if (data.actividades) backendData.actividadesRealizadas = [data.actividades];
    if (data.logros) backendData.avanceSesion = data.logros;
    if (data.estado) backendData.estado = data.estado;

    return apiClient.put(`/sesiones?id=${id}`, backendData);
  },
  'sesiones',
  { success: 'Sesión actualizada', error: 'Error al actualizar sesión' }
);

export const useDeleteSesion = customMutationHook(
  (id) => apiClient.delete(`/sesiones?id=${id}`),
  'sesiones',
  { success: 'Sesión eliminada', error: 'Error al eliminar sesión' }
);

export const useSubirArchivoSesion = customMutationHook(
  (data) => apiClient.post('/sesiones/archivos', data),
  'sesiones',
  { success: 'Archivo subido correctamente', error: 'Error al subir archivo' }
);

export const useDeleteArchivoSesionTerapeutica = customMutationHook(
  (id) => apiClient.delete(`/sesiones/archivos?id=${id}`),
  'sesiones',
  { success: 'Archivo eliminado', error: 'Error al eliminar archivo' }
);
