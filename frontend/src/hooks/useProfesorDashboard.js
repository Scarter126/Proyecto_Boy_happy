/**
 * Hook para dashboard de profesor
 */

import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import useAuthStore from '../stores/authStore';

export function useProfesorDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalCursos: 0,
      totalAlumnos: 0,
      promedioAsistencia: 0,
      materialesPublicados: 0,
    },
    cursos: [],
    proximasActividades: [],
    alertas: []
  });

  useEffect(() => {
    if (user?.rut) {
      fetchDashboardData();
    }
  }, [user?.rut]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener cursos del profesor desde API real
      const cursosRes = await apiClient.get(`/profesor-curso/profesor?profesorRut=${user.rut}`);
      // apiClient interceptor ya retorna response.data, así que cursosRes ES el array
      const misCursos = Array.isArray(cursosRes) ? cursosRes : [];

      // Obtener estadísticas de cada curso
      const cursosConDatos = await Promise.all(
        misCursos.map(async (curso) => {
          try {
            // Obtener alumnos del curso
            const alumnosRes = await apiClient.get(`/alumnos/por-curso/${curso.curso}`);
            const alumnos = Array.isArray(alumnosRes) ? alumnosRes : [];

            // Obtener asistencia del curso (último mes)
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            let promedioAsistencia = 0;
            try {
              const asistenciaRes = await apiClient.get(
                `/asistencia?curso=${curso.curso}&startDate=${startDate}&endDate=${endDate}`
              );
              const registros = Array.isArray(asistenciaRes) ? asistenciaRes : [];

              if (registros.length > 0) {
                const presentes = registros.filter(r => r.estado === 'presente').length;
                promedioAsistencia = Math.round((presentes / registros.length) * 100);
              }
            } catch (e) {
              console.warn('Error obteniendo asistencia:', e);
            }

            return {
              ...curso,
              totalAlumnos: alumnos.length,
              promedioAsistencia,
              color: getColorByCurso(curso.curso)
            };
          } catch (err) {
            console.error(`Error obteniendo datos del curso ${curso.curso}:`, err);
            return {
              ...curso,
              totalAlumnos: 0,
              promedioAsistencia: 0,
              color: '#999'
            };
          }
        })
      );

      // Calcular estadísticas generales
      const totalAlumnos = cursosConDatos.reduce((sum, c) => sum + c.totalAlumnos, 0);
      const promedioGeneral = cursosConDatos.length > 0
        ? Math.round(
            cursosConDatos.reduce((sum, c) => sum + c.promedioAsistencia, 0) / cursosConDatos.length
          )
        : 0;

      // Obtener materiales publicados por el profesor
      let materialesPublicados = 0;
      try {
        const materialesRes = await apiClient.get('/materiales');
        const todosMateriales = Array.isArray(materialesRes) ? materialesRes : [];
        materialesPublicados = todosMateriales.filter(
          m => m.creadoPor === user.rut && m.visible
        ).length;
      } catch (e) {
        console.warn('Error obteniendo materiales:', e);
      }

      // Generar alertas
      const alertas = [];
      cursosConDatos.forEach(curso => {
        if (curso.promedioAsistencia < 70) {
          alertas.push({
            tipo: 'warning',
            mensaje: `Asistencia baja en ${curso.curso}: ${curso.promedioAsistencia}%`,
            icono: 'fa-exclamation-triangle',
            color: '#ff9800'
          });
        }
      });

      if (materialesPublicados === 0) {
        alertas.push({
          tipo: 'info',
          mensaje: 'No has publicado materiales aún',
          icono: 'fa-info-circle',
          color: '#2196f3'
        });
      }

      setDashboardData({
        stats: {
          totalCursos: cursosConDatos.length,
          totalAlumnos,
          promedioAsistencia: promedioGeneral,
          materialesPublicados,
        },
        cursos: cursosConDatos,
        proximasActividades: [], // TODO: implementar cuando tengamos API de calendario
        alertas
      });
    } catch (err) {
      console.error('Error cargando dashboard:', err);
      setError(err.message || 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    dashboardData,
    refetch: fetchDashboardData
  };
}

// Función auxiliar para asignar colores a cursos
function getColorByCurso(cursoId) {
  const colors = [
    '#4A148C', '#7B1FA2', '#AD1457', '#C2185B',
    '#D81B60', '#E91E63', '#F06292', '#1565C0'
  ];

  // Generar un hash simple del cursoId
  let hash = 0;
  for (let i = 0; i < cursoId.length; i++) {
    hash = cursoId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
