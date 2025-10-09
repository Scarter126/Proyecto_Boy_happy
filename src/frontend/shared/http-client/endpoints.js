/**
 * API Endpoints Centralizados
 *
 * Responsabilidad ÚNICA:
 * - Definir endpoints del dominio
 * - Configuración específica por endpoint (staleTime, transform, mensajes)
 * - Factory genérico para eliminar duplicación
 *
 * NO maneja:
 * - Estado reactivo (eso es de http-client-hooks.js)
 * - Peticiones HTTP (eso es de http-client.js)
 */

// ==========================================
// FACTORY GENÉRICO
// ==========================================

/**
 * Crea hooks de Query para un recurso
 */
function createQueryHooks(resource, config = {}) {
  const {
    staleTime = 5 * 60 * 1000,
    cacheTime = 10 * 60 * 1000,
    transform = null
  } = config;

  return {
    // useRecurso(filters)
    useList: (filters = {}) => {
      const queryKey = createQueryKey(`/${resource}`, filters);
      return useQuery(queryKey, { staleTime, cacheTime, transform });
    },

    // useRecurso(id)
    useOne: (id, options = {}) => {
      return useQuery(
        `/${resource}?id=${id}`,
        {
          enabled: !!id,
          staleTime,
          cacheTime,
          ...options
        }
      );
    }
  };
}

/**
 * Crea hooks de Mutation para un recurso
 */
function createMutationHooks(resource, config = {}) {
  const {
    labels = {},
    invalidates = [`/${resource}`]
  } = config;

  return {
    // useCreateRecurso()
    useCreate: () => useMutation(
      (data) => apiClient.post(`/${resource}`, data),
      {
        invalidateQueries: invalidates,
        successMessage: labels.create || `✅ ${capitalize(resource)} creado`
      }
    ),

    // useUpdateRecurso()
    useUpdate: () => useMutation(
      ({ id, ...data }) => apiClient.put(`/${resource}?id=${id}`, data),
      {
        invalidateQueries: invalidates,
        successMessage: labels.update || `✅ ${capitalize(resource)} actualizado`
      }
    ),

    // useDeleteRecurso()
    useDelete: () => useMutation(
      (id) => apiClient.delete(`/${resource}?id=${id}`),
      {
        invalidateQueries: invalidates,
        successMessage: labels.delete || `✅ ${capitalize(resource)} eliminado`
      }
    )
  };
}

/**
 * Crea CRUD completo para un recurso
 */
function createCRUDHooks(resource, config = {}) {
  const queries = createQueryHooks(resource, config);
  const mutations = createMutationHooks(resource, config);

  return {
    ...queries,
    ...mutations
  };
}

// ==========================================
// HELPERS
// ==========================================

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ==========================================
// DEFINICIÓN DE ENDPOINTS
// ==========================================

// USUARIOS
const usuariosAPI = createCRUDHooks('usuarios', {
  staleTime: 5 * 60 * 1000,
  labels: {
    create: '✅ Usuario creado correctamente',
    update: '✅ Usuario actualizado correctamente',
    delete: '✅ Usuario eliminado correctamente'
  }
});

window.useUsuarios = usuariosAPI.useList;
window.useUsuario = (rut) => useQuery(
  `/usuarios?rut=${rut}`,
  {
    enabled: !!rut,
    transform: (data) => Array.isArray(data) ? data[0] : data
  }
);
window.useCreateUsuario = usuariosAPI.useCreate;
window.useUpdateUsuario = () => useMutation(
  ({ rut, ...data }) => apiClient.put(`/usuarios?rut=${rut}`, data),
  {
    invalidateQueries: ['/usuarios'],
    successMessage: '✅ Usuario actualizado correctamente'
  }
);
window.useDeleteUsuario = () => useMutation(
  (rut) => apiClient.delete(`/usuarios?rut=${rut}`),
  {
    invalidateQueries: ['/usuarios'],
    successMessage: '✅ Usuario eliminado correctamente'
  }
);
window.useCambiarRol = () => useMutation(
  ({ rut, nuevoRol }) => apiClient.put(`/usuarios/cambiar-rol?rut=${rut}`, { nuevoRol }),
  {
    invalidateQueries: ['/usuarios'],
    successMessage: '✅ Rol actualizado correctamente'
  }
);
window.useUsuariosPorRol = (rol) => useQuery(
  `/usuarios?rol=${rol}`,
  { enabled: !!rol, staleTime: 5 * 60 * 1000 }
);
window.useAlumnosPorCurso = (curso) => useQuery(
  `/usuarios?rol=alumno&curso=${curso}`,
  { enabled: !!curso, staleTime: 5 * 60 * 1000 }
);

// ANUNCIOS
const anunciosAPI = createCRUDHooks('anuncios', {
  staleTime: 2 * 60 * 1000,
  labels: {
    create: '📢 Anuncio publicado correctamente',
    delete: '✅ Anuncio eliminado'
  }
});

window.useAnuncios = anunciosAPI.useList;
window.useCreateAnuncio = anunciosAPI.useCreate;
window.useDeleteAnuncio = anunciosAPI.useDelete;

// EVENTOS
const eventosAPI = createCRUDHooks('eventos', {
  staleTime: 5 * 60 * 1000,
  labels: {
    create: '📅 Evento creado correctamente',
    update: '✅ Evento actualizado',
    delete: '✅ Evento eliminado'
  }
});

window.useEventos = eventosAPI.useList;
window.useCreateEvento = eventosAPI.useCreate;
window.useUpdateEvento = eventosAPI.useUpdate;
window.useDeleteEvento = eventosAPI.useDelete;

// ASISTENCIA
window.useAsistencia = (filters = {}) => {
  const queryKey = createQueryKey('/asistencia', filters);
  return useQuery(queryKey, {
    enabled: true, // Permitir cargar siempre (la API filtra si es necesario)
    staleTime: 0
  });
};
window.useAsistenciaAlumno = (rutAlumno) => useQuery(
  `/asistencia?rutAlumno=${rutAlumno}`,
  { enabled: !!rutAlumno, staleTime: 1 * 60 * 1000 }
);
window.useRegistrarAsistencia = () => useMutation(
  (data) => apiClient.post('/asistencia', data),
  {
    invalidateQueries: ['/asistencia'],
    successMessage: '✅ Asistencia registrada correctamente'
  }
);
window.useActualizarAsistencia = () => useMutation(
  ({ id, ...data }) => apiClient.put(`/asistencia?id=${id}`, data),
  {
    invalidateQueries: ['/asistencia'],
    successMessage: '✅ Asistencia actualizada'
  }
);

// NOTAS
window.useNotas = (filters = {}, options = {}) => {
  const queryKey = createQueryKey('/notas', filters);
  return useQuery(queryKey, {
    enabled: options.enabled !== undefined ? options.enabled : true, // Por defecto siempre habilitado
    staleTime: 3 * 60 * 1000
  });
};
window.useNotasAgrupadas = (rutAlumno) => useQuery(
  `/notas/agrupadas?rutAlumno=${rutAlumno}`,
  { enabled: !!rutAlumno, staleTime: 5 * 60 * 1000 }
);
window.usePromedios = (rutAlumno) => useQuery(
  `/notas/promedios?rutAlumno=${rutAlumno}`,
  { enabled: !!rutAlumno, staleTime: 5 * 60 * 1000 }
);
window.useCreateNota = () => useMutation(
  (data) => apiClient.post('/notas', data),
  {
    invalidateQueries: ['/notas', '/notas/promedios', '/notas/agrupadas'],
    successMessage: '✅ Evaluación registrada correctamente'
  }
);
window.useUpdateNota = () => useMutation(
  ({ id, ...data }) => apiClient.put(`/notas?id=${id}`, data),
  {
    invalidateQueries: ['/notas', '/notas/promedios', '/notas/agrupadas'],
    successMessage: '✅ Evaluación actualizada'
  }
);
window.useDeleteNota = () => useMutation(
  (id) => apiClient.delete(`/notas?id=${id}`),
  {
    invalidateQueries: ['/notas', '/notas/promedios', '/notas/agrupadas'],
    successMessage: '✅ Evaluación eliminada'
  }
);
window.useNotasPorCurso = (curso, asignatura = null) => {
  const filters = { curso };
  if (asignatura) filters.asignatura = asignatura;
  return useNotas(filters);
};

// MATERIALES
const materialesAPI = createCRUDHooks('materiales', {
  staleTime: 5 * 60 * 1000,
  transform: (data) => data.materiales || data,
  labels: {
    create: '📁 Material subido correctamente',
    update: '✅ Material actualizado',
    delete: '✅ Material eliminado'
  }
});

window.useMateriales = materialesAPI.useList;
window.useMaterial = materialesAPI.useOne;
window.useCreateMaterial = materialesAPI.useCreate;
window.useUpdateMaterial = materialesAPI.useUpdate;
window.useDeleteMaterial = materialesAPI.useDelete;

// Revisión de Materiales (materiales.js - endpoints de dirección)
window.useAprobarMaterial = () => useMutation(
  ({ id, revisadoPor, observaciones }) =>
    apiClient.put(`/materiales/aprobar?id=${id}`, { revisadoPor, observaciones }),
  {
    invalidateQueries: ['/materiales'],
    successMessage: '✅ Material aprobado correctamente'
  }
);
window.useRechazarMaterial = () => useMutation(
  ({ id, revisadoPor, motivo }) =>
    apiClient.put(`/materiales/rechazar?id=${id}`, { revisadoPor, motivo }),
  {
    invalidateQueries: ['/materiales'],
    successMessage: '✅ Material rechazado'
  }
);
window.useSolicitarCorreccionMaterial = () => useMutation(
  ({ id, revisadoPor, observaciones }) =>
    apiClient.put(`/materiales/corregir?id=${id}`, { revisadoPor, observaciones }),
  {
    invalidateQueries: ['/materiales'],
    successMessage: '✅ Corrección solicitada'
  }
);

// MATRÍCULAS
const matriculasAPI = createCRUDHooks('matriculas', {
  staleTime: 5 * 60 * 1000,
  labels: {
    create: '✅ Solicitud de matrícula enviada correctamente'
  }
});

window.useMatriculas = matriculasAPI.useList;
window.useCreateMatricula = matriculasAPI.useCreate;
window.useUpdateEstadoMatricula = () => useMutation(
  ({ id, estado, ...data }) => apiClient.put(`/matriculas?id=${id}`, { estado, ...data }),
  {
    invalidateQueries: ['/matriculas'],
    successMessage: '✅ Estado de matrícula actualizado'
  }
);
window.useConvertirMatriculaAUsuario = () => useMutation(
  ({ id, curso }) => apiClient.post(`/matriculas/convertir-usuario?id=${id}`, { curso }),
  {
    invalidateQueries: ['/matriculas', '/usuarios'],
    successMessage: '✅ Usuario creado exitosamente desde matrícula'
  }
);

// CATEGORÍAS
const categoriasAPI = createCRUDHooks('categorias', {
  staleTime: 10 * 60 * 1000
});

window.useCategorias = categoriasAPI.useList;
window.useCreateCategoria = categoriasAPI.useCreate;
window.useUpdateCategoria = categoriasAPI.useUpdate;
window.useDeleteCategoria = categoriasAPI.useDelete;

// NOTIFICACIONES
window.useSendNotificacion = () => useMutation(
  (data) => apiClient.post('/notificaciones', data),
  {
    successMessage: '📧 Notificación enviada correctamente'
  }
);

// CONFIGURACIÓN
window.useConfiguracion = (key = null) => {
  const queryKey = key ? `/configuracion?key=${key}` : '/configuracion';
  return useQuery(queryKey, { staleTime: 15 * 60 * 1000 });
};
window.useCursos = () => useQuery('/configuracion?key=cursos', {
  staleTime: 15 * 60 * 1000,
  transform: (data) => data.cursos || []
});
window.useUpdateConfiguracion = () => useMutation(
  (data) => apiClient.put('/configuracion', data),
  {
    invalidateQueries: ['/configuracion'],
    successMessage: '✅ Configuración guardada correctamente'
  }
);

// RETROALIMENTACIÓN
const retroalimentacionAPI = createCRUDHooks('retroalimentacion', {
  staleTime: 3 * 60 * 1000,
  labels: {
    create: '✅ Retroalimentación enviada correctamente',
    delete: '✅ Retroalimentación eliminada'
  }
});

window.useRetroalimentacion = retroalimentacionAPI.useList;
window.useCreateRetroalimentacion = retroalimentacionAPI.useCreate;
window.useDeleteRetroalimentacion = retroalimentacionAPI.useDelete;

// SESIONES TERAPÉUTICAS (sesiones.js)
window.useSesiones = (filters = {}) => {
  const queryKey = createQueryKey('/sesiones', filters);
  return useQuery(queryKey, { staleTime: 2 * 60 * 1000 });
};
window.useCreateSesion = () => useMutation(
  (data) => apiClient.post('/sesiones', data),
  {
    invalidateQueries: ['/sesiones'],
    successMessage: '✅ Sesión registrada correctamente'
  }
);
window.useUpdateSesion = () => useMutation(
  ({ id, ...data }) => apiClient.put(`/sesiones?id=${id}`, data),
  {
    invalidateQueries: ['/sesiones'],
    successMessage: '✅ Sesión actualizada'
  }
);
window.useDeleteSesion = () => useMutation(
  (id) => apiClient.delete(`/sesiones?id=${id}`),
  {
    invalidateQueries: ['/sesiones'],
    successMessage: '✅ Sesión eliminada'
  }
);

// ARCHIVOS DE SESIONES (sesiones.js)
window.useSubirArchivoSesion = () => useMutation(
  (data) => apiClient.post('/sesiones/archivos', data),
  {
    invalidateQueries: ['/sesiones'],
    successMessage: '✅ Archivo subido correctamente'
  }
);
window.useDeleteArchivoSesionTerapeutica = () => useMutation(
  (id) => apiClient.delete(`/sesiones/archivos?id=${id}`),
  {
    invalidateQueries: ['/sesiones'],
    successMessage: '✅ Archivo eliminado'
  }
);

// RESERVAR EVALUACIÓN (reservar-evaluacion.js)
window.useReservasEvaluacion = () => useQuery('/reservar-evaluacion', {
  staleTime: 1 * 60 * 1000
});
window.useReservarEvaluacion = () => useMutation(
  (data) => apiClient.post('/reservar-evaluacion', data),
  {
    invalidateQueries: ['/reservar-evaluacion'],
    successMessage: '✅ Evaluación reservada correctamente'
  }
);
window.useBloquearHorario = () => useMutation(
  (data) => apiClient.post('/reservar-evaluacion', data),
  {
    invalidateQueries: ['/reservar-evaluacion'],
    successMessage: '✅ Horario bloqueado'
  }
);
window.useAceptarPaciente = () => useMutation(
  (data) => apiClient.post('/reservar-evaluacion', { tipo: 'aceptar', ...data }),
  {
    invalidateQueries: ['/reservar-evaluacion'],
    successMessage: '✅ Paciente aceptado'
  }
);
window.useEliminarReserva = () => useMutation(
  (fechaHora) => apiClient.delete('/reservar-evaluacion', { fechaHora }),
  {
    invalidateQueries: ['/reservar-evaluacion'],
    successMessage: '✅ Reserva eliminada'
  }
);

// ARCHIVOS DE SESIÓN
window.useArchivosSesion = (filters = {}) => {
  const queryKey = createQueryKey('/archivos-sesion', filters);
  return useQuery(queryKey, {
    enabled: !!(filters.rutAlumno || filters.idSesion)
  });
};
window.useCreateArchivoSesion = () => useMutation(
  (data) => apiClient.post('/archivos-sesion', data),
  {
    invalidateQueries: ['/archivos-sesion'],
    successMessage: '✅ Archivo de sesión guardado'
  }
);
window.useUpdateArchivoSesion = () => useMutation(
  ({ id, ...data }) => apiClient.put(`/archivos-sesion?id=${id}`, data),
  {
    invalidateQueries: ['/archivos-sesion'],
    successMessage: '✅ Archivo actualizado'
  }
);
window.useDeleteArchivoSesion = () => useMutation(
  (id) => apiClient.delete(`/archivos-sesion?id=${id}`),
  {
    invalidateQueries: ['/archivos-sesion'],
    successMessage: '✅ Archivo eliminado'
  }
);

// BITÁCORA
window.useBitacora = (filters = {}) => {
  const queryKey = createQueryKey('/bitacora', filters);
  return useQuery(queryKey, {
    enabled: !!filters.curso,
    staleTime: 5 * 60 * 1000
  });
};
window.useBitacoraFono = (filters = {}) => {
  const queryKey = createQueryKey('/bitacora-fono', filters);
  return useQuery(queryKey, { staleTime: 5 * 60 * 1000 });
};
window.useCreateBitacora = (tipo = 'clase') => {
  const url = tipo === 'fono' ? '/bitacora-fono' : '/bitacora';
  return useMutation(
    (data) => apiClient.post(url, data),
    {
      invalidateQueries: [url],
      successMessage: '✅ Bitácora registrada correctamente'
    }
  );
};
window.useDeleteBitacora = (tipo = 'clase') => {
  const url = tipo === 'fono' ? '/bitacora-fono' : '/bitacora';
  return useMutation(
    (id) => apiClient.delete(`${url}?id=${id}`),
    {
      invalidateQueries: [url],
      successMessage: '✅ Bitácora eliminada'
    }
  );
};

// INFORMES FONOAUDIOLOGÍA (informes.js)
window.useInformesFono = (filters = {}) => {
  const queryKey = createQueryKey('/informes', filters);
  return useQuery(queryKey, { staleTime: 5 * 60 * 1000 });
};
window.useInformeFono = (id) => useQuery(
  `/informes?id=${id}`,
  { enabled: !!id, staleTime: 5 * 60 * 1000 }
);
window.useCreateInformeFono = () => useMutation(
  (data) => apiClient.post('/informes', data),
  {
    invalidateQueries: ['/informes'],
    successMessage: '✅ Informe creado correctamente'
  }
);
window.useUpdateInformeFono = () => useMutation(
  ({ id, ...data }) => apiClient.put(`/informes?id=${id}`, data),
  {
    invalidateQueries: ['/informes'],
    successMessage: '✅ Informe actualizado'
  }
);
window.useDeleteInformeFono = () => useMutation(
  (id) => apiClient.delete(`/informes?id=${id}`),
  {
    invalidateQueries: ['/informes'],
    successMessage: '✅ Informe eliminado'
  }
);

// REPORTES Y ESTADÍSTICAS (reportes.js)
window.useReporteAsistencia = (filters) => {
  const queryKey = createQueryKey('/reportes/asistencia', filters);
  return useQuery(queryKey, {
    enabled: !!filters.curso,
    staleTime: 0
  });
};
window.useReporteCumplimiento = () => useQuery('/reportes/cumplimiento', {
  staleTime: 5 * 60 * 1000
});
window.useReporteActividades = (filters) => {
  const queryKey = createQueryKey('/reportes/actividades', filters);
  return useQuery(queryKey, {
    enabled: !!filters.usuario,
    staleTime: 2 * 60 * 1000
  });
};
window.useReporteNotas = (filters = {}) => {
  const queryKey = createQueryKey('/reportes/notas', filters);
  return useQuery(queryKey, { staleTime: 5 * 60 * 1000 });
};
window.useGenerarReporteConsolidado = () => useMutation(
  (data) => apiClient.post('/reportes/consolidado', data),
  {
    successMessage: '✅ Reporte consolidado generado'
  }
);
window.useReporteIndicadores = () => useQuery('/reportes/indicadores', {
  staleTime: 5 * 60 * 1000
});

// EXPORTAR REPORTES (exportar-reportes.js)
window.useExportarAsistencia = (filters) => {
  const queryKey = createQueryKey('/exportar/asistencia', filters);
  return useQuery(queryKey, {
    enabled: !!(filters.curso && filters.formato),
    staleTime: 0,
    refetchOnMount: true
  });
};
window.useExportarNotas = (filters = {}) => {
  const queryKey = createQueryKey('/exportar/notas', filters);
  return useQuery(queryKey, {
    enabled: !!filters.formato,
    staleTime: 0,
    refetchOnMount: true
  });
};
window.useExportarCumplimiento = (formato = 'csv') => {
  return useQuery(`/exportar/cumplimiento?formato=${formato}`, {
    enabled: !!formato,
    staleTime: 0,
    refetchOnMount: true
  });
};

// IMÁGENES / GALERÍA (images.js)
window.useImagenes = (filters = {}) => {
  const queryKey = createQueryKey('/images', filters);
  return useQuery(queryKey, { staleTime: 10 * 60 * 1000 });
};
window.useAlbumes = () => useQuery('/images?action=albums', {
  staleTime: 10 * 60 * 1000
});
window.useSubirImagen = () => useMutation(
  (data) => apiClient.post('/images', data),
  {
    invalidateQueries: ['/images'],
    successMessage: '✅ Imagen subida correctamente'
  }
);

// PROFESIONALES
window.useProfesionales = () => useQuery('/profesionales', {
  staleTime: 30 * 60 * 1000
});

// CONTACTO
window.useSendContacto = () => useMutation(
  (data) => apiClient.post('/contacto', data),
  {
    successMessage: '✅ Mensaje enviado correctamente. Nos contactaremos pronto.'
  }
);

// BACKUP (backup.js - solo admin)
window.useUltimoBackup = () => useQuery('/backup', {
  staleTime: 5 * 60 * 1000
});
window.useEjecutarBackup = () => useMutation(
  () => apiClient.post('/backup', {}),
  {
    invalidateQueries: ['/backup'],
    successMessage: '✅ Backup ejecutado correctamente'
  }
);

// RETROALIMENTACIÓN - Actualizar leída
window.useActualizarRetroalimentacion = () => useMutation(
  ({ id, rutUsuario, timestamp, ...data }) =>
    apiClient.put(`/retroalimentacion?id=${id}&rutUsuario=${rutUsuario}&timestamp=${timestamp}`, data),
  {
    invalidateQueries: ['/retroalimentacion'],
    successMessage: '✅ Retroalimentación actualizada'
  }
);

// BITÁCORA - Update
window.useUpdateBitacora = (tipo = 'clase') => {
  const url = tipo === 'fono' ? '/bitacora-fono' : '/bitacora';
  return useMutation(
    ({ id, ...data }) => apiClient.put(`${url}?id=${id}`, data),
    {
      invalidateQueries: [url],
      successMessage: '✅ Bitácora actualizada'
    }
  );
};

// EVENTOS - Actualizar evento
window.useUpdateEvento = () => useMutation(
  ({ id, ...data }) => apiClient.put(`/eventos?id=${id}`, data),
  {
    invalidateQueries: ['/eventos'],
    successMessage: '✅ Evento actualizado correctamente'
  }
);

// ANUNCIOS - Actualizar anuncio
window.useUpdateAnuncio = () => useMutation(
  ({ id, ...data }) => apiClient.put(`/anuncios?id=${id}`, data),
  {
    invalidateQueries: ['/anuncios'],
    successMessage: '✅ Anuncio actualizado correctamente'
  }
);

// MATRÍCULAS - Delete
window.useDeleteMatricula = () => useMutation(
  (id) => apiClient.delete(`/matriculas?id=${id}`),
  {
    invalidateQueries: ['/matriculas'],
    successMessage: '✅ Solicitud de matrícula eliminada'
  }
);

// ASISTENCIA - Delete
window.useDeleteAsistencia = () => useMutation(
  (id) => apiClient.delete(`/asistencia?id=${id}`),
  {
    invalidateQueries: ['/asistencia'],
    successMessage: '✅ Registro de asistencia eliminado'
  }
);

console.log('✅ endpoints.js cargado - Todos los endpoints configurados');
