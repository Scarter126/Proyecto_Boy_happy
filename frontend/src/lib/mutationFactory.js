/**
 * Mutation Factory - Factory para crear hooks de React Query
 *
 * Reduce el código boilerplate de React Query mutations creando hooks
 * con configuración estándar de:
 * - Invalidación de queries
 * - Notificaciones de éxito/error
 * - Manejo de errores consistente
 *
 * @module lib/mutationFactory
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './apiClient';
import { showSuccess, showError, showToast } from '../services/notificationService';

/**
 * Opciones por defecto para mutations
 */
const defaultMutationOptions = {
  showSuccessNotification: true,
  showErrorNotification: true,
  useToast: false, // Si es true, usa toast en lugar de modal
  invalidateQueries: true,
};

/**
 * Crea un hook de mutation para operaciones CREATE
 *
 * @param {string} endpoint - Endpoint de la API (sin /api, ej: '/usuarios')
 * @param {string} resourceName - Nombre del recurso para mensajes (ej: 'usuario')
 * @param {string} queryKey - Key de React Query para invalidar (ej: 'usuarios')
 * @param {Object} [options={}] - Opciones adicionales
 * @returns {Function} Hook de mutation
 *
 * @example
 * export const useCreateUsuario = createMutationHook('/usuarios', 'usuario', 'usuarios');
 */
export function createMutationHook(endpoint, resourceName, queryKey, options = {}) {
  const config = { ...defaultMutationOptions, ...options };

  return function useMutationHook() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (data) => apiClient.post(endpoint, data),
      onSuccess: () => {
        if (config.invalidateQueries) {
          // Invalida todas las queries que empiecen con queryKey (incluyendo sub-queries)
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        }

        if (config.showSuccessNotification) {
          const message = config.successMessage || `${resourceName} creado correctamente`;
          if (config.useToast) {
            showToast(message, 'success');
          } else {
            showSuccess(message);
          }
        }
      },
      onError: (error) => {
        if (config.showErrorNotification) {
          const message = error.response?.data?.message || error.message || 'Error al procesar la solicitud';
          if (config.useToast) {
            showToast(message, 'error');
          } else {
            showError(message);
          }
        }
      },
    });
  };
}

/**
 * Crea un hook de mutation para operaciones UPDATE
 *
 * @param {string} endpoint - Endpoint de la API (puede incluir :id)
 * @param {string} resourceName - Nombre del recurso para mensajes
 * @param {string} queryKey - Key de React Query para invalidar
 * @param {Object} [options={}] - Opciones adicionales
 * @returns {Function} Hook de mutation
 *
 * @example
 * export const useUpdateUsuario = updateMutationHook('/usuarios/:id', 'usuario', 'usuarios');
 */
export function updateMutationHook(endpoint, resourceName, queryKey, options = {}) {
  const config = { ...defaultMutationOptions, ...options };

  return function useMutationHook() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: ({ id, data }) => {
        const url = endpoint.replace(':id', id);
        return apiClient.put(url, data);
      },
      onSuccess: () => {
        if (config.invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        }

        if (config.showSuccessNotification) {
          const message = config.successMessage || `${resourceName} actualizado correctamente`;
          if (config.useToast) {
            showToast(message, 'success');
          } else {
            showSuccess(message);
          }
        }
      },
      onError: (error) => {
        if (config.showErrorNotification) {
          const message = error.response?.data?.message || error.message || 'Error al actualizar';
          if (config.useToast) {
            showToast(message, 'error');
          } else {
            showError(message);
          }
        }
      },
    });
  };
}

/**
 * Crea un hook de mutation para operaciones DELETE
 *
 * @param {string} endpoint - Endpoint de la API (puede incluir :id)
 * @param {string} resourceName - Nombre del recurso para mensajes
 * @param {string} queryKey - Key de React Query para invalidar
 * @param {Object} [options={}] - Opciones adicionales
 * @returns {Function} Hook de mutation
 *
 * @example
 * export const useDeleteUsuario = deleteMutationHook('/usuarios/:id', 'usuario', 'usuarios');
 */
export function deleteMutationHook(endpoint, resourceName, queryKey, options = {}) {
  const config = { ...defaultMutationOptions, ...options };

  return function useMutationHook() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id) => {
        const url = endpoint.replace(':id', id);
        return apiClient.delete(url);
      },
      onSuccess: () => {
        if (config.invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        }

        if (config.showSuccessNotification) {
          const message = config.successMessage || `${resourceName} eliminado correctamente`;
          if (config.useToast) {
            showToast(message, 'success');
          } else {
            showSuccess(message);
          }
        }
      },
      onError: (error) => {
        if (config.showErrorNotification) {
          const message = error.response?.data?.message || error.message || 'Error al eliminar';
          if (config.useToast) {
            showToast(message, 'error');
          } else {
            showError(message);
          }
        }
      },
    });
  };
}

/**
 * Crea un hook de mutation genérico para cualquier operación
 *
 * @param {Function} mutationFn - Función de mutation personalizada
 * @param {string} queryKey - Key de React Query para invalidar
 * @param {Object} messages - Mensajes de éxito/error personalizados
 * @param {Object} [options={}] - Opciones adicionales
 * @returns {Function} Hook de mutation
 *
 * @example
 * export const useCustomMutation = customMutationHook(
 *   (data) => apiClient.post('/custom-endpoint', data),
 *   'customResource',
 *   { success: 'Operación completada', error: 'Error en la operación' }
 * );
 */
export function customMutationHook(mutationFn, queryKey, messages = {}, options = {}) {
  const config = { ...defaultMutationOptions, ...options };

  return function useMutationHook() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn,
      onSuccess: () => {
        if (config.invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        }

        if (config.showSuccessNotification) {
          const message = messages.success || 'Operación completada correctamente';
          if (config.useToast) {
            showToast(message, 'success');
          } else {
            showSuccess(message);
          }
        }
      },
      onError: (error) => {
        if (config.showErrorNotification) {
          const message =
            messages.error || error.response?.data?.message || error.message || 'Error en la operación';
          if (config.useToast) {
            showToast(message, 'error');
          } else {
            showError(message);
          }
        }
      },
    });
  };
}

/**
 * Helper para crear múltiples hooks CRUD de una vez
 *
 * @param {string} endpoint - Endpoint base
 * @param {string} resourceName - Nombre del recurso
 * @param {string} queryKey - Query key base
 * @param {Object} [options={}] - Opciones globales
 * @returns {Object} Objeto con hooks create, update, delete
 *
 * @example
 * const usuarioHooks = createCrudHooks('/usuarios', 'usuario', 'usuarios');
 * export const { useCreate, useUpdate, useDelete } = usuarioHooks;
 */
export function createCrudHooks(endpoint, resourceName, queryKey, options = {}) {
  return {
    useCreate: createMutationHook(endpoint, resourceName, queryKey, options),
    useUpdate: updateMutationHook(`${endpoint}/:id`, resourceName, queryKey, options),
    useDelete: deleteMutationHook(`${endpoint}/:id`, resourceName, queryKey, options),
  };
}

export default {
  createMutationHook,
  updateMutationHook,
  deleteMutationHook,
  customMutationHook,
  createCrudHooks,
};
