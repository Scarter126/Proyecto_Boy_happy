# Frontend Lambdas

Estas funciones Lambda **sirven HTML** a los usuarios finales.

## Archivos

- `home.js` - Página principal pública (index.html)
- `admin.js` - Portal de administración
- `profesores.js` - Portal para profesores
- `alumnos.js` - Portal para alumnos/apoderados
- `fono.js` - Panel para fonoaudiólogas
- `toma_hora.js` - Formulario de solicitud de evaluación fonoaudiológica
- `galeria.js` - Galería de imágenes pública

## Características

- Todos usan templates HTML de `/templates/pages/`
- Aplican estilos Boy Happy de `/templates/shared/boyhappy-styles.css`
- Renderización server-side (SSR)
- Insertan CSS y JavaScript inline para optimizar carga
