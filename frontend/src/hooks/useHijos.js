/**
 * useHijos - React Query hooks para gestión de hijos del apoderado
 *
 * Hooks para obtener información de los hijos asociados al apoderado
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import useAuthStore from '../stores/authStore';

/**
 * Hook para obtener lista de hijos del apoderado actual
 */
export const useHijos = () => {
  const user = useAuthStore(state => state.user);

  return useQuery({
    queryKey: ['hijos', user?.rut],
    queryFn: async () => {
      if (!user?.rut) return [];

      // Usar endpoint seguro que filtra en el backend
      // Dev mode: usar query params en vez de path params (Bug #9 workaround)
      const response = await apiClient.get(`/apoderados/alumnos?rut=${user.rut}`);
      const data = response.data || response || [];

      // Normalizar datos para que coincidan con lo que esperan los componentes
      return data.map(hijo => ({
        ...hijo,
        alumnoRut: hijo.rut, // Mapear rut a alumnoRut para compatibilidad
        nombreAlumno: `${hijo.nombre || ''} ${hijo.apellido || ''}`.trim() // Combinar nombre y apellido
      }));
    },
    enabled: !!user?.rut,
  });
};

/**
 * Hook para obtener un hijo específico por ID/RUT
 */
export const useHijo = (hijoId) => {
  return useQuery({
    queryKey: ['hijo', hijoId],
    queryFn: () => apiClient.get(`/usuarios/${hijoId}`),
    enabled: !!hijoId,
  });
};
