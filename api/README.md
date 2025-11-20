# Documentación API - Boy Happy

## Índice
- [Introducción](#introducción)
- [Autenticación](#autenticación)
- [Roles del Sistema](#roles-del-sistema)
- [Endpoints](#endpoints)
  - [1. Autenticación](#1-autenticación)
  - [2. Gestión de Usuarios](#2-gestión-de-usuarios)
  - [3. Notas Académicas](#3-notas-académicas)
  - [4. Categorías](#4-categorías)
  - [5. Materiales Pedagógicos](#5-materiales-pedagógicos)
  - [6. Asistencia](#6-asistencia)
  - [7. Bitácora de Clases](#7-bitácora-de-clases)
  - [8. Bitácora Fonoaudiología](#8-bitácora-fonoaudiología)
  - [9. Sesiones Terapéuticas](#9-sesiones-terapéuticas)
  - [10. Informes de Evaluación](#10-informes-de-evaluación)
  - [11. Reportes](#11-reportes)
  - [12. Exportar Reportes](#12-exportar-reportes)
  - [13. Retroalimentación](#13-retroalimentación)
  - [14. Eventos](#14-eventos)
  - [15. Matrículas](#15-matrículas)
  - [16. Anuncios](#16-anuncios)
  - [17. Notificaciones](#17-notificaciones)
  - [18. Imágenes/Galería](#18-imágenes-galería)
  - [19. Reservar Evaluación](#19-reservar-evaluación)
  - [20. Profesionales](#20-profesionales)
  - [21. Configuración](#21-configuración)
  - [22. Backup](#22-backup)

---

## Introducción

Esta API REST proporciona acceso a todas las funcionalidades del sistema Boy Happy, un centro educativo con servicios de fonoaudiología integrados. La API está construida con AWS Lambda, API Gateway, DynamoDB y S3.

**URL Base**: `https://[API_GATEWAY_URL]/`

**Formato de respuesta**: JSON

---

## Autenticación

El sistema utiliza **AWS Cognito** para autenticación y autorización.

### Flujo de Autenticación

1. El usuario accede a `/login` (redirige a Cognito Hosted UI)
2. Cognito autentica y redirige a `/callback` con un código
3. El callback intercambia el código por tokens JWT
4. Los tokens se almacenan en cookies seguras
5. Los endpoints protegidos validan el token en cada request

### Headers Requeridos

Para endpoints protegidos, incluir el token de alguna de estas formas:

```bash
# Opción 1: Cookie (navegador)
Cookie: idToken=eyJhbGc...

# Opción 2: Header Authorization (API)
Authorization: Bearer eyJhbGc...
```

---

## Roles del Sistema

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `admin` | Administrador del sistema | Acceso total a todos los endpoints |
| `profesor` | Docente | Gestión de notas, materiales, asistencia, bitácora |
| `fono` | Fonoaudiólogo/a | Sesiones terapéuticas, informes, bitácora especializada |
| `alumno` | Estudiante | Consulta de notas, materiales, retroalimentación |
| `público` | Sin autenticación | Acceso limitado a endpoints públicos |

---

## Endpoints

---

## 1. Autenticación

### 1.1 Iniciar Sesión

**Archivo**: `login.js`

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/login` | No | Público |

**Descripción**: Redirige al usuario a Cognito Hosted UI para autenticación.

**Parámetros**: Ninguno

**Respuesta**: Redirección 302 a Cognito

---

### 1.2 Callback de Autenticación

**Archivo**: `callback.js`

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/callback` | No | Público |

**Descripción**: Maneja el callback de Cognito después de autenticación exitosa.

**Parámetros Query**:
- `code` (string, requerido): Código de autorización de Cognito

**Respuesta**: Redirección 302 según rol:
- `admin` → `/admin`
- `fono` → `/fono`
- `profesor` → `/profesores`
- `alumno` → `/alumnos`

**Cookies establecidas**:
- `idToken`: Token JWT de identidad
- `accessToken`: Token JWT de acceso

---

## 2. Gestión de Usuarios

**Archivo**: `usuarios.js`

### 2.1 Crear Usuario

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/usuarios` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "rut": "12345678-9",
  "nombre": "Juan Pérez",
  "correo": "juan@example.com",
  "rol": "profesor",
  "telefono": "+56912345678",
  "passwordTemporal": "Pass123!"
}
```

**Validaciones**:
- RUT válido chileno con dígito verificador
- Email en formato válido
- Roles permitidos: `profesor`, `fono`, `alumno` (no `admin`)

**Respuesta**:
```json
{
  "rut": "12345678-9",
  "nombre": "Juan Pérez",
  "correo": "juan@example.com",
  "rol": "profesor",
  "telefono": "+56912345678",
  "activo": true,
  "fechaCreacion": "2025-10-05T10:30:00Z"
}
```

---

### 2.2 Listar Usuarios

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/usuarios` | Sí | `admin` |

**Parámetros**: Ninguno

**Respuesta**:
```json
[
  {
    "rut": "12345678-9",
    "nombre": "Juan Pérez",
    "correo": "juan@example.com",
    "rol": "profesor",
    "activo": true
  }
]
```

---

### 2.3 Actualizar Usuario

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/usuarios?rut=12345678-9` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "nombre": "Juan Carlos Pérez",
  "telefono": "+56987654321",
  "rol": "fono"
}
```

**Respuesta**:
```json
{
  "message": "Usuario actualizado correctamente"
}
```

---

### 2.4 Cambiar Rol de Usuario

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/usuarios/cambiar-rol?rut=12345678-9` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "nuevoRol": "profesor"
}
```

**Respuesta**:
```json
{
  "message": "Rol actualizado correctamente",
  "rolAnterior": "alumno",
  "rolNuevo": "profesor"
}
```

---

### 2.5 Desactivar Usuario

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/usuarios?rut=12345678-9` | Sí | `admin` |

**Descripción**: Desactivación lógica (soft delete), no elimina el usuario.

**Respuesta**:
```json
{
  "message": "Usuario desactivado correctamente"
}
```

---

## 3. Notas Académicas

**Archivo**: `notas.js`

### 3.1 Crear Nota

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/notas` | Sí | `profesor`, `admin` |

**Parámetros Body** (Nota Numérica):
```json
{
  "rutAlumno": "12345678-9",
  "curso": "3° Básico A",
  "asignatura": "Matemáticas",
  "nombreEvaluacion": "Prueba Unidad 1",
  "tipoEvaluacion": "numerica",
  "nota": 6.5,
  "fecha": "2025-10-05",
  "profesor": "98765432-1",
  "observaciones": "Excelente desempeño"
}
```

**Parámetros Body** (Nota Conceptual):
```json
{
  "rutAlumno": "12345678-9",
  "curso": "1° Básico A",
  "asignatura": "Lenguaje",
  "nombreEvaluacion": "Lectura Comprensiva",
  "tipoEvaluacion": "conceptual",
  "evaluacionConceptual": "L",
  "fecha": "2025-10-05",
  "profesor": "98765432-1"
}
```

**Valores Conceptuales**:
- `L`: Logrado
- `NL`: No Logrado
- `OD`: Objetivo en Desarrollo
- `NT`: Objetivo No Trabajado

**Validaciones**:
- Nota numérica: 1.0 - 7.0
- Campos requeridos según tipo de evaluación

**Respuesta**:
```json
{
  "id": "nota-abc123",
  "tipo": "nota",
  "rutAlumno": "12345678-9",
  "curso": "3° Básico A",
  "asignatura": "Matemáticas",
  "nombreEvaluacion": "Prueba Unidad 1",
  "tipoEvaluacion": "numerica",
  "nota": 6.5,
  "fecha": "2025-10-05",
  "profesor": "98765432-1",
  "timestamp": "2025-10-05T10:30:00Z"
}
```

---

### 3.2 Listar Notas

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/notas` | Sí | `profesor`, `admin`, `alumno` |

**Parámetros Query** (opcionales):
- `rutAlumno`: Filtrar por RUT del alumno
- `curso`: Filtrar por curso
- `asignatura`: Filtrar por asignatura
- `profesor`: Filtrar por RUT del profesor
- `tipoEvaluacion`: `numerica` o `conceptual`
- `fechaInicio` y `fechaFin`: Rango de fechas

**Ejemplo**: `/notas?rutAlumno=12345678-9&curso=3° Básico A`

**Respuesta**:
```json
{
  "notas": [
    {
      "id": "nota-abc123",
      "rutAlumno": "12345678-9",
      "nota": 6.5,
      "asignatura": "Matemáticas"
    }
  ],
  "total": 1,
  "promedioGeneral": 6.5
}
```

---

### 3.3 Obtener Notas Agrupadas por Asignatura

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/notas/agrupadas?rutAlumno=12345678-9` | Sí | `profesor`, `admin`, `alumno` |

**Respuesta**:
```json
{
  "asignaturas": [
    {
      "asignatura": "Matemáticas",
      "curso": "3° Básico A",
      "evaluaciones": [
        {
          "id": "nota-abc123",
          "nombreEvaluacion": "Prueba Unidad 1",
          "nota": 6.5,
          "fecha": "2025-10-05"
        }
      ],
      "resumen": {
        "cantidadEvaluaciones": 1,
        "promedio": 6.5
      }
    }
  ]
}
```

---

### 3.4 Calcular Promedios

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/notas/promedios?rutAlumno=12345678-9` | Sí | `profesor`, `admin`, `alumno` |

**Parámetros Query** (opcionales):
- `periodo`: Formato `2025-S1` o `2025-S2`

**Respuesta**:
```json
{
  "rutAlumno": "12345678-9",
  "curso": "3° Básico A",
  "periodo": "2025-S1",
  "promedios": {
    "Matemáticas": {
      "notas": [6.5, 7.0, 6.8],
      "cantidadEvaluaciones": 3,
      "promedio": 6.8
    }
  },
  "promedioGeneral": 6.8
}
```

---

### 3.5 Modificar Nota

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/notas?id=nota-abc123` | Sí | `profesor`, `admin` |

**Parámetros Body**:
```json
{
  "nota": 7.0,
  "observaciones": "Corrección después de revisión"
}
```

**Respuesta**:
```json
{
  "message": "Nota actualizada correctamente",
  "id": "nota-abc123",
  "actualizaciones": ["nota", "observaciones"]
}
```

---

### 3.6 Eliminar Nota

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/notas?id=nota-abc123` | Sí | `profesor`, `admin` |

**Respuesta**:
```json
{
  "message": "Nota eliminada correctamente",
  "id": "nota-abc123"
}
```

---

## 4. Categorías

**Archivo**: `categorias.js`

### 4.1 Crear Categoría

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/categorias` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "nombre": "Guías de Matemáticas",
  "descripcion": "Material didáctico de matemáticas",
  "color": "#FF5733",
  "icono": "fa-calculator",
  "tipoRecurso": "material",
  "activa": true
}
```

**Respuesta**:
```json
{
  "id": "categoria-xyz789",
  "tipo": "categoria",
  "nombre": "Guías de Matemáticas",
  "color": "#FF5733",
  "activa": true,
  "timestamp": "2025-10-05T10:30:00Z"
}
```

---

### 4.2 Listar Categorías

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/categorias` | Sí | `admin`, `profesor`, `fono` |

**Respuesta**:
```json
{
  "categorias": [
    {
      "id": "categoria-xyz789",
      "nombre": "Guías de Matemáticas",
      "activa": true
    }
  ],
  "total": 1
}
```

---

### 4.3 Actualizar Categoría

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/categorias?id=categoria-xyz789` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "nombre": "Guías y Ejercicios de Matemáticas",
  "activa": true
}
```

---

### 4.4 Eliminar Categoría

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/categorias?id=categoria-xyz789` | Sí | `admin` |

**Validación**: No se puede eliminar si tiene materiales asignados.

**Respuesta Error**:
```json
{
  "error": "No se puede eliminar la categoría porque tiene archivos asignados",
  "archivosAsignados": 5,
  "archivos": [
    {"id": "material-1", "titulo": "Guía 1"}
  ]
}
```

---

## 5. Materiales Pedagógicos

**Archivo**: `materiales.js`

### 5.1 Subir Material

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/materiales` | Sí | `profesor`, `admin` |

**Parámetros Body**:
```json
{
  "curso": "3° Básico A",
  "asignatura": "Matemáticas",
  "titulo": "Guía de Fracciones",
  "descripcion": "Ejercicios de fracciones",
  "profesor": "98765432-1",
  "categoria": "guia",
  "unidad": "Unidad 3",
  "archivoBase64": "base64_encoded_file...",
  "nombreArchivo": "guia-fracciones.pdf",
  "tipoArchivo": "application/pdf"
}
```

**Categorías de materiales**:
- `guia`: Guías de ejercicios
- `presentacion`: Presentaciones PowerPoint/PDF
- `video`: Videos educativos
- `lectura`: Material de lectura
- `evaluacion`: Evaluaciones

**Estados**:
- `pendiente`: Esperando revisión
- `aprobado`: Aprobado por dirección
- `rechazado`: Rechazado
- `en_correccion`: Requiere correcciones

**Respuesta**:
```json
{
  "id": "material-abc123",
  "tipo": "material",
  "titulo": "Guía de Fracciones",
  "estado": "pendiente",
  "urlArchivo": "s3://bucket/materiales/material-abc123.pdf",
  "urlDescarga": "https://presigned-url..."
}
```

---

### 5.2 Listar Materiales

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/materiales` | Sí | `profesor`, `admin`, `fono` |

**Parámetros Query** (opcionales):
- `curso`: Filtrar por curso
- `asignatura`: Filtrar por asignatura
- `estado`: `pendiente`, `aprobado`, `rechazado`, `en_correccion`
- `categoria`: Tipo de material
- `profesor`: RUT del profesor
- `unidad`: Unidad temática

**Respuesta**:
```json
{
  "materiales": [
    {
      "id": "material-abc123",
      "titulo": "Guía de Fracciones",
      "estado": "aprobado",
      "urlDescarga": "https://presigned-url..."
    }
  ],
  "total": 1
}
```

---

### 5.3 Modificar Material

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/materiales?id=material-abc123` | Sí | `profesor`, `admin` |

**Restricción**: Solo se pueden editar materiales en estado `pendiente` o `en_correccion`.

**Parámetros Body**:
```json
{
  "titulo": "Guía de Fracciones Actualizada",
  "descripcion": "Versión corregida",
  "archivoBase64": "nuevo_archivo_base64...",
  "nombreArchivo": "guia-fracciones-v2.pdf"
}
```

---

### 5.4 Aprobar Material

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/materiales/aprobar?id=material-abc123` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "revisadoPor": "admin@boyhappy.cl",
  "observaciones": "Material aprobado, excelente calidad"
}
```

**Respuesta**:
```json
{
  "message": "Material aprobado correctamente",
  "id": "material-abc123",
  "estado": "aprobado"
}
```

---

### 5.5 Rechazar Material

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/materiales/rechazar?id=material-abc123` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "revisadoPor": "admin@boyhappy.cl",
  "motivo": "No cumple con los estándares de formato"
}
```

---

### 5.6 Solicitar Corrección

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/materiales/corregir?id=material-abc123` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "revisadoPor": "admin@boyhappy.cl",
  "observaciones": "Por favor corregir errores en página 3"
}
```

---

### 5.7 Eliminar Material

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/materiales?id=material-abc123` | Sí | `profesor`, `admin` |

**Descripción**: Elimina el archivo de S3 y el registro de DynamoDB.

---

## 6. Asistencia

**Archivo**: `asistencia.js`

### 6.1 Registrar Asistencia

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/asistencia` | Sí | `profesor`, `admin` |

**Parámetros Body**:
```json
{
  "curso": "3° Básico A",
  "fecha": "2025-10-05",
  "alumnos": [
    {
      "rut": "12345678-9",
      "nombre": "Juan Pérez",
      "estado": "presente",
      "observacion": ""
    },
    {
      "rut": "98765432-1",
      "nombre": "María López",
      "estado": "ausente",
      "observacion": "Justificado por enfermedad"
    }
  ]
}
```

**Estados válidos**:
- `presente`
- `ausente`
- `atrasado`
- `justificado`

**Respuesta**:
```json
{
  "message": "Asistencia registrada correctamente",
  "registrados": 2
}
```

---

### 6.2 Consultar Asistencia

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/asistencia` | Sí | `profesor`, `admin`, `fono` |

**Parámetros Query**:
- `curso` + `fecha`: Asistencia de un curso en una fecha específica
- `rutAlumno`: Historial de asistencia de un alumno

**Ejemplo**: `/asistencia?curso=3° Básico A&fecha=2025-10-05`

**Respuesta**:
```json
[
  {
    "id": "asist-123",
    "curso": "3° Básico A",
    "fecha": "2025-10-05",
    "rutAlumno": "12345678-9",
    "nombreAlumno": "Juan Pérez",
    "estado": "presente"
  }
]
```

---

### 6.3 Actualizar Asistencia

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/asistencia?id=asist-123` | Sí | `profesor`, `admin` |

**Parámetros Body**:
```json
{
  "estado": "justificado",
  "observacion": "Certificado médico presentado"
}
```

---

### 6.4 Eliminar Registro de Asistencia

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/asistencia?id=asist-123` | Sí | `profesor`, `admin` |

---

## 7. Bitácora de Clases

**Archivo**: `bitacora.js`

### 7.1 Crear Registro de Bitácora

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/bitacora` | Sí | `profesor`, `fono`, `admin` |

**Parámetros Body**:
```json
{
  "rutAlumno": "12345678-9",
  "categoria": "Conducta",
  "descripcion": "Participación activa en clase",
  "autor": "profesor@boyhappy.cl",
  "severidad": "leve",
  "seguimiento": "Continuar reforzando",
  "fecha": "2025-10-05"
}
```

**Categorías válidas**:
- `Conducta`
- `Aprendizaje`
- `Social`
- `Emocional`
- `Comunicación`

**Severidades**:
- `leve`
- `moderada`
- `alta`

**Respuesta**:
```json
{
  "id": "bitacora-abc123",
  "tipo": "bitacora",
  "rutAlumno": "12345678-9",
  "categoria": "Conducta",
  "severidad": "leve",
  "timestamp": "2025-10-05T10:30:00Z"
}
```

---

### 7.2 Listar Registros de Bitácora

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/bitacora` | Sí | `profesor`, `fono`, `admin` |

**Parámetros Query** (opcionales):
- `rutAlumno`: Filtrar por alumno
- `categoria`: Filtrar por categoría
- `autor`: Filtrar por autor
- `severidad`: Filtrar por severidad
- `fechaInicio` y `fechaFin`: Rango de fechas

**Respuesta**:
```json
{
  "registros": [
    {
      "id": "bitacora-abc123",
      "rutAlumno": "12345678-9",
      "categoria": "Conducta",
      "descripcion": "Participación activa",
      "fecha": "2025-10-05"
    }
  ],
  "total": 1
}
```

---

### 7.3 Modificar Registro

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/bitacora?id=bitacora-abc123` | Sí | `profesor`, `fono`, `admin` |

**Parámetros Body**:
```json
{
  "descripcion": "Descripción actualizada",
  "seguimiento": "Nuevo seguimiento",
  "severidad": "moderada"
}
```

---

### 7.4 Eliminar Registro

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/bitacora?id=bitacora-abc123` | Sí | `profesor`, `fono`, `admin` |

---

## 8. Bitácora Fonoaudiología

**Archivo**: `bitacora-fono.js`

**Descripción**: Bitácora especializada para sesiones terapéuticas (diferente a la bitácora de profesores).

### 8.1 Registrar Sesión Terapéutica

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/bitacora-fono` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "rutAlumno": "12345678-9",
  "nombreAlumno": "Juan Pérez",
  "fechaSesion": "2025-10-05",
  "duracion": 45,
  "objetivosTrabajados": "Mejorar articulación de fonema /r/",
  "actividadesRealizadas": "Ejercicios de repetición, juegos fonéticos",
  "resultados": "Avance notorio, 70% de éxito en ejercicios",
  "proximosPasos": "Practicar en casa con lista de palabras"
}
```

**Respuesta**:
```json
{
  "fechaHora": "2025-10-05T00:00:00",
  "id": "bitacora-fono-xyz789",
  "tipo": "bitacora-terapeutica",
  "rutAlumno": "12345678-9",
  "objetivosTrabajados": "Mejorar articulación...",
  "fonoaudiologo": "fono@boyhappy.cl",
  "timestamp": "2025-10-05T10:30:00Z"
}
```

---

### 8.2 Consultar Bitácora Terapéutica

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/bitacora-fono` | Sí | `fono`, `admin` |

**Parámetros Query** (opcionales):
- `rutAlumno`: Filtrar por paciente
- `fonoaudiologo`: Filtrar por profesional
- `fechaInicio` y `fechaFin`: Rango de fechas

**Respuesta**: Array de registros ordenados por fecha descendente.

---

### 8.3 Eliminar Registro

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/bitacora-fono?id=bitacora-fono-xyz789` | Sí | `fono`, `admin` |

---

## 9. Sesiones Terapéuticas

**Archivo**: `sesiones.js`

### 9.1 Registrar Sesión Completa

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/sesiones` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "fechaHora": "2025-10-05T14:00:00",
  "rutAlumno": "12345678-9",
  "fonoaudiologo": "fono@boyhappy.cl",
  "motivo": "Terapia de lenguaje",
  "estado": "completada",
  "actividadesRealizadas": ["Ejercicios bucofaciales", "Lectura"],
  "materialUtilizado": ["Espejo", "Tarjetas"],
  "observaciones": "Buena disposición del paciente",
  "avanceSesion": "Significativo",
  "tareasCasa": ["Practicar 10 min diarios"],
  "proximaSesion": "2025-10-12T14:00:00"
}
```

**Estados**:
- `agendada`
- `completada`
- `cancelada`

**Respuesta**:
```json
{
  "fechaHora": "2025-10-05T14:00:00",
  "id": "sesion-abc123",
  "rutAlumno": "12345678-9",
  "estado": "completada",
  "timestamp": "2025-10-05T10:30:00Z"
}
```

---

### 9.2 Listar Sesiones

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/sesiones` | Sí | `fono`, `admin` |

**Parámetros Query** (opcionales):
- `rutAlumno`: Filtrar por paciente
- `fonoaudiologo`: Filtrar por profesional
- `estado`: Filtrar por estado
- `fechaInicio` y `fechaFin`: Rango de fechas

**Respuesta**:
```json
{
  "sesiones": [...],
  "total": 10,
  "sesionesCompletadas": 7,
  "sesionesAgendadas": 2,
  "sesionesCanceladas": 1
}
```

---

### 9.3 Actualizar Sesión

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/sesiones?id=sesion-abc123` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "observaciones": "Observaciones actualizadas",
  "estado": "completada",
  "tareasCasa": ["Nueva tarea"]
}
```

---

### 9.4 Eliminar Sesión

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/sesiones?id=sesion-abc123` | Sí | `fono`, `admin` |

**Descripción**: Elimina también los archivos adjuntos de S3.

---

### 9.5 Subir Archivo a Sesión

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/sesiones/archivos` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "sesionId": "sesion-abc123",
  "archivoBase64": "base64_encoded_file...",
  "nombre": "ejercicio-1.pdf",
  "tipo": "application/pdf"
}
```

---

### 9.6 Eliminar Archivo de Sesión

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/sesiones/archivos?id=archivo-xyz` | Sí | `fono`, `admin` |

---

### 9.7 Subir Archivo Independiente

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/archivos-sesion` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "rutAlumno": "12345678-9",
  "nombreAlumno": "Juan Pérez",
  "archivoData": "base64_encoded...",
  "nombreArchivo": "evaluacion.pdf",
  "contentType": "application/pdf",
  "tipoArchivo": "documento",
  "fechaSesion": "2025-10-05",
  "descripcion": "Evaluación inicial"
}
```

**Respuesta** (incluye URL firmada):
```json
{
  "fechaHora": "archivo-2025-10-05T...",
  "id": "archivo-sesion-xyz",
  "rutAlumno": "12345678-9",
  "nombreArchivo": "evaluacion.pdf",
  "url": "s3://bucket/sesiones-fono/...",
  "downloadURL": "https://presigned-url..."
}
```

---

### 9.8 Listar Archivos de Sesión

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/archivos-sesion` | Sí | `fono`, `admin` |

**Parámetros Query** (opcionales):
- `id`: Obtener archivo específico
- `rutAlumno`: Filtrar por paciente
- `tipo`: Filtrar por tipo de archivo

---

### 9.9 Modificar Archivo de Sesión

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/archivos-sesion?id=archivo-xyz` | Sí | `fono`, `admin` |

---

### 9.10 Eliminar Archivo de Sesión

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/archivos-sesion?id=archivo-xyz` | Sí | `fono`, `admin` |

---

## 10. Informes de Evaluación

**Archivo**: `informes.js`

### 10.1 Crear Informe

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/informes` | Sí | `fono`, `admin` |
| `POST` | `/informes-fono` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "rutAlumno": "12345678-9",
  "nombreAlumno": "Juan Pérez",
  "fechaEvaluacion": "2025-10-05",
  "tipoEvaluacion": "Evaluación Fonoaudiológica Inicial",
  "motivoConsulta": "Dificultades articulatorias",
  "antecedentes": "Sin antecedentes relevantes",
  "resultadosEvaluacion": "Dislalia múltiple",
  "diagnostico": "Trastorno fonológico",
  "recomendaciones": "Terapia 2 veces por semana"
}
```

**Respuesta**:
```json
{
  "id": "informe-abc123",
  "timestamp": "2025-10-05T10:30:00Z",
  "rutAlumno": "12345678-9",
  "tipoEvaluacion": "Evaluación Fonoaudiológica Inicial",
  "fonoaudiologo": "fono@boyhappy.cl"
}
```

---

### 10.2 Listar Informes

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/informes` | Sí | `fono`, `admin` |

**Parámetros Query** (opcionales):
- `id`: Obtener informe específico
- `rutAlumno`: Filtrar por paciente
- `tipo`: Filtrar por tipo de evaluación

---

### 10.3 Modificar Informe

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/informes?id=informe-abc123` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "resultadosEvaluacion": "Resultados actualizados",
  "diagnostico": "Diagnóstico corregido",
  "recomendaciones": "Nuevas recomendaciones"
}
```

---

### 10.4 Eliminar Informe

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/informes?id=informe-abc123` | Sí | `fono`, `admin` |

---

## 11. Reportes

**Archivo**: `reportes.js`

### 11.1 Reporte de Asistencia

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/reportes/asistencia` | Sí | `admin`, `profesor` |

**Parámetros Query**:
- `curso` (requerido): Curso a consultar
- `fechaInicio` (opcional): Fecha inicio
- `fechaFin` (opcional): Fecha fin

**Ejemplo**: `/reportes/asistencia?curso=3° Básico A&fechaInicio=2025-09-01&fechaFin=2025-09-30`

**Respuesta**:
```json
{
  "tipo": "asistencia",
  "curso": "3° Básico A",
  "periodo": {
    "inicio": "2025-09-01",
    "fin": "2025-09-30"
  },
  "resumen": {
    "totalClases": 20,
    "totalAlumnos": 25,
    "porcentajeAsistenciaPromedio": 94.5
  },
  "alumnos": [
    {
      "rut": "12345678-9",
      "nombre": "Juan Pérez",
      "presente": 18,
      "ausente": 2,
      "justificado": 0,
      "atrasado": 1,
      "total": 20,
      "porcentajeAsistencia": "90.0",
      "estado": "cumple"
    }
  ],
  "alertas": [
    {
      "rut": "98765432-1",
      "nombre": "María López",
      "porcentajeAsistencia": "75.0"
    }
  ],
  "fechaGeneracion": "2025-10-05T10:30:00Z"
}
```

---

### 11.2 Reporte de Cumplimiento Docente

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/reportes/cumplimiento` | Sí | `admin` |

**Parámetros**: Ninguno

**Respuesta**:
```json
{
  "tipo": "cumplimiento",
  "profesores": [
    {
      "rut": "11111111-1",
      "nombre": "Pedro González",
      "cursosAsignados": ["3° Básico A", "4° Básico B"],
      "asignaturas": ["Matemáticas", "Ciencias"],
      "cumplimiento": {
        "materialesSubidos": 25,
        "materialesAprobados": 23,
        "materialesRechazados": 2,
        "notasIngresadas": 150,
        "asistenciaRegistrada": 60,
        "promedioCalidad": "Excelente"
      }
    }
  ],
  "resumen": {
    "totalProfesores": 10,
    "cumplimientoPromedio": 94.2,
    "profesoresDestacados": 3
  },
  "fechaGeneracion": "2025-10-05T10:30:00Z"
}
```

---

### 11.3 Reporte de Actividades por Usuario

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/reportes/actividades` | Sí | `admin`, `profesor`, `fono` |

**Parámetros Query**:
- `usuario` (requerido): RUT del usuario
- `fechaInicio` (opcional)
- `fechaFin` (opcional)

**Respuesta**:
```json
{
  "tipo": "actividades",
  "usuario": "11111111-1",
  "periodo": {
    "inicio": "2025-09-01",
    "fin": "2025-09-30"
  },
  "actividades": {
    "notasIngresadas": 45,
    "materialesSubidos": 8,
    "bitacoraCreada": 12
  },
  "fechaGeneracion": "2025-10-05T10:30:00Z"
}
```

---

### 11.4 Reporte de Notas

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/reportes/notas` | Sí | `admin`, `profesor` |

**Parámetros Query** (opcionales):
- `curso`: Filtrar por curso
- `asignatura`: Filtrar por asignatura

**Respuesta**:
```json
{
  "tipo": "notas",
  "curso": "3° Básico A",
  "asignatura": "Matemáticas",
  "estadisticas": {
    "promedioGeneral": 6.2,
    "notaMasAlta": 7.0,
    "notaMasBaja": 4.5,
    "totalEvaluaciones": 120
  },
  "fechaGeneracion": "2025-10-05T10:30:00Z"
}
```

---

### 11.5 Generar Reporte Consolidado

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/reportes/consolidado` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "nombre": "Reporte Trimestre 1",
  "secciones": ["asistencia", "notas", "cumplimiento"],
  "periodo": {
    "inicio": "2025-03-01",
    "fin": "2025-06-30"
  }
}
```

**Respuesta**:
```json
{
  "message": "Reporte generado",
  "id": "reporte-xyz789",
  "reporte": {
    "id": "reporte-xyz789",
    "nombre": "Reporte Trimestre 1",
    "tipo": "consolidado",
    "estado": "completado",
    "fechaGeneracion": "2025-10-05T10:30:00Z"
  }
}
```

---

### 11.6 Indicadores de Desempeño

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/reportes/indicadores` | Sí | `admin` |

**Respuesta**:
```json
{
  "tipo": "indicadores",
  "indicadores": {
    "academicos": {
      "promedioGeneralInstitucion": 6.3,
      "tasaAprobacion": 94.2
    },
    "operacionales": {
      "profesoresActivos": 15,
      "materialesPublicados": 250
    }
  },
  "fechaGeneracion": "2025-10-05T10:30:00Z"
}
```

---

## 12. Exportar Reportes

**Archivo**: `exportar-reportes.js`

**Descripción**: Exporta reportes en formatos CSV, XLSX y PDF (texto plano).

### 12.1 Exportar Asistencia

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/exportar/asistencia` | Sí | `admin`, `profesor` |

**Parámetros Query**:
- `curso` (requerido): Curso a exportar
- `fechaInicio` (opcional)
- `fechaFin` (opcional)
- `formato`: `csv`, `xlsx`, `pdf` (default: `csv`)

**Ejemplo**: `/exportar/asistencia?curso=3° Básico A&formato=xlsx`

**Respuesta**:
```json
{
  "filename": "reporte-asistencia-3-Basico-A.xls",
  "content": "base64_encoded_file...",
  "mimeType": "application/vnd.ms-excel"
}
```

**Uso en frontend**:
```javascript
const response = await fetch('/exportar/asistencia?curso=3° Básico A&formato=csv');
const data = await response.json();
const link = document.createElement('a');
link.href = `data:${data.mimeType};base64,${data.content}`;
link.download = data.filename;
link.click();
```

---

### 12.2 Exportar Notas

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/exportar/notas` | Sí | `admin`, `profesor` |

**Parámetros Query**:
- `curso` (opcional)
- `asignatura` (opcional)
- `formato`: `csv`, `xlsx` (default: `csv`)

---

### 12.3 Exportar Cumplimiento Docente

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/exportar/cumplimiento` | Sí | `admin` |

**Parámetros Query**:
- `formato`: `csv` (default: `csv`)

---

## 13. Retroalimentación

**Archivo**: `retroalimentacion.js`

### 13.1 Enviar Retroalimentación

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/retroalimentacion` | Sí | `admin`, `profesor`, `fono` |

**Parámetros Body**:
```json
{
  "rutUsuario": "12345678-9",
  "nombreUsuario": "Juan Pérez",
  "tipo": "academica",
  "contenido": "Excelente desempeño en matemáticas",
  "visibilidad": "privada",
  "ambito": "individual",
  "curso": "3° Básico A",
  "creadoPor": "profesor@boyhappy.cl"
}
```

**Tipos de retroalimentación**:
- `academica`
- `conductual`
- `social`
- `fonoaudiologica`

**Visibilidad**:
- `privada`: Solo visible para el destinatario
- `publica`: Visible para todos

**Respuesta**:
```json
{
  "rutUsuario": "12345678-9",
  "timestamp": "2025-10-05T10:30:00Z",
  "id": "retro-abc123",
  "tipo": "academica",
  "leida": false
}
```

---

### 13.2 Consultar Retroalimentaciones

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/retroalimentacion` | Sí | `admin`, `profesor`, `fono`, `alumno` |

**Parámetros Query** (opcionales):
- `rutUsuario`: Filtrar por destinatario (requerido para no-admin)
- `tipo`: Filtrar por tipo

**Respuesta**: Array de retroalimentaciones ordenadas por fecha.

---

### 13.3 Marcar como Leída

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/retroalimentacion?id=retro-abc123` | Sí | `admin`, `profesor`, `fono` |

**Parámetros Body**:
```json
{
  "leida": true,
  "respuesta": "Gracias por el feedback"
}
```

**Nota**: Requiere `rutUsuario` y `timestamp` en query params.

---

## 14. Eventos

**Archivo**: `eventos.js`

### 14.1 Crear Evento

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/eventos` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "titulo": "Reunión de Apoderados",
  "descripcion": "Reunión trimestral informativa",
  "fecha": "2025-10-15",
  "hora": "18:00",
  "tipo": "reunion",
  "curso": "3° Básico A"
}
```

**Tipos de eventos**:
- `reunion`
- `actividad`
- `celebracion`
- `academico`

**Respuesta**:
```json
{
  "id": "evento-abc123",
  "titulo": "Reunión de Apoderados",
  "fecha": "2025-10-15",
  "hora": "18:00"
}
```

---

### 14.2 Listar Eventos

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/eventos` | No | Público |

**Parámetros**: Ninguno

**Respuesta**: Array de todos los eventos.

---

### 14.3 Actualizar Evento

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/eventos?id=evento-abc123` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "titulo": "Reunión de Apoderados - ACTUALIZADA",
  "fecha": "2025-10-16",
  "hora": "19:00"
}
```

---

### 14.4 Eliminar Evento

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/eventos?id=evento-abc123` | Sí | `admin` |

---

## 15. Matrículas

**Archivo**: `matriculas.js`

### 15.1 Crear Solicitud de Matrícula

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/matriculas` | No | Público |

**Parámetros Body**:
```json
{
  "nombre": "Juan Pérez López",
  "rut": "12345678-9",
  "fechaNacimiento": "2015-05-10",
  "ultimoCurso": "2° Básico",
  "correo": "apoderado@example.com",
  "telefono": "+56912345678"
}
```

**Respuesta**:
```json
{
  "id": "matricula-abc123",
  "tipo": "matricula",
  "nombre": "Juan Pérez López",
  "estado": "pendiente",
  "fechaRegistro": "2025-10-05"
}
```

---

### 15.2 Listar Solicitudes

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/matriculas` | Sí | `admin` |

**Parámetros Query** (opcionales):
- `estado`: `pendiente`, `aprobada`, `rechazada`

**Respuesta**:
```json
{
  "matriculas": [...],
  "total": 10,
  "pendientes": 5,
  "aprobadas": 4,
  "rechazadas": 1
}
```

---

### 15.3 Actualizar Estado de Matrícula

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/matriculas?id=matricula-abc123` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "estado": "aprobada",
  "revisadoPor": "admin@boyhappy.cl",
  "motivo": ""
}
```

**Estados**:
- `aprobada`: Envía email de confirmación
- `rechazada`: Envía email con motivo de rechazo

**Respuesta**:
```json
{
  "message": "Matrícula aprobada. Email enviado.",
  "id": "matricula-abc123",
  "emailEnviado": true
}
```

---

### 15.4 Convertir Matrícula en Usuario

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/matriculas/convertir-usuario?id=matricula-abc123` | Sí | `admin` |

**Descripción**: Crea un usuario tipo `alumno` en Cognito y DynamoDB a partir de una matrícula aprobada.

**Parámetros Body**:
```json
{
  "curso": "3° Básico A"
}
```

**Validaciones**:
- La matrícula debe estar en estado `aprobada`
- El RUT no debe existir como usuario activo

**Respuesta**:
```json
{
  "message": "Usuario creado exitosamente",
  "usuario": {
    "rut": "12345678-9",
    "nombre": "Juan Pérez",
    "correo": "apoderado@example.com",
    "rol": "alumno",
    "curso": "3° Básico A",
    "activo": true
  },
  "passwordTemporal": "Boy1234!"
}
```

**Acciones automáticas**:
1. Crea usuario en Cognito
2. Asigna al grupo `alumno`
3. Crea registro en tabla Usuarios
4. Marca matrícula como `usuarioCreado = true`
5. Envía email con credenciales temporales

---

### 15.5 Eliminar Solicitud

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/matriculas?id=matricula-abc123` | Sí | `admin` |

---

## 16. Anuncios

**Archivo**: `anuncios.js`

### 16.1 Crear Anuncio

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/anuncios` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "titulo": "Inicio de Clases",
  "contenido": "Las clases inician el 3 de marzo",
  "autor": "Dirección",
  "destinatarios": "todos"
}
```

**Destinatarios**:
- `todos`: Visible para todos
- `profesores`: Solo profesores
- `alumnos`: Solo alumnos

**Respuesta**:
```json
{
  "id": "anuncio-abc123",
  "titulo": "Inicio de Clases",
  "fecha": "2025-10-05T10:30:00Z",
  "destinatarios": "todos"
}
```

---

### 16.2 Listar Anuncios

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/anuncios` | No | Público |

**Respuesta**: Array de anuncios ordenados por fecha descendente.

---

### 16.3 Editar Anuncio

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/anuncios?id=anuncio-abc123` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "titulo": "Inicio de Clases - Actualizado",
  "contenido": "Nuevo contenido"
}
```

---

### 16.4 Eliminar Anuncio

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/anuncios?id=anuncio-abc123` | Sí | `admin` |

---

## 17. Notificaciones

**Archivo**: `notificaciones.js`

**Descripción**: Envío masivo de emails a usuarios según rol.

### 17.1 Enviar Notificación

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/notificaciones` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "destinatarios": "profesor",
  "asunto": "Reunión de Coordinación",
  "mensaje": "Se convoca a reunión este viernes a las 16:00 hrs"
}
```

**Destinatarios**:
- `todos`: Todos los usuarios activos
- `profesor`: Solo profesores
- `fono`: Solo fonoaudiólogos
- `alumno`: Solo alumnos

**Respuesta**:
```json
{
  "enviados": 15,
  "errores": 0,
  "detalles": {
    "exitosos": ["email1@example.com", "email2@example.com"],
    "fallidos": []
  }
}
```

**Características**:
- Email HTML formateado
- Procesamiento en lotes
- Reporte de envíos exitosos y fallidos

---

## 18. Imágenes/Galería

**Archivo**: `images.js`

### 18.1 Subir Imagen

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/images` | Sí | `admin`, `profesor` |

**Parámetros Body**:
```json
{
  "imageName": "foto-actividad.jpg",
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "grupo": "public",
  "album": "Actividades Septiembre"
}
```

**Grupos**:
- `public`: Imágenes públicas de la galería
- `private`: Imágenes privadas (requiere álbum)

**Respuesta**:
```json
{
  "message": "Imagen subida exitosamente al grupo 'public'",
  "key": "public/Actividades Septiembre/1728123456789_foto-actividad.jpg"
}
```

---

### 18.2 Listar Álbumes

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/images?action=albums` | No | Público |

**Respuesta**:
```json
{
  "albums": [
    "Actividades Septiembre",
    "Día del Profesor",
    "Aniversario"
  ]
}
```

---

### 18.3 Listar Imágenes

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/images` | No | Público |
| `GET` | `/images?album=Actividades Septiembre` | No | Público |

**Parámetros Query** (opcionales):
- `album`: Filtrar por álbum específico

**Respuesta**:
```json
[
  {
    "key": "public/Actividades Septiembre/foto-1.jpg",
    "url": "https://bucket.s3.amazonaws.com/public/Actividades%20Septiembre/foto-1.jpg",
    "album": "Actividades Septiembre",
    "size": 125000,
    "lastModified": "2025-10-05T10:30:00Z"
  }
]
```

---

## 19. Reservar Evaluación

**Archivo**: `reservar-evaluacion.js`

**Descripción**: Sistema de agenda para evaluaciones fonoaudiológicas.

### 19.1 Listar Horarios Agendados

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/reservar-evaluacion` | No | Público |

**Respuesta**: Array de todos los horarios reservados y bloqueados.

---

### 19.2 Reservar Horario

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/reservar-evaluacion` | No | Público |

**Parámetros Body**:
```json
{
  "fechaHora": "2025-10-15T14:00:00",
  "nombreAlumno": "Juan Pérez",
  "rutAlumno": "12345678-9",
  "fechaNacimiento": "2015-05-10",
  "telefono": "+56912345678",
  "correo": "apoderado@example.com",
  "nombreApoderado": "María López",
  "rutApoderado": "98765432-1"
}
```

**Validación**: Verifica que el horario no esté tomado.

**Respuesta**:
```json
{
  "statusCode": 200,
  "body": "Reserva para Juan Pérez creada correctamente"
}
```

---

### 19.3 Bloquear Horario

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/reservar-evaluacion` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "fechaHora": "2025-10-15T15:00:00",
  "nombreAlumno": "Ocupado"
}
```

**Descripción**: Bloquea un horario para que no pueda ser reservado.

---

### 19.4 Aceptar Paciente

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/reservar-evaluacion` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "tipo": "aceptar",
  "fechaHora": "2025-10-15T14:00:00"
}
```

**Descripción**: Marca una reserva como aceptada.

---

### 19.5 Eliminar Reserva/Bloqueo

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `DELETE` | `/reservar-evaluacion` | Sí | `fono`, `admin` |

**Parámetros Body**:
```json
{
  "fechaHora": "2025-10-15T14:00:00"
}
```

---

## 20. Profesionales

**Archivo**: `profesionales.js`

**Descripción**: Endpoint público para mostrar profesionales en la página home.

### 20.1 Listar Profesionales

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/profesionales` | No | Público |

**Descripción**: Retorna información pública de profesionales activos (admin, profesor, fono).

**Respuesta**:
```json
[
  {
    "nombre": "María González",
    "rol": "profesor",
    "especialidad": "Matemáticas y Ciencias",
    "descripcion": "15 años de experiencia",
    "badges": ["Magíster en Educación"]
  },
  {
    "nombre": "Carlos Pérez",
    "rol": "fono",
    "especialidad": "Fonoaudiología Infantil",
    "descripcion": "Especialista en trastornos del lenguaje",
    "badges": null
  }
]
```

**Cache**: 24 horas

---

## 21. Configuración

**Archivo**: `configuracion.js`

### 21.1 Obtener Configuración

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/configuracion` | Sí | `admin` |
| `GET` | `/configuracion?key=parametro1` | Sí | `admin` |

**Parámetros Query** (opcionales):
- `key`: Obtener parámetro específico

**Respuesta** (todos):
```json
{
  "parametros": [
    {
      "id": "año_escolar",
      "valor": "2025",
      "timestamp": "2025-01-01T00:00:00Z"
    },
    {
      "id": "semestre_actual",
      "valor": "2",
      "timestamp": "2025-08-01T00:00:00Z"
    }
  ],
  "total": 2
}
```

**Respuesta** (específico):
```json
{
  "id": "año_escolar",
  "valor": "2025",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

---

### 21.2 Actualizar Configuración

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `PUT` | `/configuracion` | Sí | `admin` |

**Parámetros Body**:
```json
{
  "parametros": [
    {
      "id": "año_escolar",
      "valor": "2026"
    },
    {
      "id": "semestre_actual",
      "valor": "1"
    }
  ]
}
```

**Respuesta**:
```json
{
  "message": "Parámetros actualizados"
}
```

---

## 22. Backup

**Archivo**: `backup.js`

**Descripción**: Sistema automático de respaldos de DynamoDB. Se ejecuta diariamente vía EventBridge.

### 22.1 Consultar Último Backup

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `GET` | `/backup` | Sí | `admin` |

**Respuesta**:
```json
{
  "ultimoBackup": {
    "fecha": "2025-10-05T02:00:00Z",
    "backupId": "backup-2025-10-05-abc12345",
    "tablas": [
      {
        "tabla": "Usuarios",
        "items": 150
      },
      {
        "tabla": "RecursosAcademicos",
        "items": 2500
      }
    ],
    "estado": "completado"
  }
}
```

---

### 22.2 Ejecutar Backup Manual

| Método | Ruta | Autenticación | Roles |
|--------|------|---------------|-------|
| `POST` | `/backup` | Sí | `admin` |

**Descripción**: Ejecuta un backup manual de todas las tablas.

**Respuesta**:
```json
{
  "message": "Backup completado exitosamente",
  "backupId": "backup-2025-10-05-xyz78901",
  "timestamp": "2025-10-05T10:30:00Z",
  "tablas": [
    {
      "tabla": "Usuarios",
      "items": 150,
      "key": "dynamodb/backup-2025-10-05-xyz78901/Usuarios.json"
    }
  ]
}
```

**Características**:
- Backup completo de todas las tablas DynamoDB
- Almacenamiento en S3
- Retención de 30 backups
- Limpieza automática de backups antiguos
- Manifiestos JSON con metadata

---

## Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| `200` | Operación exitosa |
| `201` | Recurso creado |
| `207` | Multi-Status (operación parcialmente exitosa) |
| `302` | Redirección |
| `400` | Bad Request - Parámetros inválidos |
| `401` | No autenticado - Token faltante o inválido |
| `403` | Acceso denegado - Sin permisos para la operación |
| `404` | Recurso no encontrado |
| `405` | Método HTTP no permitido |
| `409` | Conflicto - Recurso duplicado |
| `500` | Error interno del servidor |

---

## Ejemplos de Uso

### Ejemplo 1: Autenticación y Obtención de Notas

```javascript
// 1. Iniciar sesión (redirige a Cognito)
window.location.href = 'https://api.boyhappy.cl/login';

// 2. Después del callback, el token está en cookies
// 3. Consultar notas del alumno autenticado
const response = await fetch('https://api.boyhappy.cl/notas?rutAlumno=12345678-9', {
  credentials: 'include' // Incluir cookies
});

const data = await response.json();
console.log(data.notas);
```

---

### Ejemplo 2: Crear Usuario (Admin)

```javascript
const crearUsuario = async () => {
  const response = await fetch('https://api.boyhappy.cl/usuarios', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rut: '12345678-9',
      nombre: 'Juan Pérez',
      correo: 'juan@example.com',
      rol: 'profesor',
      passwordTemporal: 'TempPass123!'
    })
  });

  if (response.ok) {
    const usuario = await response.json();
    console.log('Usuario creado:', usuario);
  } else {
    const error = await response.json();
    console.error('Error:', error);
  }
};
```

---

### Ejemplo 3: Subir Material Pedagógico

```javascript
const subirMaterial = async (file) => {
  // Convertir archivo a base64
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];

    const response = await fetch('https://api.boyhappy.cl/materiales', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        curso: '3° Básico A',
        asignatura: 'Matemáticas',
        titulo: 'Guía de Fracciones',
        profesor: '11111111-1',
        archivoBase64: base64,
        nombreArchivo: file.name,
        tipoArchivo: file.type
      })
    });

    const data = await response.json();
    console.log('Material subido:', data);
  };
};
```

---

### Ejemplo 4: Exportar Reporte de Asistencia

```javascript
const exportarAsistencia = async () => {
  const response = await fetch(
    'https://api.boyhappy.cl/exportar/asistencia?curso=3° Básico A&formato=xlsx',
    { credentials: 'include' }
  );

  const data = await response.json();

  // Descargar archivo
  const link = document.createElement('a');
  link.href = `data:${data.mimeType};base64,${data.content}`;
  link.download = data.filename;
  link.click();
};
```

---

## Notas de Seguridad

1. **Tokens JWT**: Los tokens tienen expiración configurada en Cognito (default: 1 hora)
2. **CORS**: Configurado con `Access-Control-Allow-Origin: *` para desarrollo
3. **Validación de entrada**: Todos los endpoints validan parámetros requeridos
4. **Soft delete**: Los usuarios se desactivan en lugar de eliminarse
5. **Archivos S3**: URLs firmadas con expiración de 1 hora
6. **Passwords**: Cognito maneja el hashing y seguridad de contraseñas
7. **Rate limiting**: Implementado a nivel de API Gateway

---

## Contacto y Soporte

Para reportar errores o solicitar nuevas funcionalidades, contactar al equipo de desarrollo.

**Última actualización**: 2025-10-05
