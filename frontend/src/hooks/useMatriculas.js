import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook, customMutationHook } from '../lib/mutationFactory';
import { showSuccess, showError } from '../services/notificationService';

// ==========================================
// QUERIES
// ==========================================

export const useMatriculas = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `/matriculas?${params}` : '/matriculas';

  return useQuery({
    queryKey: ['matriculas', filters],
    queryFn: () => apiClient.get(url),
    staleTime: 5 * 60 * 1000,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

/**
 * Hook para crear solicitud de matrícula
 * Mensaje personalizado para reflejar que es una "solicitud"
 */
export const useCreateMatricula = createMutationHook(
  '/matriculas',
  'solicitud de matrícula',
  'matriculas',
  { successMessage: 'Solicitud de matrícula enviada correctamente' }
);

/**
 * Hook para actualizar estado de matrícula
 * Operación especializada que actualiza estado + data adicional
 */
export const useUpdateEstadoMatricula = customMutationHook(
  ({ id, estado, ...data }) => apiClient.put(`/matriculas?id=${id}`, { estado, ...data }),
  'matriculas',
  { success: 'Estado de matrícula actualizado', error: 'Error al actualizar estado' }
);

/**
 * Hook para convertir matrícula en usuario
 * Invalida tanto matriculas como usuarios
 * Nota: Usa implementación custom porque necesita invalidar múltiples queries
 */
export const useConvertirMatriculaAUsuario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, curso }) => apiClient.post(`/matriculas/convertir-usuario?id=${id}`, { curso }),
    onSuccess: () => {
      // Invalidar ambas queries
      queryClient.invalidateQueries({ queryKey: ['matriculas'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });

      showSuccess('Usuario creado exitosamente desde matrícula');
    },
    onError: (error) => {
      showError(error.response?.data?.message || 'Error al crear usuario desde matrícula');
    },
  });
};

/**
 * Hook para eliminar matrícula
 */
export const useDeleteMatricula = customMutationHook(
  (id) => apiClient.delete(`/matriculas?id=${id}`),
  'matriculas',
  { success: 'Solicitud de matrícula eliminada', error: 'Error al eliminar matrícula' }
);

/**
 * Hook para actualizar el curso de un alumno
 * Actualiza la matrícula en la tabla ApoderadoAlumno
 */
export const useUpdateCursoAlumno = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alumnoRut, nuevoCurso }) => {
      console.log('useUpdateCursoAlumno - mutationFn ejecutándose:', { alumnoRut, nuevoCurso });

      try {
        // Si nuevoCurso está vacío, eliminar la matrícula
        if (!nuevoCurso) {
          console.log('useUpdateCursoAlumno - Eliminando matrícula');
          const result = await apiClient.delete(`/matriculas?alumnoRut=${alumnoRut}`);
          console.log('useUpdateCursoAlumno - Resultado DELETE:', result);
          return result;
        }
        // Buscar la matrícula existente y actualizarla, o crear una nueva
        console.log('useUpdateCursoAlumno - Actualizando matrícula, URL:', `/matriculas?alumnoRut=${alumnoRut}`);
        const result = await apiClient.put(`/matriculas?alumnoRut=${alumnoRut}`, { curso: nuevoCurso });
        console.log('useUpdateCursoAlumno - Resultado PUT:', result);
        return result;
      } catch (error) {
        console.error('useUpdateCursoAlumno - Error en mutationFn:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('useUpdateCursoAlumno - onSuccess ejecutado, data:', data);
      // Invalidar matriculas y usuarios para refrescar la vista
      queryClient.invalidateQueries({ queryKey: ['matriculas'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      showSuccess('Curso actualizado correctamente');
    },
    onError: (error) => {
      console.error('useUpdateCursoAlumno - onError ejecutado:', error);
      console.error('useUpdateCursoAlumno - error.response:', error.response);
      console.error('useUpdateCursoAlumno - error.message:', error.message);
      showError(error.response?.data?.message || 'Error al actualizar el curso');
    },
  });
};
