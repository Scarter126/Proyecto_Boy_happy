# ⚠️ DEPRECATION NOTICE

## `utils/response.js` - DEPRECATED

**Fecha**: 2025-01-18
**Estado**: DEPRECADO - NO USAR

### Razón de Deprecación

Este archivo duplicaba funcionalidad ya presente en `responseHelper.js` con las siguientes inconsistencias:

1. **CORS Headers incompletos**: Faltaba `Cookie` en `Access-Control-Allow-Headers`
2. **Funcionalidades limitadas**: No incluía `badRequest()`, `serverError()`, `unauthorized()`, `forbidden()`, `notFound()`
3. **API inconsistente**: Nombres diferentes para funciones similares

### Migración

**❌ NO USAR:**
```javascript
const { response, errorResponse, successResponse } = require('./utils/response');
```

**✅ USAR EN SU LUGAR:**
```javascript
const { success, error, badRequest, serverError, unauthorized, forbidden, notFound } = requireLayer('responseHelper');
```

### Mapeo de Funciones

| utils/response.js (VIEJO) | responseHelper.js (NUEVO) |
|---------------------------|---------------------------|
| `response(statusCode, body)` | No usar directamente - usar helpers específicos |
| `errorResponse(statusCode, message, details)` | `error(statusCode, message, details)` |
| `successResponse(data, message)` | `success(data, statusCode)` |
| N/A | `badRequest(message, details)` |
| N/A | `serverError(message, details)` |
| N/A | `unauthorized(message)` |
| N/A | `forbidden(message)` |
| N/A | `notFound(message)` |

### Estado Actual

✅ Todas las lambdas han sido migradas a `responseHelper.js`
✅ No se encontraron referencias a `utils/response.js` en el código

### Acción Requerida

Este archivo será eliminado en la próxima refactorización. Si encuentras alguna referencia a este archivo, actualízala inmediatamente a `responseHelper.js`.

---

Para más información, ver: `layers/common/nodejs/responseHelper.js`
