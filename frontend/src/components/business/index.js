/**
 * Business Components Index
 *
 * Exporta todos los componentes de negocio (business logic components)
 * que muestran entidades específicas del dominio de Boy Happy.
 *
 * Estos componentes son "card" o "row" components que:
 * - Reciben datos de entidades como props
 * - Manejan su propia UI y estado visual
 * - Emiten eventos a través de callbacks para acciones
 * - Son reutilizables en diferentes vistas
 */

// Group A - Simple Components (Cards y Rows)
export { default as AnuncioCard } from './AnuncioCard';
export { default as CursoCard } from './CursoCard';
export { default as AsistenciaRow } from './AsistenciaRow';
export { default as MaterialCard } from './MaterialCard';
export { default as EventoCard } from './EventoCard';

// Group B - Medium Complexity Components
export { AlumnoCard } from './AlumnoCard';
export { EvaluacionCard } from './EvaluacionCard';
export { HijoCard } from './HijoCard';
export { ObjetivoCard } from './ObjetivoCard';
export { AsistenciaSummary } from './AsistenciaSummary';

// Group C - Complex Components (Nested Data & Advanced State)
export { SesionCard } from './SesionCard';
export { MaterialTerapeuticoCard } from './MaterialTerapeuticoCard';
export { AvanceRegistroCard } from './AvanceRegistroCard';

// Group D - Configuration & Management Components
export { default as ConfigListManager } from './ConfigListManager';
export { default as CategoriasManager } from './CategoriasManager';
