# Guía de Migración: Hooks React Query

## 📋 Resumen

Este documento explica cómo migrar hooks de React Query existentes al nuevo sistema de factory que:

- **Reduce código repetitivo**: De ~150 líneas a ~10 líneas por hook
- **Centraliza notificaciones**: Usa `notificationService` en lugar de 77+ llamadas a `Swal.fire`
- **Consistencia**: Mismo comportamiento en todos los hooks
- **Mantenibilidad**: Cambios en un solo lugar afectan todos los hooks

## 🔄 Antes y Después

### ❌ ANTES (Código Duplicado)

```javascript
// hooks/useUsuarios.js - 170 líneas con 80% de código repetitivo

export const useCreateUsuario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => apiClient.post('/usuarios', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: 'Usuario creado correctamente',
      });
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error al crear usuario',
      });
    },
  });
};

export const useUpdateUsuario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => apiClient.put(`/usuarios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: 'Usuario actualizado correctamente',
      });
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error al actualizar usuario',
      });
    },
  });
};

// ... 8 hooks más con el mismo patrón
```

### ✅ DESPUÉS (Factory Pattern)

```javascript
// hooks/useUsuarios.js - 15 líneas, sin código repetitivo

import { createCrudHooks } from '../lib/mutationFactory';

// Crea automáticamente useCreate, useUpdate, useDelete
const { useCreate, useUpdate, useDelete } = createCrudHooks(
  '/usuarios',
  'usuario',
  'usuarios'
);

export const useCreateUsuario = useCreate;
export const useUpdateUsuario = useUpdate;
export const useDeleteUsuario = useDelete;

// Para queries (GET), mantener la implementación actual
export const useUsuarios = () => useQuery({
  queryKey: ['usuarios'],
  queryFn: () => apiClient.get('/usuarios').then(res => res.data),
});
```

## 🎯 Pasos de Migración

### 1. Identificar hooks candidatos

Busca hooks con este patrón:

```javascript
useMutation({
  mutationFn: ...,
  onSuccess: () => {
    queryClient.invalidateQueries(...);
    Swal.fire({ icon: 'success', ... });
  },
  onError: (error) => {
    Swal.fire({ icon: 'error', ... });
  },
});
```

### 2. Reemplazar con factory

Para hooks **CRUD estándar** (Create, Update, Delete):

```javascript
import { createCrudHooks } from '../lib/mutationFactory';

const { useCreate, useUpdate, useDelete } = createCrudHooks(
  '/endpoint',     // Endpoint base
  'recurso',       // Nombre para mensajes
  'queryKey'       // Key de React Query
);

export const useCreateRecurso = useCreate;
export const useUpdateRecurso = useUpdate;
export const useDeleteRecurso = useDelete;
```

Para hooks **personalizados**:

```javascript
import { createMutationHook } from '../lib/mutationFactory';

export const useAprobarMatricula = createMutationHook(
  '/matriculas/aprobar',
  'matrícula',
  'matriculas',
  {
    successMessage: 'Matrícula aprobada correctamente',
    useToast: true, // Usa toast en lugar de modal
  }
);
```

### 3. Opciones avanzadas

```javascript
createCrudHooks('/endpoint', 'recurso', 'queryKey', {
  showSuccessNotification: true,  // Mostrar notificación de éxito
  showErrorNotification: true,    // Mostrar notificación de error
  useToast: false,               // Usar toast en vez de modal
  invalidateQueries: true,       // Invalidar queries automáticamente
  successMessage: 'Mensaje personalizado', // Mensaje de éxito custom
});
```

## 📂 Archivos a Migrar

### Prioridad ALTA (más de 5 mutations)

- [ ] `hooks/useUsuarios.js` - 10 mutations
- [ ] `hooks/useMatriculas.js` - 8 mutations
- [ ] `hooks/useMateriales.js` - 7 mutations
- [ ] `hooks/useSesiones.js` - 9 mutations
- [ ] `hooks/useAsistencia.js` - 6 mutations

### Prioridad MEDIA (3-5 mutations)

- [ ] `hooks/useEvaluaciones.js` - 5 mutations
- [ ] `hooks/useEventos.js` - 4 mutations
- [ ] `hooks/useAnuncios.js` - 4 mutations
- [ ] `hooks/useNotificaciones.js` - 3 mutations

### Prioridad BAJA (1-2 mutations)

- [ ] Resto de hooks (~12 archivos)

## 🧪 Testing

Después de migrar un hook:

1. **Verificar creación**: Crear un registro y verificar notificación
2. **Verificar actualización**: Editar un registro y verificar notificación
3. **Verificar eliminación**: Eliminar un registro y verificar notificación
4. **Verificar errores**: Provocar un error y verificar notificación de error

## 🎨 Customizaciones Comunes

### Notificación sin modal (toast)

```javascript
useCreateRecurso = createMutationHook('/recurso', 'recurso', 'recursos', {
  useToast: true,
});
```

### Sin invalidación automática de queries

```javascript
useCustomAction = createMutationHook('/action', 'acción', 'actions', {
  invalidateQueries: false,
});
```

### Mensaje personalizado

```javascript
useAprobar = createMutationHook('/aprobar', 'solicitud', 'solicitudes', {
  successMessage: 'Solicitud aprobada y notificación enviada',
});
```

### Sin notificaciones (para acciones silenciosas)

```javascript
useSilentUpdate = createMutationHook('/update', 'dato', 'datos', {
  showSuccessNotification: false,
  showErrorNotification: false,
});
```

## 🚀 Beneficios Post-Migración

- **Reducción de código**: ~85% menos líneas de código
- **Consistencia**: Mismo UX en todas las notificaciones
- **Mantenibilidad**: Cambio global en 1 lugar
- **Performance**: Menos bundle size
- **Testing**: Más fácil de testear

## 📊 Progreso de Migración

Actualizar después de migrar cada hook:

```
Total hooks: 21
Migrados: 0/21 (0%)
Líneas eliminadas: ~0/1,500
```

## ❓ FAQ

**P: ¿Qué pasa con queries (GET)?**
R: Las queries se mantienen como están. El factory solo afecta mutations (POST, PUT, DELETE).

**P: ¿Puedo personalizar completamente un hook?**
R: Sí, usa `customMutationHook` para control total.

**P: ¿Es compatible con el código existente?**
R: 100% compatible. Los componentes que usan los hooks no necesitan cambios.

**P: ¿Y si necesito lógica adicional en onSuccess?**
R: Usa `useMutation` directamente o extiende el factory según necesidad.
