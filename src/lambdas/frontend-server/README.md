# Frontend Server - Lambda Unificada

Lambda unificada para servir páginas HTML dinámicas y assets estáticos del proyecto Boy Happy.

## Arquitectura

```
frontend-server/
├── handler.js          # Entry point: routing interno
├── page-renderer.js    # Genera HTML con auto-discovery
├── static-server.js    # Sirve JS/CSS con caché
└── README.md           # Este archivo
```

## Auto-Discovery

El sistema detecta automáticamente recursos sin necesidad de configuración manual.

### 1. Páginas HTML

**Convención:**
- `frontend/pages/home.html` → Ruta: `/`
- `frontend/pages/admin.html` → Ruta: `/admin`
- `frontend/pages/toma_hora.html` → Ruta: `/toma-hora` (guiones bajos se convierten en guiones)

**Cómo agregar una nueva página:**
```bash
# 1. Crear HTML
echo '<html>...</html>' > src/frontend/pages/nueva.html

# 2. ¡Listo! La ruta /nueva está disponible automáticamente
```

---

### 2. Scripts por Página

**Opción A: Archivo único**
```
frontend/scripts/home.js → Se carga en /home
```

**Opción B: Múltiples módulos**
```
frontend/scripts/admin/
├── dashboard.js
├── usuarios.js
└── materiales.js

→ Todos se cargan en /admin (orden alfabético)
```

**Cómo agregar scripts a una página:**
```bash
# Página simple
touch src/frontend/scripts/nueva.js

# Página compleja
mkdir src/frontend/scripts/nueva
touch src/frontend/scripts/nueva/modulo1.js
touch src/frontend/scripts/nueva/modulo2.js
```

---

### 3. CSS por Página

**Convención:**
- CSS dentro de carpetas de scripts: `frontend/scripts/admin/*.css`

```bash
# Agregar CSS específico de página
touch src/frontend/scripts/admin/estilos.css
```

---

### 4. Scripts Compartidos (Alpine.js)

**Orden de carga automático** (por convención de carpetas):

1. `shared/utils/*.js` - Utilidades base (sin dependencias)
2. `shared/http-client/*.js` - Cliente HTTP
3. `shared/components/*.js` - Componentes UI
4. `shared/store/*.js` - Alpine stores (antes de Alpine.start())

Dentro de cada carpeta: **orden alfabético automático**.

**Cómo agregar utilidad compartida:**
```bash
# Se carga automáticamente en el orden correcto
touch src/frontend/shared/utils/nueva-utilidad.js
```

---

### 5. CSS Compartido

**Convención:**
- `frontend/shared/assets/*.css` (orden alfabético)

```bash
# Agregar CSS global
touch src/frontend/shared/assets/nuevo.css
```

---

## Flujo de Rendering

```
Usuario solicita /admin
        ↓
handler.js (routing interno)
        ↓
    ¿Es asset estático?
    ├─ SÍ → static-server.js (caché 1 año)
    └─ NO → page-renderer.js
                ↓
        Auto-discovery:
        1. Detecta admin.html
        2. Descubre scripts/admin/*.js
        3. Encuentra CSS especiales
        4. Carga shared/* en orden
                ↓
        Genera HTML final
                ↓
        Devuelve al navegador
```

---

## Caché

- **HTML dinámico**: `Cache-Control: no-cache`
- **Assets estáticos**: `Cache-Control: public, max-age=31536000` (1 año)

---

## Variables de Entorno

Disponibles en templates HTML:
- `{{API_URL}}` - URL del API Gateway
- `{{CLIENT_ID}}` - Cognito Client ID
- `{{COGNITO_DOMAIN}}` - Cognito Domain

En JavaScript (inyectado automáticamente):
```javascript
window.APP_CONFIG.API_URL
window.APP_CONFIG.CLIENT_ID
window.APP_CONFIG.COGNITO_DOMAIN
```

---

## Agregar Nueva Página (Checklist)

✅ Paso 1: Crear HTML
```bash
touch src/frontend/pages/nueva.html
```

✅ Paso 2: Agregar scripts (opcional)
```bash
# Opción A: Un solo archivo
touch src/frontend/scripts/nueva.js

# Opción B: Múltiples módulos
mkdir src/frontend/scripts/nueva
touch src/frontend/scripts/nueva/app.js
```

✅ Paso 3: ¡Deploy!
```bash
npm run deploy
```

**No se requiere:**
- ❌ Modificar CDK stack
- ❌ Actualizar configuración
- ❌ Registrar rutas manualmente

Todo se detecta automáticamente 🎉

---

## Debugging

Los logs muestran el auto-discovery en acción:

```
📄 Auto-discovered 8 pages: [ '/', '/admin', '/alumnos', ... ]
  ✓ utils/constants.js
  ✓ utils/helpers.js
  ✓ http-client/client.js
  ✓ components/alpine.js
🔗 Auto-discovered 12 shared scripts
⭐ Page admin: multiple scripts (7 files)
✅ Page rendered: /admin (45231 chars)
```

---

## Estructura Completa

```
src/
├── lambdas/
│   ├── api/                         # API lambdas (auto-discovery también)
│   └── frontend-server/             # Esta lambda
│       ├── handler.js
│       ├── page-renderer.js
│       └── static-server.js
│
└── frontend/                        # Assets del cliente
    ├── pages/                       # ✨ Auto-discovery de rutas
    │   ├── home.html
    │   └── admin.html
    │
    ├── scripts/                     # ✨ Auto-discovery de scripts
    │   ├── home.js
    │   ├── admin/
    │   │   ├── dashboard.js
    │   │   └── usuarios.js
    │   └── common.js                # Cargado globalmente si existe
    │
    └── shared/                      # ✨ Auto-discovery ordenado
        ├── utils/                   # 1. Primero
        ├── http-client/             # 2. Segundo
        ├── components/              # 3. Tercero
        ├── store/                   # 4. Cuarto (Alpine stores)
        └── assets/                  # CSS global
```

---

## Convenciones vs Configuración

❌ **Antes** (con `load-order.json`):
```json
{
  "loadOrder": [
    { "files": ["utils/constants.js", "utils/helpers.js"] }
  ]
}
```
→ Cada archivo nuevo requiere actualizar JSON

✅ **Ahora** (auto-discovery):
```bash
touch src/frontend/shared/utils/nueva.js
```
→ Se detecta y carga automáticamente

---

## Beneficios

1. ✅ **Escalable**: Funciona con 10 o 1000 archivos
2. ✅ **Sin configuración**: Agregar archivos sin tocar código
3. ✅ **Mantenible**: Convenciones claras y consistentes
4. ✅ **Predecible**: Orden de carga basado en carpetas
5. ✅ **Rápido**: Caché agresivo para assets estáticos
