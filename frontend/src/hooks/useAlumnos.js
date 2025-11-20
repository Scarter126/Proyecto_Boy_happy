/**
 * Hooks for managing alumnos (students)
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import useAuthStore from '../stores/authStore';

/**
 * Hook to fetch students by curso
 */
export const useAlumnosPorCurso = (curso) => {
  return useQuery({
    queryKey: ['alumnos', 'curso', curso],
    queryFn: () => apiClient.get(`/alumnos/por-curso/${curso}`),
    enabled: !!curso,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch all students from profesor's courses
 * Only works for profesores - fetches students from all courses they teach
 */
export const useAlumnosDeProfesor = () => {
  const { user } = useAuthStore();

  // Check if user is profesor - cognito:groups is an array
  const isProfesor = user?.['cognito:groups']?.includes('profesor');

  return useQuery({
    queryKey: ['alumnos', 'profesor', user?.rut],
    queryFn: async () => {
      if (!user?.rut) {
        throw new Error('No hay usuario autenticado');
      }

      // 1. Fetch profesor's courses
      const cursosRes = await apiClient.get(`/profesor-curso/profesor?profesorRut=${user.rut}`);
      const misCursos = Array.isArray(cursosRes) ? cursosRes : [];

      if (misCursos.length === 0) {
        return [];
      }

      // 2. Fetch students from each curso
      const alumnosPromises = misCursos.map(async (curso) => {
        try {
          console.log('[DEBUG useAlumnos] Fetching students for curso:', curso.curso);
          const alumnosRes = await apiClient.get(`/alumnos/por-curso/${curso.curso}`);
          const alumnos = Array.isArray(alumnosRes) ? alumnosRes : [];
          console.log('[DEBUG useAlumnos] Received', alumnos.length, 'students for curso:', curso.curso);

          // Add curso info to each alumno for easier filtering
          return alumnos.map(alumno => ({
            ...alumno,
            cursoId: curso.curso // Ensure we have the curso ID
          }));
        } catch (error) {
          console.error(`Error fetching students for curso ${curso.curso}:`, error);
          return [];
        }
      });

      const alumnosArrays = await Promise.all(alumnosPromises);

      // 3. Flatten and deduplicate (in case a student is in multiple courses)
      const alumnosMap = new Map();
      alumnosArrays.flat().forEach(alumno => {
        if (!alumnosMap.has(alumno.rut)) {
          alumnosMap.set(alumno.rut, alumno);
        }
      });

      const finalAlumnos = Array.from(alumnosMap.values());
      console.log('[DEBUG useAlumnos] Final result:', finalAlumnos.length, 'unique students');
      return finalAlumnos;
    },
    enabled: !!user?.rut && isProfesor,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch profesor's courses (lightweight version for dropdowns)
 */
export const useCursosDeProfesor = () => {
  const { user } = useAuthStore();

  // Check if user is profesor - cognito:groups is an array
  const isProfesor = user?.['cognito:groups']?.includes('profesor');

  return useQuery({
    queryKey: ['cursos', 'profesor', user?.rut],
    queryFn: async () => {
      if (!user?.rut) {
        throw new Error('No hay usuario autenticado');
      }

      const cursosRes = await apiClient.get(`/profesor-curso/profesor?profesorRut=${user.rut}`);
      return Array.isArray(cursosRes) ? cursosRes : [];
    },
    enabled: !!user?.rut && isProfesor,
    staleTime: 5 * 60 * 1000,
  });
};
