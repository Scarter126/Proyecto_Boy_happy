# 🏫 BoyHappy - Sistema de Gestión Escolar

Sistema integral de gestión escolar serverless desarrollado con AWS CDK, Lambda, DynamoDB y Cognito.

[![AWS](https://img.shields.io/badge/AWS-Lambda%20%7C%20DynamoDB%20%7C%20Cognito-orange)](https://aws.amazon.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green)](https://nodejs.org/)
[![CDK](https://img.shields.io/badge/AWS%20CDK-2.173.2-blue)](https://aws.amazon.com/cdk/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue)](https://www.typescriptlang.org/)

---

## 📑 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Arquitectura](#-arquitectura)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Deploy a AWS](#-deploy-a-aws)
- [Uso del Sistema](#-uso-del-sistema)
- [Scripts Disponibles](#-scripts-disponibles)
- [Desarrollo Local](#-desarrollo-local)
- [Documentación Adicional](#-documentación-adicional)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Características Principales

- ✅ **Gestión de Usuarios** - Alumnos, profesores, fonoaudiólogos, apoderados
- ✅ **Notas Académicas** - Numéricas (1.0-7.0) y conceptuales (L/NL/OD/NT)
- ✅ **Asistencia** - Registro con alertas automáticas (<85%)
- ✅ **Materiales Pedagógicos** - Workflow de aprobación (Pendiente → Aprobado/Rechazado)
- ✅ **Fonoaudiología** - Sesiones terapéuticas, informes, bitácora
- ✅ **Comunicaciones** - Anuncios, eventos, matrículas
- ✅ **Reportes Consolidados** - Con exportación CSV/XLSX/PDF
- ✅ **Backups Automáticos** - Diarios a las 2 AM, retención 30 días
- ✅ **Retroalimentación** - Sistema de observaciones y feedback
- ✅ **Autenticación Segura** - OAuth2 con AWS Cognito

---

## 🏗️ Arquitectura

### Servicios de AWS

```
┌─────────────────┐
│   CloudFront    │ (Opcional para CDN)
└────────┬────────┘
         │
┌────────▼────────┐
│  API Gateway    │ ← REST API
└────────┬────────┘
         │
    ┌────┴─────────────────────┐
    │                          │
┌───▼────┐            ┌────────▼─────┐
│ Lambda │ Backend    │    Lambda    │ Frontend
│  (API) │ (Node.js)  │ (Page Router)│
└───┬────┘            └──────────────┘
    │
┌───▼──────────┬──────────┬────────────┐
│  DynamoDB    │    S3    │  Cognito   │
│  (9 Tablas)  │ (Assets) │  (Auth)    │
└──────────────┴──────────┴────────────┘
         │                      │
┌────────▼────────┐    ┌───────▼────────┐
│  EventBridge    │    │      SES       │
│ (Backups 2 AM)  │    │ (Notificaciones)│
└─────────────────┘    └────────────────┘
```

### Tablas DynamoDB

| Tabla | Descripción | Partition Key | Sort Key |
|-------|-------------|---------------|----------|
| **Usuarios** | Información de usuarios | `rut` (STRING) | - |
| **Comunicaciones** | Anuncios + Eventos + Matrículas | `id` (STRING) | `tipo` (STRING) |
| **RecursosAcademicos** | Notas + Materiales + Bitácora + Categorías | `id` (STRING) | `tipo` (STRING) |
| **Asistencia** | Registros de asistencia | `id` (STRING) | - |
| **Retroalimentacion** | Observaciones y feedback | `id` (STRING) | - |
| **AgendaFonoaudiologia** | Agenda + Bitácora terapéutica | `fechaHora` (STRING) | - |
| **Configuracion** | Parámetros del sistema | `id` (STRING) | - |
| **Informes** | Informes fonoaudiológicos | `id` (STRING) | `tipo` (STRING) |
| **Reportes** | Reportes consolidados | `id` (STRING) | - |

---

## 📁 Estructura del Proyecto

```
Proyecto_Boy_happy/
│
├── 📂 bin/                      # Entry point de CDK
│   └── boy_happy.ts             # Definición del app CDK
│
├── 📂 lib/                      # Infraestructura AWS CDK
│   └── boy_happy-stack.ts       # Stack principal con lambdas, tablas, API Gateway
│
├── 📂 src/                      # Código fuente
│   ├── 📂 api/                  # Lambdas de Backend (25 endpoints)
│   │   ├── anuncios.js          # CU-57,58,59 - CRUD anuncios
│   │   ├── asistencia.js        # CU-32,33,34 - Asistencia
│   │   ├── backup.js            # CU-12 - Backups automáticos ⚡
│   │   ├── bitacora.js          # CU-36 - Bitácora profesores
│   │   ├── bitacora-fono.js     # CU-45 - Bitácora fonoaudióloga
│   │   ├── callback.js          # CU-02 - OAuth callback
│   │   ├── categorias.js        # CU-08,09,10 - Categorías
│   │   ├── configuracion.js     # CU-11 - Configuración global
│   │   ├── eventos.js           # CU-54,55,56 - CRUD eventos
│   │   ├── exportar-reportes.js # CU-25 - Exportar CSV/XLSX/PDF ⚡
│   │   ├── images.js            # Gestión de imágenes S3
│   │   ├── informes.js          # CU-46,47,48 - Informes fono
│   │   ├── login.js             # CU-01 - Login OAuth
│   │   ├── materiales.js        # CU-13,14,15,16,35 - Materiales
│   │   ├── matriculas.js        # Gestión de matrículas
│   │   ├── notas.js             # CU-28,29,30,31 - Notas
│   │   ├── notificaciones.js    # CU-53 - Notificaciones SES
│   │   ├── reportes.js          # CU-17,18,19,23,24 - Reportes
│   │   ├── reservar-evaluacion.js # Agenda fono
│   │   ├── retroalimentacion.js # CU-20,21,22 - Feedback
│   │   ├── sesiones.js          # CU-41,42,43,44 - Sesiones terapéuticas
│   │   └── usuarios.js          # CU-05,06,07 - CRUD usuarios
│   │
│   ├── 📂 front/                # Frontend Lambda
│   │   ├── page-router.js       # Router dinámico de páginas
│   │   ├── 📂 pages/            # Plantillas HTML
│   │   │   ├── admin.html       # Panel administrador
│   │   │   ├── profesores.html  # Panel docentes
│   │   │   ├── fono.html        # Panel fonoaudióloga
│   │   │   ├── alumnos.html     # Portal alumnos
│   │   │   ├── home.html        # Página inicio
│   │   │   ├── galeria.html     # Galería de fotos
│   │   │   └── toma_hora.html   # Reserva de horas
│   │   ├── 📂 scripts/          # JavaScript del frontend
│   │   │   ├── admin.js         # Lógica panel admin (1700+ líneas)
│   │   │   ├── profesores.js    # Lógica panel docentes
│   │   │   ├── fono.js          # Lógica panel fono
│   │   │   ├── alumnos.js       # Lógica portal alumnos
│   │   │   └── home.js          # Lógica página inicio
│   │   └── 📂 shared/           # Estilos CSS compartidos
│   │       └── boyhappy-styles.css
│   │
│   └── 📂 layers/               # Lambda Layers compartidos
│       └── 📂 common/
│           └── nodejs/
│               └── authMiddleware.js  # Middleware de autenticación
│
├── 📂 scripts/                  # Scripts de utilidad
│   ├── init-admin.js            # Crear usuario admin inicial
│   ├── reset-admin-password.js  # Resetear password admin
│   └── seed-database.js         # Poblar BD con datos de prueba
│
├── 📂 test/                     # Tests (Jest)
│   └── boy_happy.test.ts
│
├── 📄 .env                      # Variables de entorno (NO COMMITEAR)
├── 📄 package.json              # Dependencias del proyecto
├── 📄 cdk.json                  # Configuración CDK
├── 📄 tsconfig.json             # Configuración TypeScript
├── 📄 README.md                 # Este archivo
└── 📄 FUNCIONALIDADES_IMPLEMENTADAS.md  # Documentación técnica
```

---

## 🔧 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** 18.x o superior ([Descargar](https://nodejs.org/))
- **npm** 9.x o superior (incluido con Node.js)
- **AWS CLI** configurado con credenciales ([Guía](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html))
- **Cuenta de AWS** con permisos de administrador
- **Git** para clonar el repositorio

### Verificar instalación:

```bash
node --version   # Debe mostrar v18.x o superior
npm --version    # Debe mostrar 9.x o superior
aws --version    # Debe mostrar AWS CLI instalado
```

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd Proyecto_Boy_happy
```

### 2. Instalar dependencias del proyecto principal

```bash
npm install
```

Esto instalará:
- AWS CDK CLI (`aws-cdk`)
- TypeScript y tipos
- Dependencias de infraestructura

### 3. Instalar dependencias de scripts

```bash
cd scripts
npm install
cd ..
```

Esto instalará:
- AWS SDK v3
- Dependencias para seeding de BD

---

## ⚙️ Configuración

### 1. Configurar AWS CLI

Si no lo has hecho, configura tus credenciales de AWS:

```bash
aws configure
```

Ingresa:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `us-east-1` (recomendado)
- Default output format: `json`

### 2. Configurar variables de entorno

Edita el archivo `.env` con tus credenciales:

```bash
# Cognito (obtenidos después del primer deploy)
USER_POOL_ID=us-east-1_XXXXXXXXX
CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxx
CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_DOMAIN=https://boyhappy-auth.auth.us-east-1.amazoncognito.com

# API Gateway (obtenido después del primer deploy)
API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com

# Email para notificaciones (debe estar verificado en SES)
SOURCE_EMAIL=noreply@tudominio.cl
CONTACT_EMAIL=contacto@tudominio.cl

# Opcional - Desarrollo local
DEV_PORT=3000
```

**⚠️ IMPORTANTE:**
- El archivo `.env` está en `.gitignore` y NO debe commitearse
- Algunos valores se obtienen DESPUÉS del primer deploy

---

## 📦 Deploy a AWS

### Primera vez: Bootstrap de CDK

Si es la primera vez que usas CDK en tu cuenta de AWS:

```bash
npx cdk bootstrap aws://ACCOUNT-ID/REGION
```

Ejemplo:
```bash
npx cdk bootstrap aws://123456789012/us-east-1
```

### Deploy completo

```bash
# 1. Compilar TypeScript a JavaScript
npm run build

# 2. Verificar cambios (opcional)
npm run diff

# 3. Generar template CloudFormation (opcional)
npx cdk synth

# 4. Deploy a AWS
npm run deploy
```

El deploy tarda **15-20 minutos** aproximadamente.

### Outputs del Deploy

Al finalizar, CDK mostrará outputs importantes:

```
Outputs:
BoyHappyStack.WebsiteURL = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
BoyHappyStack.UserPoolId = us-east-1_XXXXXXXXX
BoyHappyStack.ClientId = xxxxxxxxxxxxxxxxxxxxxx
BoyHappyStack.ImagesBucketName = boyhappy-images-123456789012
BoyHappyStack.MaterialesBucketName = boyhappy-materiales-123456789012
BoyHappyStack.BackupsBucketName = boyhappy-backups-123456789012  ⚡
```

**IMPORTANTE:** Copia estos valores al archivo `.env`

---

## 🎯 Uso del Sistema

### 1. Crear usuario administrador inicial

```bash
cd scripts
node init-admin.js
```

Ingresa:
- RUT del admin (ej: 12345678-9)
- Nombre completo
- Email (debe estar verificado en SES si quieres recibir notificaciones)
- Password temporal

### 2. Acceder al sistema

Abre en tu navegador:
```
https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
```

**Login con el usuario admin creado:**
- Email: el que configuraste
- Password: la password temporal
- Te pedirá cambiar la password en el primer login

### 3. Roles y Permisos

| Rol | Acceso | URL |
|-----|--------|-----|
| **Admin** | Panel completo de administración | `/admin` |
| **Profesor** | Gestión de notas, asistencia, materiales | `/profesores` |
| **Fono** | Agenda, sesiones, informes | `/fono` |
| **Alumno** | Vista de notas y asistencia | `/alumnos` |

---

## 📜 Scripts Disponibles

### Proyecto Principal

```bash
# Compilar TypeScript
npm run build

# Watch mode (auto-compilar al guardar)
npm run watch

# Ejecutar tests
npm run test

# Deploy a AWS
npm run deploy

# Ver diferencias antes de deploy
npm run diff

# Generar template CloudFormation
npx cdk synth

# Destruir stack (¡CUIDADO! Elimina todo)
npm run destroy
```

### Scripts de Utilidad (carpeta scripts/)

```bash
cd scripts

# Crear usuario admin inicial
node init-admin.js

# Resetear password de admin
node reset-admin-password.js

# Poblar BD con datos de prueba
node seed-database.js
```

---

## 💻 Desarrollo Local

### Opciones de desarrollo local:

#### Trabajar directamente con AWS

- Realiza cambios en `src/`
- Ejecuta `npm run build`
- Deploy solo las funciones modificadas:

```bash
# Deploy rápido (solo actualiza lo que cambió)
npm run deploy
```

### Hot Reload con Watch Mode

Terminal 1:
```bash
npm run watch  # Auto-compila al guardar
```

Terminal 2:
```bash
npm run deploy  # Deploy manual cuando sea necesario
```

---

## 📚 Documentación Adicional

### Archivos de documentación:

- **[FUNCIONALIDADES_IMPLEMENTADAS.md](./FUNCIONALIDADES_IMPLEMENTADAS.md)** - Detalles técnicos de funcionalidades nuevas
- **[ANALISIS_COBERTURA_ACTUALIZADO.md](./ANALISIS_COBERTURA_ACTUALIZADO.md)** - Cobertura de requisitos funcionales (94.9%)
- **[PENDIENTES_PARA_100.md](./PENDIENTES_PARA_100.md)** - Roadmap de mejoras futuras

### Casos de Uso Implementados:

Ver archivo `cu.txt` para la lista completa de 59 casos de uso.

**Principales:**
- CU-01 a CU-07: Gestión de Usuarios
- CU-12: Backups Automáticos ⚡
- CU-13 a CU-16: Workflow de Materiales
- CU-17 a CU-25: Reportes y Exportación ⚡
- CU-28 a CU-31: Notas Académicas
- CU-32 a CU-34: Asistencia
- CU-41 a CU-48: Fonoaudiología Completa
- CU-54 a CU-59: Comunicaciones

---

## 🔍 Troubleshooting

### Error: "User pool does not exist"

**Causa:** Variables de Cognito incorrectas en `.env`

**Solución:**
```bash
# Obtener outputs del stack desplegado
aws cloudformation describe-stacks --stack-name BoyHappyStack --query 'Stacks[0].Outputs'

# Copiar valores a .env
```

### Error: "Access Denied" al hacer deploy

**Causa:** Permisos IAM insuficientes

**Solución:**
```bash
# Verificar credenciales configuradas
aws sts get-caller-identity

# Asegúrate de tener permisos de AdministratorAccess o al menos:
# - Lambda, DynamoDB, API Gateway, S3, Cognito, CloudFormation, IAM, EventBridge
```

### Error: "Email address is not verified" (SES)

**Causa:** SES en modo sandbox requiere verificar emails

**Solución:**
```bash
# Verificar email en SES
aws ses verify-email-identity --email-address noreply@tudominio.cl

# Revisar inbox y confirmar verificación
```

### Backup no se ejecuta automáticamente

**Verificación:**
```bash
# Ver reglas de EventBridge
aws events list-rules --name-prefix boyhappy-backup

# Ver últimas ejecuciones
aws events list-rule-names-by-target --target-arn <LAMBDA_ARN>
```

**Forzar ejecución manual:**
```bash
# Desde la UI de admin o con curl
curl -X POST https://TU-API-URL/backup
```

---

## 🔒 Seguridad

### Best Practices Implementadas:

- ✅ Autenticación OAuth2 con AWS Cognito
- ✅ Tokens JWT para autorización
- ✅ Políticas IAM con principio de mínimo privilegio
- ✅ Encriptación en tránsito (HTTPS)
- ✅ Encriptación en reposo (DynamoDB + S3)
- ✅ Variables sensibles NO commiteadas (`.gitignore`)
- ✅ Backups automáticos con retención de 30 días
- ✅ Bucket de backups con RemovalPolicy.RETAIN

### Recomendaciones para Producción:

1. **Usar AWS Secrets Manager** para variables sensibles
2. **Habilitar MFA** en usuarios críticos
3. **Configurar CloudWatch Alarms** para métricas críticas
4. **Implementar WAF** en API Gateway
5. **Usar dominio personalizado** con certificado SSL

---

## 👥 Roles de Usuario

| Rol | Grupo Cognito | Permisos |
|-----|---------------|----------|
| **Admin** | `admin` | Acceso completo: usuarios, configuración, reportes, backups |
| **Profesor** | `profesor` | Notas, asistencia, materiales, bitácora |
| **Fono** | `fono` | Agenda, sesiones terapéuticas, informes, bitácora terapéutica |
| **Alumno** | `alumno` | Vista de notas, asistencia, materiales (solo lectura) |
| **Apoderado** | `apoderado` | Vista de información de pupilos |

---

## 🎯 Endpoints Principales

### Autenticación
- `GET /login` - Iniciar sesión OAuth
- `GET /callback` - Callback OAuth

### Usuarios
- `POST /usuarios` - Crear usuario
- `GET /usuarios` - Listar usuarios
- `PUT /usuarios?rut=X` - Actualizar usuario
- `DELETE /usuarios?rut=X` - Eliminar usuario

### Notas
- `POST /notas` - Ingresar nota
- `GET /notas?rutAlumno=X` - Consultar notas
- `GET /notas/promedios?rutAlumno=X` - Calcular promedios
- `PUT /notas?id=X` - Modificar nota
- `DELETE /notas?id=X` - Eliminar nota

### Reportes
- `GET /reportes/asistencia?curso=X` - Reporte de asistencia
- `GET /reportes/cumplimiento` - Cumplimiento docente
- `GET /reportes/indicadores` - Indicadores generales

### Exportación ⚡ NUEVO
- `GET /exportar/asistencia?formato=csv&curso=X` - Exportar asistencia
- `GET /exportar/notas?formato=xlsx` - Exportar notas
- `GET /exportar/cumplimiento?formato=csv` - Exportar cumplimiento

### Backups ⚡ NUEVO
- `GET /backup` - Info del último backup
- `POST /backup` - Crear backup manual

---

## 📊 Métricas del Proyecto

- **Lambdas:** 25+ funciones
- **Endpoints API:** 60+ rutas
- **Tablas DynamoDB:** 9
- **Líneas de código:** ~15,000+
- **Casos de Uso:** 56/59 implementados (94.9%)
- **Cobertura funcional:** 94.9%

---

## 🤝 Contribuir

1. Fork del proyecto
2. Crear rama para feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

## 📄 Licencia

[Especificar licencia - MIT, GPL, Propietaria, etc.]

---

## 📧 Contacto

- **Proyecto:** BoyHappy School Management System
- **Email:** contacto@boyhappy.cl
- **Desarrollado con:** AWS CDK, Lambda, DynamoDB, Cognito

---

**Desarrollado con ❤️ usando AWS CDK y Serverless Architecture**

**Última actualización:** Octubre 2025 - v1.0.0
