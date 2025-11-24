/**
 * useAgenda - React Query hooks para agenda de fonoaudiología
 * Migrado a factory pattern
 *
 * Features:
 * - Carga solo slots DISPONIBLES (filtrados en backend)
 * - Cache de 5 minutos para datos actualizados
 * - Procesa fechas con slots disponibles para el calendario
 */

import { useQuery } from '@tanstack/react-query';
import { getApiConfig } from '../stores/configStore';
import { customMutationHook } from '../lib/mutationFactory';

const { baseURL: API_URL } = getApiConfig();

// ==========================================
// QUERIES
// ==========================================

/**
 * Hook para obtener slots disponibles
 * Cache: 5 minutos (reducido para evitar mostrar slots ya tomados)
 */
export const useAgenda = () => {
  return useQuery({
    queryKey: ['agenda'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/reservar-evaluacion`);
      if (!response.ok) {
        throw new Error('Error al cargar la agenda');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true, // Refetch al volver a la ventana para datos frescos
  });
};

// ==========================================
// MUTATIONS (migradas a factory pattern)
// ==========================================

/**
 * Hook para crear una nueva reserva
 */
export const useCreateReserva = customMutationHook(
  async (reservaData) => {
    const response = await fetch(`${API_URL}/api/reservar-evaluacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reservaData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear la reserva');
    }

    return response.json();
  },
  'agenda',
  { success: 'Reserva creada correctamente', error: 'Error al crear la reserva' }
);

/**
 * Procesa los slots disponibles para obtener fechas únicas
 * Devuelve un Set de strings en formato YYYY-MM-DD
 *
 * NOTA: El backend ya filtra slots ocupados, así que todos los slots
 * en el array son disponibles
 */
export const getBookedDates = (slots) => {
  if (!slots || !Array.isArray(slots)) {
    return new Set();
  }

  const availableDates = new Set();

  slots.forEach(slot => {
    if (slot.fechaHora) {
      // Extraer fecha de fechaHora (formato: "2025-11-20T10:00")
      const dateStr = slot.fechaHora.split('T')[0];
      availableDates.add(dateStr);
    }
  });

  return availableDates;
};

/**
 * Procesa los slots disponibles para agrupar horarios por fecha
 * Devuelve un Map de fecha -> Set de horarios disponibles
 *
 * NOTA: El backend ya filtra slots ocupados, así que todos los horarios
 * retornados están disponibles para reservar
 */
export const getBookedHoursByDate = (slots) => {
  if (!slots || !Array.isArray(slots)) {
    return new Map();
  }

  const availableHours = new Map();

  slots.forEach(slot => {
    if (slot.fechaHora) {
      // Extraer fecha y hora de fechaHora (formato: "2025-11-20T10:00")
      const [dateStr, hora] = slot.fechaHora.split('T');

      if (!availableHours.has(dateStr)) {
        availableHours.set(dateStr, new Set());
      }

      availableHours.get(dateStr).add(hora);
    }
  });

  return availableHours;
};
