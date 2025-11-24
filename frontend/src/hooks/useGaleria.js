/**
 * Hook para gestionar la galería pública
 *
 * Features:
 * - Carga imágenes de la galería
 * - Extrae álbumes únicos
 * - Cache de 1 hora para reducir peticiones
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';

/**
 * Hook para obtener la galería pública
 * Cache: 1 hora
 */
export const useGaleria = () => {
  return useQuery({
    queryKey: ['galeria'],
    queryFn: async () => {
      // El endpoint /api/images devuelve un array directo de imágenes
      const images = await apiClient.get('/images');

      // Extraer álbumes únicos
      const albums = [...new Set(images.map(img => img.album).filter(Boolean))];

      return { images, albums };
    },
    staleTime: 60 * 60 * 1000, // 1 hora
    gcTime: 60 * 60 * 1000, // 1 hora
    refetchOnWindowFocus: false,
  });
};
