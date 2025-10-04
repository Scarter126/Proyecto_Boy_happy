/**
 * Hooks y Mutations específicas para cada dominio
 * Centraliza todas las llamadas API del sistema
 *
 * Dominios:
 * - Usuarios
 * - Anuncios
 * - Eventos
 * - Asistencia
 * - Notas
 * - Materiales
 * - Matrículas
 * - Categorías
 * - Notificaciones
 * - Configuración
 * - Retroalimentación
 * - Agenda Fono
 * - Informes Fono
 * - Bitácora
 */

// ==========================================
// HELPERS
// ==========================================

/**
 * Crea una query key única para caching
 * @param {string} endpoint - Endpoint base
 * @param {Object} filters - Filtros opcionales
 * @returns {string} Query key única
 */
function createQueryKey(endpoint, filters = {}) {
  const filterKeys = Object.keys(filters).sort();
  if (filterKeys.length === 0) return endpoint;

  const filterString = filterKeys
    .map(key => `${key}=${filters[key]}`)
    .join('&');

  return `${endpoint}?${filterString}`;
}

// ==========================================
// USUARIOS
// ==========================================

window.useUsuarios = function(filters = {}) {
  const queryKey = createQueryKey('/usuarios', filters);
  return useQuery(queryKey, {
    transform: (data) => {
      // Normalizar estructura si es necesario
      return data;
    }
  });
};

window.useUsuario = function(rut) {
  return useQuery(
    `/usuarios?rut=${rut}`,
    {
      enabled: !!rut,
      transform: (data) => Array.isArray(data) ? data[0] : data
    }
  );
};

window.useCreateUsuario = function() {
  return useMutation(
    (data) => apiClient.post('/usuarios', data),
    {
      invalidateQueries: ['/usuarios'],
      successMessage: '✅ Usuario creado correctamente'
    }
  );
};

window.useUpdateUsuario = function() {
  return useMutation(
    ({ rut, ...data }) => apiClient.put(`/usuarios?rut=${rut}`, data),
    {
      invalidateQueries: ['/usuarios'],
      successMessage: '✅ Usuario actualizado correctamente'
    }
  );
};

window.useDeleteUsuario = function() {
  return useMutation(
    (rut) => apiClient.delete(`/usuarios?rut=${rut}`),
    {
      invalidateQueries: ['/usuarios'],
      successMessage: '✅ Usuario eliminado correctamente'
    }
  );
};

window.useCambiarRol = function() {
  return useMutation(
    ({ rut, nuevoRol }) => apiClient.put(`/usuarios/cambiar-rol?rut=${rut}`, { nuevoRol }),
    {
      invalidateQueries: ['/usuarios'],
      successMessage: '✅ Rol actualizado correctamente'
    }
  );
};

// ==========================================
// ANUNCIOS
// ==========================================

window.useAnuncios = function(filters = {}) {
  const queryKey = createQueryKey('/anuncios', filters);
  return useQuery(queryKey, {
    staleTime: 2 * 60 * 1000 // 2 minutos
  });
};

window.useCreateAnuncio = function() {
  return useMutation(
    (data) => apiClient.post('/anuncios', data),
    {
      invalidateQueries: ['/anuncios'],
      successMessage: '📢 Anuncio publicado correctamente'
    }
  );
};

window.useDeleteAnuncio = function() {
  return useMutation(
    (id) => apiClient.delete(`/anuncios?id=${id}`),
    {
      invalidateQueries: ['/anuncios'],
      successMessage: '✅ Anuncio eliminado'
    }
  );
};

// ==========================================
// EVENTOS / CALENDARIO
// ==========================================

window.useEventos = function(filters = {}) {
  const queryKey = createQueryKey('/eventos', filters);
  return useQuery(queryKey, {
    staleTime: 5 * 60 * 1000 // 5 minutos
  });
};

window.useCreateEvento = function() {
  return useMutation(
    (data) => apiClient.post('/eventos', data),
    {
      invalidateQueries: ['/eventos'],
      successMessage: '📅 Evento creado correctamente'
    }
  );
};

window.useUpdateEvento = function() {
  return useMutation(
    ({ id, ...data }) => apiClient.put(`/eventos?id=${id}`, data),
    {
      invalidateQueries: ['/eventos'],
      successMessage: '✅ Evento actualizado'
    }
  );
};

window.useDeleteEvento = function() {
  return useMutation(
    (id) => apiClient.delete(`/eventos?id=${id}`),
    {
      invalidateQueries: ['/eventos'],
      successMessage: '✅ Evento eliminado'
    }
  );
};

// ==========================================
// ASISTENCIA
// ==========================================

window.useAsistencia = function(filters = {}) {
  const queryKey = createQueryKey('/asistencia', filters);
  return useQuery(queryKey, {
    enabled: !!(filters.curso && filters.fecha),
    staleTime: 0 // Siempre refetch (datos cambian frecuentemente)
  });
};

window.useAsistenciaAlumno = function(rutAlumno) {
  return useQuery(
    `/asistencia?rutAlumno=${rutAlumno}`,
    {
      enabled: !!rutAlumno,
      staleTime: 1 * 60 * 1000
    }
  );
};

window.useRegistrarAsistencia = function() {
  return useMutation(
    (data) => apiClient.post('/asistencia', data),
    {
      invalidateQueries: ['/asistencia'],
      successMessage: '✅ Asistencia registrada correctamente'
    }
  );
};

window.useActualizarAsistencia = function() {
  return useMutation(
    ({ id, ...data }) => apiClient.put(`/asistencia?id=${id}`, data),
    {
      invalidateQueries: ['/asistencia'],
      successMessage: '✅ Asistencia actualizada'
    }
  );
};

// ==========================================
// NOTAS / EVALUACIONES
// ==========================================

window.useNotas = function(filters = {}) {
  const queryKey = createQueryKey('/notas', filters);
  return useQuery(queryKey, {
    enabled: !!(filters.curso || filters.rutAlumno),
    staleTime: 3 * 60 * 1000
  });
};

window.useNotasAgrupadas = function(rutAlumno) {
  return useQuery(
    `/notas/agrupadas?rutAlumno=${rutAlumno}`,
    {
      enabled: !!rutAlumno,
      staleTime: 5 * 60 * 1000
    }
  );
};

window.usePromedios = function(rutAlumno) {
  return useQuery(
    `/notas/promedios?rutAlumno=${rutAlumno}`,
    {
      enabled: !!rutAlumno,
      staleTime: 5 * 60 * 1000
    }
  );
};

window.useCreateNota = function() {
  return useMutation(
    (data) => apiClient.post('/notas', data),
    {
      invalidateQueries: ['/notas', '/notas/promedios', '/notas/agrupadas'],
      successMessage: '✅ Evaluación registrada correctamente'
    }
  );
};

window.useUpdateNota = function() {
  return useMutation(
    ({ id, ...data }) => apiClient.put(`/notas?id=${id}`, data),
    {
      invalidateQueries: ['/notas', '/notas/promedios', '/notas/agrupadas'],
      successMessage: '✅ Evaluación actualizada'
    }
  );
};

window.useDeleteNota = function() {
  return useMutation(
    (id) => apiClient.delete(`/notas?id=${id}`),
    {
      invalidateQueries: ['/notas', '/notas/promedios', '/notas/agrupadas'],
      successMessage: '✅ Evaluación eliminada'
    }
  );
};

// ==========================================
// MATERIALES
// ==========================================

window.useMateriales = function(filters = {}) {
  const queryKey = createQueryKey('/materiales', filters);
  return useQuery(queryKey, {
    staleTime: 5 * 60 * 1000,
    transform: (data) => {
      // Backend puede retornar { materiales: [], total } o array directo
      return data.materiales || data;
    }
  });
};

window.useMaterial = function(id) {
  return useQuery(
    `/materiales?id=${id}`,
    {
      enabled: !!id,
      staleTime: 10 * 60 * 1000
    }
  );
};

window.useCreateMaterial = function() {
  return useMutation(
    (data) => apiClient.post('/materiales', data),
    {
      invalidateQueries: ['/materiales'],
      successMessage: '📁 Material subido correctamente'
    }
  );
};

window.useUpdateMaterial = function() {
  return useMutation(
    ({ id, ...data }) => apiClient.put(`/materiales?id=${id}`, data),
    {
      invalidateQueries: ['/materiales'],
      successMessage: '✅ Material actualizado'
    }
  );
};

window.useDeleteMaterial = function() {
  return useMutation(
    (id) => apiClient.delete(`/materiales?id=${id}`),
    {
      invalidateQueries: ['/materiales'],
      successMessage: '✅ Material eliminado'
    }
  );
};

// ==========================================
// MATRÍCULAS
// ==========================================

window.useMatriculas = function(filters = {}) {
  const queryKey = createQueryKey('/matriculas', filters);
  return useQuery(queryKey, {
    staleTime: 5 * 60 * 1000
  });
};

window.useCreateMatricula = function() {
  return useMutation(
    (data) => apiClient.post('/matriculas', data),
    {
      invalidateQueries: ['/matriculas'],
      successMessage: '✅ Solicitud de matrícula enviada correctamente'
    }
  );
};

window.useUpdateEstadoMatricula = function() {
  return useMutation(
    ({ id, estado, ...data }) => apiClient.put(`/matriculas?id=${id}`, { estado, ...data }),
    {
      invalidateQueries: ['/matriculas'],
      successMessage: '✅ Estado de matrícula actualizado'
    }
  );
};

window.useConvertirMatriculaAUsuario = function() {
  return useMutation(
    ({ id, curso }) => apiClient.post(`/matriculas/convertir-usuario?id=${id}`, { curso }),
    {
      invalidateQueries: ['/matriculas', '/usuarios'],
      successMessage: '✅ Usuario creado exitosamente desde matrícula'
    }
  );
};

// ==========================================
// CATEGORÍAS
// ==========================================

window.useCategorias = function() {
  return useQuery('/categorias', {
    staleTime: 10 * 60 * 1000 // Categorías cambian poco
  });
};

window.useCreateCategoria = function() {
  return useMutation(
    (data) => apiClient.post('/categorias', data),
    {
      invalidateQueries: ['/categorias'],
      successMessage: '✅ Categoría creada correctamente'
    }
  );
};

window.useUpdateCategoria = function() {
  return useMutation(
    ({ id, ...data }) => apiClient.put(`/categorias?id=${id}`, data),
    {
      invalidateQueries: ['/categorias'],
      successMessage: '✅ Categoría actualizada'
    }
  );
};

window.useDeleteCategoria = function() {
  return useMutation(
    (id) => apiClient.delete(`/categorias?id=${id}`),
    {
      invalidateQueries: ['/categorias'],
      successMessage: '✅ Categoría eliminada'
    }
  );
};

// ==========================================
// NOTIFICACIONES
// ==========================================

window.useSendNotificacion = function() {
  return useMutation(
    (data) => apiClient.post('/notificaciones', data),
    {
      successMessage: '📧 Notificación enviada correctamente',
      showSuccessNotification: true
    }
  );
};

// ==========================================
// CONFIGURACIÓN
// ==========================================

window.useConfiguracion = function(key = null) {
  const queryKey = key ? `/configuracion?key=${key}` : '/configuracion';
  return useQuery(queryKey, {
    staleTime: 15 * 60 * 1000 // 15 minutos
  });
};

window.useCursos = function() {
  return useQuery('/configuracion?key=cursos', {
    staleTime: 15 * 60 * 1000,
    transform: (data) => data.cursos || []
  });
};

window.useUpdateConfiguracion = function() {
  return useMutation(
    (data) => apiClient.put('/configuracion', data),
    {
      invalidateQueries: ['/configuracion'],
      successMessage: '✅ Configuración guardada correctamente'
    }
  );
};

// ==========================================
// RETROALIMENTACIÓN
// ==========================================

window.useRetroalimentacion = function(filters = {}) {
  const queryKey = createQueryKey('/retroalimentacion', filters);
  return useQuery(queryKey, {
    staleTime: 3 * 60 * 1000
  });
};

window.useCreateRetroalimentacion = function() {
  return useMutation(
    (data) => apiClient.post('/retroalimentacion', data),
    {
      invalidateQueries: ['/retroalimentacion'],
      successMessage: '✅ Retroalimentación enviada correctamente'
    }
  );
};

window.useDeleteRetroalimentacion = function() {
  return useMutation(
    (id) => apiClient.delete(`/retroalimentacion?id=${id}`),
    {
      invalidateQueries: ['/retroalimentacion'],
      successMessage: '✅ Retroalimentación eliminada'
    }
  );
};

// ==========================================
// AGENDA FONOAUDIOLOGÍA
// ==========================================

window.useAgendaFono = function(filters = {}) {
  const queryKey = createQueryKey('/agenda-fono', filters);
  return useQuery(queryKey, {
    staleTime: 1 * 60 * 1000 // 1 minuto (agenda cambia frecuentemente)
  });
};

window.useCreateAgendaFono = function() {
  return useMutation(
    (data) => apiClient.post('/agenda-fono', data),
    {
      invalidateQueries: ['/agenda-fono'],
      successMessage: '✅ Bloque de agenda creado correctamente'
    }
  );
};

window.useUpdateAgendaFono = function() {
  return useMutation(
    ({ id, ...data }) => apiClient.put(`/agenda-fono?id=${id}`, data),
    {
      invalidateQueries: ['/agenda-fono'],
      successMessage: '✅ Agenda actualizada'
    }
  );
};

window.useDeleteAgendaFono = function() {
  return useMutation(
    (id) => apiClient.delete(`/agenda-fono?id=${id}`),
    {
      invalidateQueries: ['/agenda-fono'],
      successMessage: '✅ Bloque eliminado'
    }
  );
};

window.useReservarEvaluacion = function() {
  return useMutation(
    (data) => apiClient.post('/reservar-evaluacion', data),
    {
      invalidateQueries: ['/agenda-fono'],
      successMessage: '✅ Evaluación reservada correctamente'
    }
  );
};

// ==========================================
// ARCHIVOS DE SESIÓN (FONOAUDIOLOGÍA)
// ==========================================

window.useArchivosSesion = function(filters = {}) {
  const queryKey = createQueryKey('/archivos-sesion', filters);
  return useQuery(queryKey, {
    enabled: !!(filters.rutAlumno || filters.idSesion)
  });
};

window.useCreateArchivoSesion = function() {
  return useMutation(
    (data) => apiClient.post('/archivos-sesion', data),
    {
      invalidateQueries: ['/archivos-sesion'],
      successMessage: '✅ Archivo de sesión guardado'
    }
  );
};

window.useUpdateArchivoSesion = function() {
  return useMutation(
    ({ id, ...data }) => apiClient.put(`/archivos-sesion?id=${id}`, data),
    {
      invalidateQueries: ['/archivos-sesion'],
      successMessage: '✅ Archivo actualizado'
    }
  );
};

window.useDeleteArchivoSesion = function() {
  return useMutation(
    (id) => apiClient.delete(`/archivos-sesion?id=${id}`),
    {
      invalidateQueries: ['/archivos-sesion'],
      successMessage: '✅ Archivo eliminado'
    }
  );
};

// ==========================================
// BITÁCORA (PROFESORES Y FONO)
// ==========================================

window.useBitacora = function(filters = {}) {
  const queryKey = createQueryKey('/bitacora', filters);
  return useQuery(queryKey, {
    enabled: !!filters.curso,
    staleTime: 5 * 60 * 1000
  });
};

window.useBitacoraFono = function(filters = {}) {
  const queryKey = createQueryKey('/bitacora-fono', filters);
  return useQuery(queryKey, {
    staleTime: 5 * 60 * 1000
  });
};

window.useCreateBitacora = function(tipo = 'clase') {
  const url = tipo === 'fono' ? '/bitacora-fono' : '/bitacora';

  return useMutation(
    (data) => apiClient.post(url, data),
    {
      invalidateQueries: [url],
      successMessage: '✅ Bitácora registrada correctamente'
    }
  );
};

window.useDeleteBitacora = function(tipo = 'clase') {
  const url = tipo === 'fono' ? '/bitacora-fono' : '/bitacora';

  return useMutation(
    (id) => apiClient.delete(`${url}?id=${id}`),
    {
      invalidateQueries: [url],
      successMessage: '✅ Bitácora eliminada'
    }
  );
};

// ==========================================
// INFORMES FONOAUDIOLOGÍA
// ==========================================

window.useInformesFono = function(filters = {}) {
  const queryKey = createQueryKey('/informes-fono', filters);
  return useQuery(queryKey, {
    staleTime: 5 * 60 * 1000
  });
};

window.useInformeFono = function(id) {
  return useQuery(
    `/informes-fono?id=${id}`,
    {
      enabled: !!id,
      staleTime: 10 * 60 * 1000
    }
  );
};

window.useCreateInformeFono = function() {
  return useMutation(
    (data) => apiClient.post('/informes-fono', data),
    {
      invalidateQueries: ['/informes-fono'],
      successMessage: '✅ Informe creado correctamente'
    }
  );
};

window.useUpdateInformeFono = function() {
  return useMutation(
    ({ id, ...data }) => apiClient.put(`/informes-fono?id=${id}`, data),
    {
      invalidateQueries: ['/informes-fono'],
      successMessage: '✅ Informe actualizado'
    }
  );
};

window.useDeleteInformeFono = function() {
  return useMutation(
    (id) => apiClient.delete(`/informes-fono?id=${id}`),
    {
      invalidateQueries: ['/informes-fono'],
      successMessage: '✅ Informe eliminado'
    }
  );
};

// ==========================================
// REPORTES Y ESTADÍSTICAS
// ==========================================

window.useReporteAsistencia = function(filters) {
  const queryKey = createQueryKey('/reportes/asistencia', filters);
  return useQuery(queryKey, {
    enabled: !!(filters.curso && filters.fechaInicio && filters.fechaFin),
    staleTime: 0 // No cache (datos dinámicos)
  });
};

window.useDashboardIndicadores = function() {
  return useQuery('/dashboard/indicadores', {
    staleTime: 2 * 60 * 1000 // 2 minutos
  });
};

window.useComparativoCursos = function(filters) {
  const queryKey = createQueryKey('/reportes/comparativo', filters);
  return useQuery(queryKey, {
    enabled: !!(filters.cursos && filters.cursos.length > 0),
    staleTime: 5 * 60 * 1000
  });
};

// ==========================================
// IMÁGENES / GALERÍA
// ==========================================

window.useImagenes = function(filters = {}) {
  const queryKey = createQueryKey('/imagenes', filters);
  return useQuery(queryKey, {
    staleTime: 10 * 60 * 1000
  });
};

window.useAlbumes = function() {
  return useQuery('/imagenes?action=albums', {
    staleTime: 10 * 60 * 1000
  });
};

// ==========================================
// PROFESIONALES (HOME)
// ==========================================

window.useProfesionales = function() {
  return useQuery('/profesionales', {
    staleTime: 30 * 60 * 1000 // 30 minutos (cambia poco)
  });
};

// ==========================================
// CONTACTO
// ==========================================

window.useSendContacto = function() {
  return useMutation(
    (data) => apiClient.post('/contacto', data),
    {
      successMessage: '✅ Mensaje enviado correctamente. Nos contactaremos pronto.',
      showSuccessNotification: true
    }
  );
};

// ==========================================
// HELPERS COMPUESTOS
// ==========================================

/**
 * Hook compuesto: Usuarios filtrados por rol
 */
window.useUsuariosPorRol = function(rol) {
  return useQuery(
    `/usuarios?rol=${rol}`,
    {
      enabled: !!rol,
      staleTime: 5 * 60 * 1000
    }
  );
};

/**
 * Hook compuesto: Alumnos de un curso
 */
window.useAlumnosPorCurso = function(curso) {
  return useQuery(
    `/usuarios?rol=alumno&curso=${curso}`,
    {
      enabled: !!curso,
      staleTime: 5 * 60 * 1000
    }
  );
};

/**
 * Hook compuesto: Notas de un curso
 */
window.useNotasPorCurso = function(curso, asignatura = null) {
  const filters = { curso };
  if (asignatura) filters.asignatura = asignatura;

  return useNotas(filters);
};

console.log('✅ API Hooks cargados correctamente');
