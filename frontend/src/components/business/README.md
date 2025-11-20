# Business Components - Boy Happy

Componentes React de negocio que representan entidades del dominio. Migrados desde Alpine.js HTML a React JSX.

## Componentes Disponibles (Group A - Simple)

### 1. AnuncioCard
**Archivo:** `AnuncioCard.jsx`
**Fuente:** `anuncio-card.html`

Tarjeta de anuncio/comunicado para apoderados.

**Props:**
- `anuncio` (Object): Datos del anuncio
  - `titulo` (string): Título del anuncio
  - `contenido` (string): Contenido del anuncio
  - `fecha` (string): Fecha ISO
  - `autor` (string, opcional): Autor del anuncio
  - `categoria` (string, opcional): 'urgente', 'evento', 'recordatorio', 'informacion'
  - `esNuevo` (boolean, opcional): Muestra badge "Nuevo"
  - `destinatarios` (string, opcional): Destinatarios
  - `archivoUrl` (string, opcional): URL del archivo adjunto
  - `archivoNombre` (string, opcional): Nombre del archivo
  - `archivoTamanio` (string, opcional): Tamaño del archivo

**Características:**
- Contenido expandible (leer más/menos)
- Badge "Nuevo" condicional
- Categorías con colores distintivos
- Descarga de archivos adjuntos
- Formato de fecha largo

**Ejemplo:**
```jsx
import { AnuncioCard } from '@/components/business';

<AnuncioCard
  anuncio={{
    id: "anun-001",
    titulo: "Reunión de Apoderados - Viernes 27 de Octubre",
    contenido: "Estimados apoderados: Les recordamos...",
    fecha: "2025-10-23",
    autor: "Dirección",
    categoria: "evento",
    esNuevo: true,
    destinatarios: "todos",
    archivoUrl: "/docs/agenda-reunion.pdf",
    archivoNombre: "Agenda Reunión.pdf",
    archivoTamanio: "245 KB"
  }}
/>
```

---

### 2. CursoCard
**Archivo:** `CursoCard.jsx`
**Fuente:** `curso-card.html`

Tarjeta visual de curso con métricas.

**Props:**
- `curso` (Object): Datos del curso
  - `nombre` (string): Nombre del curso
  - `alumnos` (number): Número de alumnos
  - `asistencia` (string): Porcentaje de asistencia (ej: "92%")
  - `materialesPublicados` (number, opcional): Materiales publicados
  - `materialesTotal` (number, opcional): Total de materiales
  - `semaforoColor` (string, opcional): Color del semáforo (#hex)
  - `registrosAsistencia` (number, opcional): Número de registros
- `colorIndex` (number, opcional): Índice para color temático (0-7)
- `onClick` (Function, opcional): Callback al hacer click

**Características:**
- Colores temáticos rotativos (8 colores)
- Semáforo de estado animado
- Métricas visuales
- Efectos hover (elevación)
- Grid de 2 columnas para métricas

**Ejemplo:**
```jsx
import { CursoCard } from '@/components/business';

<CursoCard
  curso={{
    nombre: "Medio Mayor",
    alumnos: 25,
    asistencia: "92%",
    materialesPublicados: 8,
    materialesTotal: 10,
    semaforoColor: "#4caf50",
    registrosAsistencia: 120
  }}
  colorIndex={0}
  onClick={() => navigate('/curso/medio-mayor')}
/>
```

---

### 3. AsistenciaRow
**Archivo:** `AsistenciaRow.jsx`
**Fuente:** `asistencia-row.html`

Fila de registro de asistencia diaria.

**Props:**
- `alumno` (Object): Datos del alumno
  - `rut` (string): RUT del alumno
  - `nombre` (string): Nombre completo
  - `genero` (string, opcional): 'M' o 'F' (afecta color del avatar)
  - `estadoAsistencia` (string, opcional): Estado inicial
- `onEstadoChange` (Function, opcional): `(alumno, nuevoEstado) => void`
- `onAgregarObservacion` (Function, opcional): `(alumno) => void`

**Características:**
- Avatar con iniciales (color según género)
- 3 estados: Presente, Ausente, Justificado
- Fondo dinámico según estado
- Indicador visual de estado
- Botón de observación
- Efectos hover

**Ejemplo:**
```jsx
import { AsistenciaRow } from '@/components/business';

<AsistenciaRow
  alumno={{
    rut: "12345678-9",
    nombre: "Sofía Pérez",
    genero: "F",
    estadoAsistencia: "pendiente"
  }}
  onEstadoChange={(alumno, estado) => {
    console.log(`${alumno.nombre} ahora está: ${estado}`);
  }}
  onAgregarObservacion={(alumno) => {
    openObservacionModal(alumno);
  }}
/>
```

---

### 4. MaterialCard
**Archivo:** `MaterialCard.jsx`
**Fuente:** `material-card.html`

Tarjeta de material educativo con acciones.

**Props:**
- `material` (Object): Datos del material
  - `id` (string): ID único
  - `titulo` (string): Título del material
  - `descripcion` (string, opcional): Descripción
  - `categoria` (string, opcional): Categoría
  - `asignatura` (string, opcional): Asignatura
  - `curso` (string, opcional): Curso
  - `estado` (string, opcional): 'pendiente', 'aprobado', 'rechazado', 'requiere_correccion'
  - `fechaSubida` (string, opcional): Fecha ISO
  - `creadoPor` (string, opcional): Autor
  - `archivoUrl` (string, opcional): URL del archivo
  - `archivoNombre` (string, opcional): Nombre del archivo
  - `archivoSize` (string, opcional): Tamaño
- `showActions` (boolean): Mostrar botones de acción
- `onVerDetalle` (Function, opcional): `(material) => void`
- `onAprobar` (Function, opcional): `(material) => void`
- `onSolicitarCorreccion` (Function, opcional): `(material) => void`
- `onRechazar` (Function, opcional): `(material) => void`

**Características:**
- Badge de estado usando `EstadoBadge`
- Metadata: curso, fecha, autor
- Archivo descargable con icono PDF
- Acciones condicionales (solo en estado 'pendiente')
- Formato de fecha corto

**Ejemplo:**
```jsx
import { MaterialCard } from '@/components/business';

<MaterialCard
  material={{
    id: "mat-001",
    titulo: "Guía de Lenguaje - Vocales",
    descripcion: "Material didáctico para enseñar las vocales",
    categoria: "Lenguaje",
    curso: "Medio Mayor",
    estado: "pendiente",
    fechaSubida: "2025-10-20",
    creadoPor: "Prof. María González",
    archivoUrl: "/uploads/guia-vocales.pdf",
    archivoNombre: "guia-vocales.pdf",
    archivoSize: "2.5 MB"
  }}
  showActions={true}
  onAprobar={(material) => aprobarMaterial(material.id)}
  onRechazar={(material) => rechazarMaterial(material.id)}
/>
```

---

### 5. EventoCard
**Archivo:** `EventoCard.jsx`
**Fuente:** `evento-card.html`

Tarjeta de evento del calendario.

**Props:**
- `evento` (Object): Datos del evento
  - `id` (string): ID único
  - `titulo` (string): Título del evento
  - `descripcion` (string, opcional): Descripción
  - `fecha` (string): Fecha ISO
  - `hora` (string, opcional): Hora (ej: "18:00")
  - `lugar` (string, opcional): Lugar
  - `tipo` (string, opcional): 'reunion', 'evaluacion', 'actividad', 'otro'
  - `tipoLabel` (string, opcional): Etiqueta personalizada del tipo
  - `participantes` (string, opcional): Participantes
- `onVerDetalle` (Function, opcional): `(evento) => void`
- `onEditar` (Function, opcional): `(evento) => void`
- `onEliminar` (Function, opcional): `(evento) => void`

**Características:**
- Fecha destacada en box con color temático
- 4 tipos predefinidos con colores
- Badge de tipo con icono
- Metadata: hora, lugar, participantes
- Acciones: editar y eliminar
- Efectos hover (deslizamiento)

**Ejemplo:**
```jsx
import { EventoCard } from '@/components/business';

<EventoCard
  evento={{
    id: "evt-001",
    titulo: "Reunión de Apoderados",
    descripcion: "Reunión mensual para revisar avances del curso",
    fecha: "2025-10-27",
    hora: "18:00",
    lugar: "Sala Multiuso",
    tipo: "reunion",
    tipoLabel: "Reunión",
    participantes: "Apoderados Medio Mayor"
  }}
  onVerDetalle={(evento) => navigate(`/evento/${evento.id}`)}
  onEditar={(evento) => openEditModal(evento)}
  onEliminar={(evento) => deleteEvento(evento.id)}
/>
```

---

## Dependencias

Todos los componentes dependen de:

- **React** (hooks: `useState`)
- **@/utils/helpers**: `formatDate`, `formatRut`, etc.
- **@/components/ui/Badge**: `EstadoBadge` (solo MaterialCard)

## Notas de Migración

### Cambios de Alpine.js a React:

1. **Estado Local:**
   - `x-data` → `useState`
   - Estado reactivo manejado por React

2. **Directivas:**
   - `x-show` → Renderizado condicional con `&&` o ternario
   - `x-text` → `{variable}`
   - `x-html` → Componente JSX
   - `@click` → `onClick`
   - `:class` → Template literals en `className`
   - `:style` → Objetos de estilo inline

3. **Eventos:**
   - `$parent.method()` → Props callbacks
   - Manejo de eventos sintético de React

4. **Formatters:**
   - `window.Helpers.formatDate()` → `import { formatDate } from '@/utils/helpers'`

5. **Componentes:**
   - `window.Helpers.renderEstadoBadge()` → `<EstadoBadge />`

### Mejoras Implementadas:

- JSDoc completo con tipos
- PropTypes documentados
- Mejor separación de responsabilidades
- Callbacks explícitos en lugar de acceso al padre
- Manejo de estado más predecible
- Mejor performance con React

### Compatibilidad de Estilos:

- Se mantienen las mismas clases CSS (`.card`, `.btn`, etc.)
- Estilos inline preservados para compatibilidad
- Sin cambios en la apariencia visual

## Uso en Aplicación

### Import Individual:
```jsx
import { AnuncioCard } from '@/components/business';
```

### Import Múltiple:
```jsx
import {
  AnuncioCard,
  CursoCard,
  AsistenciaRow,
  MaterialCard,
  EventoCard
} from '@/components/business';
```

## Testing

Cada componente puede ser testeado de forma independiente:

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CursoCard } from '@/components/business';

test('renders curso card with correct data', () => {
  const curso = {
    nombre: "Medio Mayor",
    alumnos: 25,
    asistencia: "92%"
  };

  render(<CursoCard curso={curso} />);
  expect(screen.getByText('Medio Mayor')).toBeInTheDocument();
  expect(screen.getByText('25')).toBeInTheDocument();
});
```

---

## Próximos Pasos

**Group B - Complex Components** (próxima migración):
- usuario-form.html → UsuarioForm.jsx
- alumno-form.html → AlumnoForm.jsx
- matricula-form.html → MatriculaForm.jsx
- bitacora-form.html → BitacoraForm.jsx
- material-form.html → MaterialForm.jsx

**Group C - Interactive Components** (migración futura):
- evaluacion-grid.html → EvaluacionGrid.jsx
- comparativo-table.html → ComparativoTable.jsx
- timeline-entry.html → TimelineEntry.jsx
- retro-form.html → RetroForm.jsx
- notificacion-config.html → NotificacionConfig.jsx
