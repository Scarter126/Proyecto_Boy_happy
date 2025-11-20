/**
 * Frontend Development Server con Bun.build() + Bun.serve()
 *
 * Usa Bun.build() con la opción define para inyectar variables de entorno:
 * - Bundlea y transpila JSX/TSX con Preact
 * - Inyecta variables de entorno en el bundle como valores literales
 * - Sirve el bundle con HMR manual (watch mode)
 * - Proxy a API backend
 */

import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

const PORT = 3005;
const API_URL = 'http://localhost:3000';

// Cargar variables de entorno del .env de la raíz
const ROOT = join(import.meta.dir, '..');
process.chdir(ROOT); // Asegurar que Bun cargue el .env de la raíz

console.log('🔐 Variables de entorno detectadas:', {
  API_URL: process.env.API_URL || '(vacío)',
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || '(no encontrado)',
  COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || '(no encontrado)',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
});

// Rutas
const FRONTEND_DIR = join(ROOT, 'frontend');
const ENTRYPOINT = join(FRONTEND_DIR, 'src', 'main.jsx');
const OUT_DIR = join(ROOT, '.dev-build');
const INDEX_HTML = join(FRONTEND_DIR, 'index.html');

// Build inicial
let bundledJS = '';
let bundledCSS = '';

async function buildFrontend() {
  console.log('🔨 Bundleando frontend...');

  const result = await Bun.build({
    entrypoints: [ENTRYPOINT],
    outdir: OUT_DIR,
    target: 'browser',
    minify: false,
    sourcemap: 'inline',

    // ⭐ ESTO ES LO IMPORTANTE: Inyecta variables de entorno como valores literales
    define: {
      'process.env.NODE_ENV': '"development"',
      'process.env.API_URL': JSON.stringify(process.env.API_URL || ''),
      'process.env.COGNITO_USER_POOL_ID': JSON.stringify(process.env.COGNITO_USER_POOL_ID || ''),
      'process.env.COGNITO_CLIENT_ID': JSON.stringify(process.env.COGNITO_CLIENT_ID || ''),
      'process.env.AWS_REGION': JSON.stringify(process.env.AWS_REGION || 'us-east-1'),
    },
  });

  if (!result.success) {
    console.error('❌ Build failed:', result.logs);
    throw new Error('Build failed');
  }

  // Leer el bundle JS generado
  const bundlePath = join(OUT_DIR, 'main.js');
  if (existsSync(bundlePath)) {
    bundledJS = readFileSync(bundlePath, 'utf-8');
    console.log('✅ Frontend JS bundleado correctamente');
  } else {
    throw new Error('Bundle JS file not found');
  }

  // Leer el bundle CSS generado
  const cssPath = join(OUT_DIR, 'main.css');
  if (existsSync(cssPath)) {
    bundledCSS = readFileSync(cssPath, 'utf-8');
    console.log('✅ Frontend CSS bundleado correctamente');
  } else {
    console.warn('⚠️ CSS bundle not found (optional)');
  }
}

// Build inicial
await buildFrontend();

// Leer el HTML base
let indexHTML = readFileSync(INDEX_HTML, 'utf-8');

// Inyectar el CSS bundleado en el <head>
indexHTML = indexHTML.replace(
  '</head>',
  '  <link rel="stylesheet" href="/bundle.css">\n</head>'
);

// Reemplazar el <script type="module" src="./src/main.jsx"> con el bundle
indexHTML = indexHTML.replace(
  /<script type="module" src="\.\/src\/main\.jsx"><\/script>/,
  '<script type="module" src="/bundle.js"></script>'
);

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // Proxy a API backend
    if (url.pathname.startsWith('/api/')) {
      try {
        const apiUrl = `${API_URL}${url.pathname}${url.search}`;
        return await fetch(apiUrl, {
          method: req.method,
          headers: req.headers,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
        });
      } catch (error) {
        console.error('❌ API Proxy error:', error);
        return Response.json({ error: 'API no disponible' }, { status: 503 });
      }
    }

    // Servir el bundle JS
    if (url.pathname === '/bundle.js') {
      return new Response(bundledJS, {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    // Servir el bundle CSS
    if (url.pathname === '/bundle.css') {
      return new Response(bundledCSS, {
        headers: { 'Content-Type': 'text/css' },
      });
    }

    // Servir assets estáticos
    if (url.pathname.startsWith('/shared/')) {
      const assetPath = join(FRONTEND_DIR, url.pathname);
      if (existsSync(assetPath)) {
        const file = Bun.file(assetPath);
        return new Response(file);
      }
    }

    // SPA routing - servir index.html para rutas de la app
    return new Response(indexHTML, {
      headers: { 'Content-Type': 'text/html' },
    });
  },

  error(error) {
    console.error('❌ Server error:', error);
    return new Response('Internal Server Error', { status: 500 });
  },
});

console.log(`
╔═══════════════════════════════════════════════════════╗
║  🚀 Frontend Dev Server (Bun.build + env inject)     ║
╠═══════════════════════════════════════════════════════╣
║  URL:      http://localhost:${PORT}                      ║
║  API:      Proxy → http://localhost:3000             ║
║  Bundle:   ✅ Variables de entorno inyectadas        ║
║  Preact:   ✅ JSX/TSX transpilado                     ║
║  HMR:      🔄 Reinicia con bun run dev:app           ║
╚═══════════════════════════════════════════════════════╝
`);

// Watch mode con fs.watch de Node.js
import { watch } from 'fs';
let isRebuilding = false;

const watcher = watch(FRONTEND_DIR, { recursive: true }, async (eventType, filename) => {
  if (!filename || isRebuilding) return;

  // Filtrar solo archivos relevantes
  if (filename.match(/\.(jsx?|tsx?|css)$/)) {
    isRebuilding = true;
    console.log(`📝 Cambio detectado en ${filename}, rebuilding...`);

    try {
      await buildFrontend();
      console.log('✅ Rebuild completado');
    } catch (error) {
      console.error('❌ Error en rebuild:', error);
    } finally {
      // Debounce de 1 segundo
      setTimeout(() => {
        isRebuilding = false;
      }, 1000);
    }
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Cerrando servidor...');
  server.stop();
  watcher?.close();
  process.exit(0);
});
