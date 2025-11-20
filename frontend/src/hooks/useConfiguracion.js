/**
 * useConfiguracion - React Query hooks para configuración del sistema
 * Migrado a factory pattern
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { customMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES
// ==========================================

export const useConfiguracion = (key = null) => {
  const url = key ? `/configuracion?key=${key}` : '/configuracion';

  return useQuery({
    queryKey: key ? ['configuracion', key] : ['configuracion'],
    queryFn: () => apiClient.get(url),
    staleTime: 15 * 60 * 1000,
  });
};

export const useCursos = () => {
  return useQuery({
    queryKey: ['configuracion', 'cursos'],
    queryFn: () => apiClient.get('/configuracion?key=cursos').then(data => {
      // Si viene cursosNombres, usarlo directamente
      if (data.cursosNombres && Array.isArray(data.cursosNombres)) {
        return data.cursosNombres;
      }
      // Si solo viene cursos (array de códigos), transformar a cursosNombres
      if (data.cursos && Array.isArray(data.cursos)) {
        return data.cursos.map(codigo => ({
          codigo,
          nombre: codigo.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        }));
      }
      return [];
    }),
    staleTime: 15 * 60 * 1000,
  });
};

export const useAsignaturas = () => {
  return useQuery({
    queryKey: ['configuracion', 'asignaturas'],
    queryFn: () => apiClient.get('/configuracion?key=asignaturas').then(data => data.asignaturas || []),
    staleTime: 15 * 60 * 1000,
  });
};

// ==========================================
// HOOKS ESPECÍFICOS PARA LISTAS DE CONFIGURACIÓN (SIMPLIFICADO: 10 → 1)
// ==========================================

/**
 * Tipos de archivo (HARDCODED - valores universales)
 * Retorna constantes estáticas - no requiere configuración dinámica
 */
export const useTiposArchivo = () => {
  const TIPOS_ARCHIVO = [
    { value: 'documento', label: 'Documento PDF', icon: 'fa-file-pdf' },
    { value: 'video', label: 'Video', icon: 'fa-video' },
    { value: 'imagen', label: 'Imagen', icon: 'fa-image' },
    { value: 'audio', label: 'Audio', icon: 'fa-headphones' },
    { value: 'link', label: 'Enlace Web', icon: 'fa-link' }
  ];

  return {
    data: TIPOS_ARCHIVO,
    isLoading: false,
    isError: false,
    error: null
  };
};

/**
 * Niveles de dificultad (HARDCODED - valores universales)
 * Retorna constantes estáticas - no requiere configuración dinámica
 */
export const useNivelesDificultad = () => {
  const NIVELES_DIFICULTAD = [
    { value: 'basico', label: 'Básico', color: '#48bb78' },
    { value: 'intermedio', label: 'Intermedio', color: '#ed8936' },
    { value: 'avanzado', label: 'Avanzado', color: '#f56565' }
  ];

  return {
    data: NIVELES_DIFICULTAD,
    isLoading: false,
    isError: false,
    error: null
  };
};

/**
 * Evaluaciones (académico + fonoaudiológico)
 * Incluye campos 'contexto' y 'tipo' para filtrar
 * ÚNICA configuración dinámica restante (varía según institución)
 */
export const useEvaluaciones = () => {
  return useQuery({
    queryKey: ['configuracion', 'evaluaciones'],
    queryFn: () => apiClient.get('/configuracion?key=evaluaciones').then(data => data.items || []),
    staleTime: 15 * 60 * 1000,
  });
};

// Helper: Obtener solo tipos de evaluación académica
export const useTiposEvaluacionAcademica = () => {
  return useQuery({
    queryKey: ['configuracion', 'evaluaciones', 'academico'],
    queryFn: () => apiClient.get('/configuracion?key=evaluaciones')
      .then(data => (data.items || []).filter(item => item.contexto === 'academico' && item.tipo === 'tipo')),
    staleTime: 15 * 60 * 1000,
  });
};

// Helper: Obtener solo tipos de evaluación fonoaudiológica
export const useTiposEvaluacionFono = () => {
  return useQuery({
    queryKey: ['configuracion', 'evaluaciones', 'fono', 'tipo'],
    queryFn: () => apiClient.get('/configuracion?key=evaluaciones')
      .then(data => (data.items || []).filter(item => item.contexto === 'fono' && item.tipo === 'tipo')),
    staleTime: 15 * 60 * 1000,
  });
};

// Helper: Obtener solo áreas de evaluación fonoaudiológica
export const useAreasEvaluacionFono = () => {
  return useQuery({
    queryKey: ['configuracion', 'evaluaciones', 'fono', 'area'],
    queryFn: () => apiClient.get('/configuracion?key=evaluaciones')
      .then(data => (data.items || []).filter(item => item.contexto === 'fono' && item.tipo === 'area')),
    staleTime: 15 * 60 * 1000,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

export const useUpdateConfiguracion = customMutationHook(
  (data) => apiClient.put('/configuracion', data),
  'configuracion',
  { success: 'Configuración guardada correctamente', error: 'Error al guardar configuración' }
);
