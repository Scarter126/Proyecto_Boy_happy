/**
 * Service Worker
 *
 * Estrategia de cache para optimizar free tier:
 * - Cache-first para assets estáticos (CSS, JS, images)
 * - Network-first para HTML y componentes
 * - No cache para API calls
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `boyhappy-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `boyhappy-dynamic-${CACHE_VERSION}`;

// Assets que se cachean inmediatamente al instalar
const STATIC_ASSETS = [
  '/',
  '/shared/assets/main.css',
  '/shared/assets/pages.css',
  '/shared/component-loader.js',
  '/pages/home/scripts/components.js',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Patrones de URLs a cachear
const CACHE_PATTERNS = {
  static: [
    /\/shared\/assets\/.+\.(css|js|svg|png|jpg|jpeg|webp|gif)$/,
    /\/shared\/.+\.js$/,
    /\/pages\/.+\.html$/,
    /cloudfront\.net\/.+\.(css|js|svg|png|jpg|jpeg|webp|gif)$/,
    /cdn\.jsdelivr\.net/,
    /unpkg\.com/,
    /cdnjs\.cloudflare\.com/,
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/
  ],
  api: [
    /\/api\//
  ]
};

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch(err => {
      console.warn('[SW] Error caching static assets:', err);
    })
  );

  self.skipWaiting(); // Activar inmediatamente
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(cacheName =>
            (cacheName.startsWith('boyhappy-') && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE)
          )
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );

  self.clients.claim(); // Tomar control inmediatamente
});

// Intercepción de peticiones
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No cachear requests POST/PUT/DELETE
  if (request.method !== 'GET') {
    return;
  }

  // No cachear API calls
  if (isAPIRequest(url)) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Cache-first para assets estáticos
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Network-first para HTML y componentes
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

/**
 * Determinar si es una petición a la API
 */
function isAPIRequest(url) {
  return CACHE_PATTERNS.api.some(pattern => pattern.test(url.pathname));
}

/**
 * Determinar si es un asset estático
 */
function isStaticAsset(url) {
  return CACHE_PATTERNS.static.some(pattern =>
    pattern.test(url.href) || pattern.test(url.pathname)
  );
}

/**
 * Estrategia Cache-First
 * Intenta obtener de cache primero, si falla va a la red
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // Solo cachear respuestas exitosas
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', request.url, error);

    // Retornar respuesta por defecto si está offline
    return new Response(
      '<div style="padding: 20px; text-align: center;">' +
      '<h2>Sin conexión</h2>' +
      '<p>Por favor verifica tu conexión a internet.</p>' +
      '</div>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Estrategia Network-First
 * Intenta obtener de la red primero, si falla usa cache
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);

    // Solo cachear respuestas exitosas
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn('[SW] Network failed, using cache:', request.url);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // No hay cache ni red disponible
    return new Response(
      '<div style="padding: 20px; text-align: center;">' +
      '<h2>Sin conexión</h2>' +
      '<p>No se pudo cargar el contenido. Por favor verifica tu conexión.</p>' +
      '</div>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Estrategia Network-Only
 * Solo red, sin cache
 */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.error('[SW] Network request failed:', request.url, error);
    return new Response(
      JSON.stringify({ error: 'Network error', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Mensaje de sincronización (futuro: background sync)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});
