import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';

/**
 * Hook para gestionar relaciones Material-Categoría (Many-to-Many)
 *
 * Funcionalidades:
 * - Obtener categorías de un material
 * - Obtener materiales de una categoría
 * - Agregar categoría a material
 * - Quitar categoría de material
 * - Reemplazar todas las categorías de un material
 */

const MATERIAL_CATEGORIAS_KEYS = {
  all: ['material-categorias'],
  materialCategorias: (materialId) => [...MATERIAL_CATEGORIAS_KEYS.all, 'material', materialId],
  categoriaMateriales: (categoriaId) => [...MATERIAL_CATEGORIAS_KEYS.all, 'categoria', categoriaId]
};

/**
 * Hook para obtener categorías de un material específico
 */
export function useMaterialCategorias(materialId, options = {}) {
  const queryClient = useQueryClient();

  // Query: Obtener categorías del material
  const {
    data: categorias = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: MATERIAL_CATEGORIAS_KEYS.materialCategorias(materialId),
    queryFn: async () => {
      const response = await apiClient.get(`/materiales/${materialId}/categorias`);
      return response.categorias || [];
    },
    enabled: !!materialId && options.enabled !== false,
    ...options
  });

  // Mutation: Agregar categoría al material
  const addCategoria = useMutation({
    mutationFn: async (categoriaId) => {
      return await apiClient.post(`/materiales/${materialId}/categorias`, {
        categoriaId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MATERIAL_CATEGORIAS_KEYS.materialCategorias(materialId)
      });
      // También invalidar la lista de materiales por si acaso
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
    }
  });

  // Mutation: Quitar categoría del material
  const removeCategoria = useMutation({
    mutationFn: async (categoriaId) => {
      return await apiClient.delete(`/materiales/${materialId}/categorias/${categoriaId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MATERIAL_CATEGORIAS_KEYS.materialCategorias(materialId)
      });
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
    }
  });

  // Mutation: Reemplazar todas las categorías del material
  const replaceCategorias = useMutation({
    mutationFn: async (categoriaIds) => {
      return await apiClient.put(`/materiales/${materialId}/categorias`, {
        categoriaIds: Array.isArray(categoriaIds) ? categoriaIds : [categoriaIds]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MATERIAL_CATEGORIAS_KEYS.materialCategorias(materialId)
      });
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
    }
  });

  return {
    // Data
    categorias,
    count: categorias.length,

    // Loading state
    isLoading,
    error,

    // Actions
    addCategoria: addCategoria.mutate,
    removeCategoria: removeCategoria.mutate,
    replaceCategorias: replaceCategorias.mutate,
    refetch,

    // Mutation states
    isAdding: addCategoria.isPending,
    isRemoving: removeCategoria.isPending,
    isReplacing: replaceCategorias.isPending,

    // Mutation errors
    addError: addCategoria.error,
    removeError: removeCategoria.error,
    replaceError: replaceCategorias.error
  };
}

/**
 * Hook para obtener materiales de una categoría específica
 */
export function useCategoriaMateriales(categoriaId, options = {}) {
  const queryClient = useQueryClient();

  const {
    data: materiales = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: MATERIAL_CATEGORIAS_KEYS.categoriaMateriales(categoriaId),
    queryFn: async () => {
      const response = await apiClient.get(`/categorias/${categoriaId}/materiales`);
      return response.materiales || [];
    },
    enabled: !!categoriaId && options.enabled !== false,
    ...options
  });

  return {
    materiales,
    count: materiales.length,
    isLoading,
    error,
    refetch
  };
}

/**
 * Hook combinado para gestionar categorías de múltiples materiales
 * Útil para operaciones en lote
 */
export function useBulkMaterialCategorias() {
  const queryClient = useQueryClient();

  // Mutation: Agregar categoría a múltiples materiales
  const addCategoriaToMultipleMaterials = useMutation({
    mutationFn: async ({ materialIds, categoriaId }) => {
      const promises = materialIds.map(materialId =>
        apiClient.post(`/materiales/${materialId}/categorias`, { categoriaId })
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MATERIAL_CATEGORIAS_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
    }
  });

  // Mutation: Quitar categoría de múltiples materiales
  const removeCategoriaFromMultipleMaterials = useMutation({
    mutationFn: async ({ materialIds, categoriaId }) => {
      const promises = materialIds.map(materialId =>
        apiClient.delete(`/materiales/${materialId}/categorias/${categoriaId}`)
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MATERIAL_CATEGORIAS_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
    }
  });

  return {
    addCategoriaToMultipleMaterials: addCategoriaToMultipleMaterials.mutate,
    removeCategoriaFromMultipleMaterials: removeCategoriaFromMultipleMaterials.mutate,
    isAdding: addCategoriaToMultipleMaterials.isPending,
    isRemoving: removeCategoriaFromMultipleMaterials.isPending,
    addError: addCategoriaToMultipleMaterials.error,
    removeError: removeCategoriaFromMultipleMaterials.error
  };
}

/**
 * Helper: Verificar si un material tiene una categoría específica
 */
export function materialHasCategoria(categorias, categoriaId) {
  return categorias.some(cat => cat.id === categoriaId);
}

/**
 * Helper: Obtener IDs de categorías de un material
 */
export function getCategoriaIds(categorias) {
  return categorias.map(cat => cat.id);
}

/**
 * Helper: Formatear categorías para mostrar
 * Ej: "Categoría 1, Categoría 2, Categoría 3"
 */
export function formatCategoriasDisplay(categorias, separator = ', ') {
  if (!categorias || categorias.length === 0) return 'Sin categorías';
  return categorias.map(cat => cat.nombre).join(separator);
}

/**
 * Helper: Crear badges de categorías para UI
 */
export function createCategoriaBadges(categorias) {
  return categorias.map(cat => ({
    id: cat.id,
    label: cat.nombre,
    color: cat.color || '#667eea',
    icon: cat.icono || 'fa-folder'
  }));
}

export default useMaterialCategorias;
