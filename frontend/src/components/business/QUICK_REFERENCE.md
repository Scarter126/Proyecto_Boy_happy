# Quick Reference - Group B Business Components

Quick reference guide for using the 5 medium complexity business components.

---

## AlumnoCard

**Use for:** Student information display

```jsx
import { AlumnoCard } from '@/components/business';

// Compact Mode
<AlumnoCard
  alumno={{ nombre, rut, cursoActual, asistencia }}
  mode="compact"
  onVerDetalle={(alumno) => navigate(`/alumno/${alumno.rut}`)}
/>

// Full Mode with Actions
<AlumnoCard
  alumno={{
    nombre, rut, edad, genero, asistencia, avance,
    promedioEval, estado, apoderado, telefonoApoderado,
    ultimaObservacion
  }}
  mode="full"
  showActions={true}
  onRegistrarAsistencia={(alumno) => openModal(alumno)}
  onRegistrarAvance={(alumno) => openModal(alumno)}
  onVerEvaluaciones={(alumno) => navigate(`/eval/${alumno.rut}`)}
/>
```

**Key Props:**
- `mode`: 'compact' | 'full'
- `estado`: 'activo' | 'ausente' | 'alerta'
- `genero`: 'M' | 'F' (affects avatar color)

---

## EvaluacionCard

**Use for:** Speech therapy evaluation display

```jsx
import { EvaluacionCard } from '@/components/business';

<EvaluacionCard
  evaluacion={{
    id, nombreAlumno, tipoEvaluacion,
    areas: ['Fonética', 'Fonología'],
    puntaje: 75, puntajeMaximo: 100,
    estado: 'completada',
    observaciones, fecha, evaluador, duracion,
    pdfUrl: '/reports/eval.pdf'
  }}
  showActions={true}
  onVerDetalle={(eval) => navigate(`/eval/${eval.id}`)}
  onCompletar={(eval) => completeEval(eval)}
  onEditar={(eval) => openEditModal(eval)}
/>
```

**Key Props:**
- `estado`: 'completada' | 'en_proceso' | 'pendiente'
- `areas`: Array of evaluated areas
- Progress auto-calculated from puntaje/puntajeMaximo

---

## HijoCard

**Use for:** Parent dashboard - child overview

```jsx
import { HijoCard } from '@/components/business';

<HijoCard
  hijo={{
    rut, nombre, curso, edad,
    asistencia: 92, promedioEval: 'L',
    comunicadosNuevos: 3,
    ultimaActividad: 'Participated in art - 2 hours ago',
    profesor: 'Mrs. Maria Gonzalez'
  }}
  showActions={true}
  onVerDetalle={(hijo) => navigate(`/hijo/${hijo.rut}`)}
  onVerAsistencia={(hijo) => navigate(`/hijo/${hijo.rut}/asistencia`)}
  onVerEvaluaciones={(hijo) => navigate(`/hijo/${hijo.rut}/eval`)}
  onVerMateriales={(hijo) => navigate(`/hijo/${hijo.rut}/materials`)}
/>
```

**Key Props:**
- Three indicators: asistencia, evaluaciones, comunicados
- Blue theme, compact design for parents

---

## ObjetivoCard

**Use for:** Therapeutic objective tracking

```jsx
import { ObjetivoCard } from '@/components/business';

<ObjetivoCard
  objetivo={{
    id, descripcion, area: 'Articulación',
    estado: 'en_proceso', progreso: 65,
    criterios: [
      'Criteria 1: 80% accuracy',
      'Criteria 2: 70% accuracy'
    ],
    fechaInicio: '2025-09-01',
    fechaObjetivo: '2025-12-15',
    totalSesiones: 12, sesionesRealizadas: 8
  }}
  showActions={true}
  onVerDetalle={(obj) => navigate(`/objetivo/${obj.id}`)}
  onMarcarLogrado={(obj) => markAsAchieved(obj)}
  onEditar={(obj) => openEditModal(obj)}
/>
```

**Key Props:**
- `estado`: 'logrado' | 'en_proceso' | 'no_iniciado' | 'pausado'
- Progress bar shows percentage
- "Logrado" button hidden if already achieved

---

## AsistenciaSummary

**Use for:** Attendance statistics overview

```jsx
import { AsistenciaSummary } from '@/components/business';

<AsistenciaSummary
  summary={{
    id: 'asist-2025-10-20',
    fecha: '2025-10-20', curso: 'Medio Mayor',
    totalAlumnos: 25,
    presente: 22, ausente: 2, atrasado: 1,
    porcentaje: 88,
    porcentajePresente: 88,
    porcentajeAusente: 8,
    porcentajeAtrasado: 4
  }}
  onVerDetalle={(summary) => navigate(`/asistencia/${summary.id}`)}
/>
```

**Key Props:**
- Purple gradient background
- Glassmorphism effect
- Detail button only shown if `id` provided

---

## Common Patterns

### Grid Layout
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Component key={item.id} data={item} />)}
</div>
```

### List Layout
```jsx
<div className="space-y-4">
  {items.map(item => <Component key={item.id} data={item} />)}
</div>
```

### Conditional Actions
```jsx
<Component
  showActions={userRole === 'admin'}
  onAction={userRole === 'admin' ? handleAction : undefined}
/>
```

---

## Estado Values Reference

### AlumnoCard
- `activo` → Green badge "Activo"
- `ausente` → Red badge "Ausente Hoy"
- `alerta` → Yellow badge "Alerta"

### EvaluacionCard
- `completada` → Green "Completada"
- `en_proceso` → Yellow "En Proceso"
- `pendiente` → Red "Pendiente"

### ObjetivoCard
- `logrado` → Green "Logrado"
- `en_proceso` → Yellow "En Proceso"
- `no_iniciado` → Red "No Iniciado"
- `pausado` → Blue "Pausado"

---

## Color Scheme Reference

| Component | Primary Color | Gradient |
|-----------|--------------|----------|
| AlumnoCard (M) | Blue #3b82f6 | Blue gradient |
| AlumnoCard (F) | Pink #ec4899 | Pink gradient |
| EvaluacionCard | Purple #8b5cf6 | Purple border |
| HijoCard | Blue #3b82f6 | Blue gradient |
| ObjetivoCard | Orange #f59e0b | Orange border |
| AsistenciaSummary | Purple #667eea | Purple gradient |

---

## Responsive Breakpoints

```jsx
// Tailwind classes used
'grid-cols-1'           // Mobile: 1 column
'md:grid-cols-2'        // Tablet: 2 columns
'lg:grid-cols-3'        // Desktop: 3 columns

// Grid gaps
'gap-3'   // Tight spacing (objectives)
'gap-4'   // Normal spacing (most cards)
'gap-6'   // Loose spacing (sections)
```

---

## Event Handler Signature

All components follow this pattern:

```jsx
onAction={(data) => {
  // data = the component's main data object
  console.log(data);
  navigate(`/detail/${data.id}`);
}}
```

---

## Import Shortcuts

```jsx
// From index
import {
  AlumnoCard,
  EvaluacionCard,
  HijoCard,
  ObjetivoCard,
  AsistenciaSummary
} from '@/components/business';

// Individual (tree-shaking friendly)
import { AlumnoCard } from '@/components/business/AlumnoCard';
```

---

## Common Mistakes

❌ **Don't:**
```jsx
// Missing key prop
{items.map(item => <AlumnoCard alumno={item} />)}

// Inline function (re-creates on every render)
<AlumnoCard onVerDetalle={(x) => console.log(x)} />

// Wrong prop names
<AlumnoCard student={data} viewMode="full" />
```

✅ **Do:**
```jsx
// Correct key prop
{items.map(item => <AlumnoCard key={item.rut} alumno={item} />)}

// Memoized callback
const handleVerDetalle = useCallback((x) => console.log(x), []);
<AlumnoCard onVerDetalle={handleVerDetalle} />

// Correct prop names
<AlumnoCard alumno={data} mode="full" />
```

---

## Performance Tips

1. **Memoize callbacks** for large lists
2. **Use keys properly** in maps
3. **Lazy load** if rendering 100+ cards
4. **Virtualize** for 1000+ items

```jsx
import { useCallback } from 'react';

const handleAction = useCallback((item) => {
  // Handler logic
}, [/* dependencies */]);
```

---

## Accessibility

All components include:
- ✅ Icon + text labels
- ✅ Semantic HTML
- ✅ Proper color contrast
- ✅ Interactive states

Consider adding:
- ARIA labels for screen readers
- Keyboard navigation support
- Focus indicators

---

## File Sizes

| Component | Size (minified) |
|-----------|-----------------|
| AlumnoCard | ~13KB |
| EvaluacionCard | ~9KB |
| HijoCard | ~8KB |
| ObjetivoCard | ~8KB |
| AsistenciaSummary | ~7KB |

**Total:** ~45KB (before gzip)

---

## Dependencies

Required:
- React 18+
- `cn` from `@/lib/utils`
- `formatDate` from `@/utils/helpers`

Optional:
- React Router (for navigation)
- TailwindCSS (for utility classes)

---

## Quick Troubleshooting

**Card not rendering?**
- Check that data prop is not null/undefined
- Verify import path is correct

**Actions not working?**
- Ensure `showActions={true}`
- Check callback is defined
- Verify event propagation isn't blocked

**Styling looks wrong?**
- Ensure CSS/Tailwind is loaded
- Check for className conflicts
- Verify inline styles aren't overridden

**Hover effects not working?**
- Check browser DevTools for CSS issues
- Ensure `transition: all 0.3s` is applied
- Verify z-index isn't causing issues

---

**End of Quick Reference**

For detailed examples, see `USAGE_EXAMPLES.md`
For migration details, see `GROUP_B_MIGRATION.md`
