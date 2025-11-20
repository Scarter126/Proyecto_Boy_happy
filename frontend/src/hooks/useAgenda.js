/**
 * useAgenda - React Query hooks para agenda de fonoaudiología
 * Migrado a factory pattern
 *
 * Features:
 * - Carga todas las reservas existentes
 * - Cache de 1 hora para reducir peticiones
 * - Procesa fechas ocupadas para el calendario
 */

import { useQuery } from '@tanstack/react-query';
import { getApiConfig } from '../stores/configStore';
import { customMutationHook } from '../lib/mutationFactory';

const { baseURL: API_URL } = getApiConfig();

// ==========================================
// QUERIES
// ==========================================

/**
 * Hook para obtener todas las reservas
 * Cache: 1 hora
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
    staleTime: 60 * 60 * 1000, // 1 hora
    gcTime: 60 * 60 * 1000, // 1 hora (antes cacheTime)
    refetchOnWindowFocus: false, // No refetch al volver a la ventana
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
 * Procesa las reservas para obtener fechas ocupadas
 * Devuelve un Set de strings en formato YYYY-MM-DD
 */
export const getBookedDates = (reservas) => {
  if (!reservas || !Array.isArray(reservas)) {
    return new Set();
  }

  const bookedDates = new Set();

  reservas.forEach(reserva => {
    if (reserva.fechaHora) {
      // Extraer fecha de fechaHora (formato: "2025-11-20T10:00")
      const dateStr = reserva.fechaHora.split('T')[0];
      bookedDates.add(dateStr);
    }
  });

  return bookedDates;
};

/**
 * Procesa las reservas para obtener horarios ocupados por fecha
 * Devuelve un Map de fecha -> Set de horarios
 */
export const getBookedHoursByDate = (reservas) => {
  if (!reservas || !Array.isArray(reservas)) {
    return new Map();
  }

  const bookedHours = new Map();

  reservas.forEach(reserva => {
    if (reserva.fechaHora) {
      // Extraer fecha y hora de fechaHora (formato: "2025-11-20T10:00")
      const [dateStr, hora] = reserva.fechaHora.split('T');

      if (!bookedHours.has(dateStr)) {
        bookedHours.set(dateStr, new Set());
      }

      bookedHours.get(dateStr).add(hora);
    }
  });

  return bookedHours;
};
