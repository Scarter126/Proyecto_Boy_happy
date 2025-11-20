import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { createMutationHook, customMutationHook } from '../lib/mutationFactory';

// ==========================================
// QUERIES (sin cambios)
// ==========================================

export const useUsuarios = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `/usuarios?${params}` : '/usuarios';

  return useQuery({
    queryKey: ['usuarios', filters],
    queryFn: () => apiClient.get(url),
    staleTime: 5 * 60 * 1000,
  });
};

export const useUsuario = (rut) => {
  return useQuery({
    queryKey: ['usuarios', rut],
    queryFn: () => apiClient.get(`/usuarios?rut=${rut}`).then(data => Array.isArray(data) ? data[0] : data),
    enabled: !!rut,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUsuariosPorRol = (rol) => {
  return useQuery({
    queryKey: ['usuarios', { rol }],
    queryFn: () => apiClient.get(`/usuarios?rol=${rol}`),
    enabled: !!rol,
    staleTime: 5 * 60 * 1000,
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

/**
 * Hook para crear usuarios
 * Antes: 20 líneas de código boilerplate
 * Ahora: 1 línea usando factory
 */
export const useCreateUsuario = createMutationHook(
  '/usuarios',
  'usuario',
  'usuarios'
);

/**
 * Hook para actualizar usuarios
 * Nota: Usa query params ?rut= en lugar de path params
 */
export const useUpdateUsuario = customMutationHook(
  ({ rut, ...data }) => apiClient.put(`/usuarios?rut=${rut}`, data),
  'usuarios',
  { success: 'Usuario actualizado correctamente', error: 'Error al actualizar usuario' }
);

/**
 * Hook para eliminar usuarios
 * Nota: Usa query params ?rut= en lugar de path params
 */
export const useDeleteUsuario = customMutationHook(
  (rut) => apiClient.delete(`/usuarios?rut=${rut}`),
  'usuarios',
  { success: 'Usuario eliminado correctamente', error: 'Error al eliminar usuario' }
);

/**
 * Hook para cambiar rol de usuario
 * Operación especializada con endpoint y parámetros específicos
 */
export const useCambiarRol = customMutationHook(
  ({ rut, nuevoRol }) => apiClient.put(`/usuarios/cambiar-rol?rut=${rut}`, { nuevoRol }),
  'usuarios',
  { success: 'Rol actualizado correctamente', error: 'Error al cambiar rol' }
);
