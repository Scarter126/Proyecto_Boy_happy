import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';

/**
 * Hook para gestionar categorías de materiales
 *
 * Funcionalidades:
 * - Listar todas las categorías
 * - Obtener árbol jerárquico
 * - Crear, actualizar y eliminar categorías
 * - Obtener subcategorías de un parent
 */

const CATEGORIAS_KEYS = {
  all: ['categorias'],
  list: () => [...CATEGORIAS_KEYS.all, 'list'],
  tree: () => [...CATEGORIAS_KEYS.all, 'tree'],
  subcategorias: (parentId) => [...CATEGORIAS_KEYS.all, 'subcategorias', parentId],
  detail: (id) => [...CATEGORIAS_KEYS.all, 'detail', id]
};

/**
 * Hook principal para categorías
 */
export function useCategorias(options = {}) {
  const queryClient = useQueryClient();

  // Query: Listar todas las categorías
  const {
    data: categorias = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: CATEGORIAS_KEYS.list(),
    queryFn: async () => {
      const response = await apiClient.get('/categorias');
      return response.categorias || [];
    },
    ...options
  });

  // Query: Obtener árbol jerárquico
  const {
    data: arbol = [],
    isLoading: isLoadingTree,
    error: treeError
  } = useQuery({
    queryKey: CATEGORIAS_KEYS.tree(),
    queryFn: async () => {
      const response = await apiClient.get('/categorias/arbol');
      return response.arbol || [];
    },
    enabled: options.includeTree !== false
  });

  // Mutation: Crear categoría
  const createCategoria = useMutation({
    mutationFn: async (data) => {
      return await apiClient.post('/categorias', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIAS_KEYS.all });
    }
  });

  // Mutation: Actualizar categoría
  const updateCategoria = useMutation({
    mutationFn: async ({ id, ...data }) => {
      return await apiClient.put(`/categorias?id=${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIAS_KEYS.all });
    }
  });

  // Mutation: Eliminar categoría
  const deleteCategoria = useMutation({
    mutationFn: async (id) => {
      return await apiClient.delete(`/categorias?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIAS_KEYS.all });
    }
  });

  return {
    // Data
    categorias,
    arbol,
    total: categorias.length,

    // Loading states
    isLoading,
    isLoadingTree,

    // Errors
    error,
    treeError,

    // Actions
    createCategoria: createCategoria.mutate,
    updateCategoria: updateCategoria.mutate,
    deleteCategoria: deleteCategoria.mutate,
    refetch,

    // Mutation states
    isCreating: createCategoria.isPending,
    isUpdating: updateCategoria.isPending,
    isDeleting: deleteCategoria.isPending,

    // Mutation results
    createError: createCategoria.error,
    updateError: updateCategoria.error,
    deleteError: deleteCategoria.error
  };
}

/**
 * Hook para obtener subcategorías de un parent específico
 */
export function useSubcategorias(parentId, options = {}) {
  const queryClient = useQueryClient();

  const {
    data: subcategorias = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: CATEGORIAS_KEYS.subcategorias(parentId),
    queryFn: async () => {
      const response = await apiClient.get(`/categorias/subcategorias?parentId=${parentId}`);
      return response.subcategorias || [];
    },
    enabled: !!parentId && options.enabled !== false,
    ...options
  });

  return {
    subcategorias,
    isLoading,
    error,
    refetch,
    count: subcategorias.length
  };
}

/**
 * Hook para gestionar una sola categoría
 */
export function useCategoria(id, options = {}) {
  const queryClient = useQueryClient();

  const {
    data: categoria,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: CATEGORIAS_KEYS.detail(id),
    queryFn: async () => {
      // Primero intentar obtener de la lista en cache
      const cachedList = queryClient.getQueryData(CATEGORIAS_KEYS.list());
      if (cachedList) {
        const found = cachedList.find(cat => cat.id === id);
        if (found) return found;
      }

      // Si no está en cache, hacer query individual
      // Nota: El backend no tiene endpoint GET /categorias/:id
      // Por ahora refetch de la lista completa
      const response = await apiClient.get('/categorias');
      const categorias = response.categorias || [];
      return categorias.find(cat => cat.id === id);
    },
    enabled: !!id && options.enabled !== false,
    ...options
  });

  return {
    categoria,
    isLoading,
    error,
    refetch
  };
}

/**
 * Helper: Convertir lista plana a árbol jerárquico
 * (Útil si el backend no devuelve el árbol)
 */
export function buildCategoriaTree(categorias, parentId = 'ROOT') {
  return categorias
    .filter(cat => (cat.parentId || 'ROOT') === parentId)
    .map(cat => ({
      ...cat,
      children: buildCategoriaTree(categorias, cat.id)
    }));
}

/**
 * Helper: Obtener todas las categorías hijas recursivamente
 */
export function getAllChildrenIds(arbol, categoryId) {
  const ids = [];

  function traverse(nodes) {
    for (const node of nodes) {
      if (node.id === categoryId) {
        collectChildren(node);
        return true;
      }
      if (node.children && node.children.length > 0) {
        if (traverse(node.children)) return true;
      }
    }
    return false;
  }

  function collectChildren(node) {
    ids.push(node.id);
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => collectChildren(child));
    }
  }

  traverse(arbol);
  return ids;
}

/**
 * Helper: Obtener path completo de una categoría
 * Ej: "Categoría Padre > Subcategoría > Hoja"
 */
export function getCategoriaPath(categorias, categoriaId) {
  const path = [];
  let currentId = categoriaId;

  while (currentId) {
    const categoria = categorias.find(c => c.id === currentId);
    if (!categoria) break;

    path.unshift(categoria.nombre);
    currentId = categoria.parentId;
  }

  return path.join(' > ');
}

export default useCategorias;
