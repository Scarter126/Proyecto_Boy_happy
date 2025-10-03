# Backend API Lambdas

Estas funciones Lambda son **endpoints de API** que devuelven JSON o manejan lógica de backend.

## Archivos

### DynamoDB
- `anuncios.js` - CRUD de anuncios
- `usuarios.js` - CRUD de usuarios + integración con Cognito
- `eventos.js` - CRUD de eventos/evaluaciones del calendario
- `reservar-evaluacion.js` - Gestión de reservas de evaluación fonoaudiológica

### S3
- `images.js` - Subida y gestión de imágenes al bucket S3

### SES (Email)
- `notificaciones.js` - Envío masivo de notificaciones por email

### Cognito (Autenticación)
- `login.js` - Inicio de sesión con Cognito Hosted UI
- `callback.js` - Callback OAuth después del login
- `crear_usuario.js` - Creación de usuarios en Cognito User Pool

## Características

- Retornan JSON (Content-Type: application/json)
- Sin interfaz gráfica
- Integración con servicios AWS (DynamoDB, S3, SES, Cognito)
- Validación y manejo de errores
