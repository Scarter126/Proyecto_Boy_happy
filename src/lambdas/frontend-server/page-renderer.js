/**
 * Page Renderer - Generación de HTML dinámico con auto-discovery
 *
 * Auto-discovery features:
 * 1. Páginas: Escanea frontend/pages/*.html automáticamente
 * 2. Scripts por página: Detecta scripts/{nombre}.js o scripts/{nombre}/*.js
 * 3. Shared scripts: Carga en orden por convención de carpetas
 * 4. CSS: Auto-detecta shared/assets/*.css y scripts/{nombre}/*.css
 *
 * Sin configuración manual - Todo por convención
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONVENCIONES DE AUTO-DISCOVERY
// ============================================================================

/**
 * Orden de carga de carpetas compartidas (convención hardcoded)
 * Estas carpetas son estables y definen dependencias claras
 */
const SHARED_FOLDERS_ORDER = [
  'utils',       // 1. Sin dependencias (constants, helpers, auth)
  'http-client', // 2. Usa utils
  'components',  // 3. Componentes UI (pueden usar http-client)
  'store'        // 4. Alpine stores (DEBEN cargar antes de Alpine.start)
];

/**
 * Directorio base del frontend (relativo a esta lambda)
 */
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

// ============================================================================
// AUTO-DISCOVERY DE PÁGINAS
// ============================================================================

/**
 * Descubre todas las páginas HTML disponibles
 * Convención: pages/home.html → ruta '/'
 *             pages/admin.html → ruta '/admin'
 *             pages/toma_hora.html → ruta '/toma-hora'
 */
function discoverPages() {
  const pagesDir = path.join(FRONTEND_DIR, 'pages');
  const routes = {};

  try {
    const files = fs.readdirSync(pagesDir);

    files.forEach(file => {
      if (!file.endsWith('.html')) return;

      const name = file.replace('.html', '');
      // home.html → '/', otros → '/{name}' (con _ convertido a -)
      const routePath = name === 'home' ? '/' : `/${name.replace(/_/g, '-')}`;

      routes[routePath] = {
        html: file,
        name: name
      };
    });

    console.log(`📄 Auto-discovered ${Object.keys(routes).length} pages:`, Object.keys(routes));
  } catch (error) {
    console.error('❌ Error discovering pages:', error.message);
  }

  return routes;
}

// ============================================================================
// AUTO-DISCOVERY DE SCRIPTS COMPARTIDOS
// ============================================================================

/**
 * Descubre scripts compartidos siguiendo convención de orden de carpetas
 * @returns {Array<string>} Lista de rutas relativas (ej: 'utils/constants.js')
 */
function discoverSharedScripts() {
  const sharedDir = path.join(FRONTEND_DIR, 'shared');
  const scripts = [];

  SHARED_FOLDERS_ORDER.forEach(folderName => {
    const folderPath = path.join(sharedDir, folderName);

    if (!fs.existsSync(folderPath)) {
      console.log(`  ⚠ ${folderName}/ not found (skipped)`);
      return;
    }

    if (!fs.statSync(folderPath).isDirectory()) {
      return;
    }

    // Leer archivos .js en orden alfabético
    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.js'))
      .sort(); // Alfabético

    files.forEach(file => {
      scripts.push(`${folderName}/${file}`);
      console.log(`  ✓ ${folderName}/${file}`);
    });
  });

  console.log(`🔗 Auto-discovered ${scripts.length} shared scripts`);
  return scripts;
}

/**
 * Descubre CSS compartido en shared/assets/
 * @returns {Array<string>} Lista de rutas relativas (ej: 'assets/main.css')
 */
function discoverSharedCSS() {
  const assetsDir = path.join(FRONTEND_DIR, 'shared', 'assets');
  const cssFiles = [];

  if (!fs.existsSync(assetsDir)) {
    console.log('  ⚠ shared/assets/ not found');
    return cssFiles;
  }

  const files = fs.readdirSync(assetsDir)
    .filter(f => f.endsWith('.css'))
    .sort();

  files.forEach(file => {
    cssFiles.push(`assets/${file}`);
    console.log(`🎨 assets/${file}`);
  });

  console.log(`🎨 Auto-discovered ${cssFiles.length} shared CSS files`);
  return cssFiles;
}

// ============================================================================
// AUTO-DISCOVERY DE SCRIPTS POR PÁGINA
// ============================================================================

/**
 * Detecta scripts específicos de una página
 * Convención:
 *   - scripts/admin.js → archivo único
 *   - scripts/admin/ → carpeta con múltiples módulos
 *
 * @param {string} pageName - Nombre de la página (ej: 'admin', 'home')
 * @returns {Object} { type: 'single'|'multiple'|'none', files: [] }
 */
function discoverPageScripts(pageName) {
  const scriptsDir = path.join(FRONTEND_DIR, 'scripts');
  const singleFile = `${pageName}.js`;
  const folderPath = path.join(scriptsDir, pageName);
  const singlePath = path.join(scriptsDir, singleFile);

  // Opción 1: Carpeta con múltiples scripts (scripts/admin/*.js)
  if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.js'))
      .sort(); // Alfabético

    console.log(`⭐ Page ${pageName}: multiple scripts (${files.length} files)`);
    return {
      type: 'multiple',
      folder: pageName,
      files: files
    };
  }

  // Opción 2: Archivo único (scripts/home.js)
  if (fs.existsSync(singlePath)) {
    console.log(`✓ Page ${pageName}: single script (${singleFile})`);
    return {
      type: 'single',
      file: singleFile
    };
  }

  // Opción 3: Sin scripts específicos
  console.log(`  Page ${pageName}: no specific scripts`);
  return {
    type: 'none'
  };
}

/**
 * Detecta CSS específicos de una página
 * Convención: scripts/{nombre}/*.css
 *
 * @param {string} pageName
 * @returns {Array<string>} Lista de archivos CSS
 */
function discoverPageCSS(pageName) {
  const folderPath = path.join(FRONTEND_DIR, 'scripts', pageName);
  const cssFiles = [];

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return cssFiles;
  }

  const files = fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.css'))
    .sort();

  files.forEach(file => {
    cssFiles.push(file);
  });

  if (cssFiles.length > 0) {
    console.log(`🎨 Page ${pageName}: ${cssFiles.length} CSS files`);
  }

  return cssFiles;
}

// ============================================================================
// GENERADORES DE TAGS HTML
// ============================================================================

/**
 * Genera script de configuración inline (único script inline permitido)
 */
function buildConfigScript() {
  const isDevMode = process.env.API_URL?.includes('localhost');
  const devToken = isDevMode ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGJveWhhcHB5LmNsIiwiY29nbml0bzpncm91cHMiOlsiYWRtaW4iXSwiY29nbml0bzp1c2VybmFtZSI6ImFkbWluIiwiZXhwIjo5OTk5OTk5OTk5fQ.fake' : '';

  return `
    <script>
      window.APP_CONFIG = {
        API_URL: '${process.env.API_URL || ''}',
        CLIENT_ID: '${process.env.CLIENT_ID || ''}',
        COGNITO_DOMAIN: '${process.env.COGNITO_DOMAIN || ''}'
      };
      const API_URL = window.APP_CONFIG.API_URL;
      const CLIENT_ID = window.APP_CONFIG.CLIENT_ID;
      const COGNITO_DOMAIN = window.APP_CONFIG.COGNITO_DOMAIN;
      const REDIRECT_URI = API_URL + '/callback';

      ${isDevMode ? `
      document.cookie = 'idToken=${devToken}; path=/; max-age=86400';
      console.log('🔓 DEV MODE: Auth bypassed');
      ` : ''}
    </script>`;
}

/**
 * Genera tags <script src="..."> para scripts compartidos
 */
function generateSharedScriptTags(sharedScripts) {
  // Usar API_URL como base para assets estáticos (incluye /prod/ en AWS)
  const baseUrl = process.env.API_URL || '';
  return sharedScripts.map(file => {
    // Sin defer: se ejecutan en orden inmediatamente, ANTES de Alpine
    return `<script src="${baseUrl}/shared/${file}"></script>`;
  }).join('\n');
}

/**
 * Genera tags <link> para CSS compartido
 */
function generateSharedCSSLinks(sharedCSS) {
  const baseUrl = process.env.API_URL || '';
  return sharedCSS.map(file => {
    return `<link rel="stylesheet" href="${baseUrl}/shared/${file}">`;
  }).join('\n');
}

/**
 * Genera tags de scripts específicos de página
 */
function generatePageScriptTags(pageScripts) {
  if (pageScripts.type === 'none') {
    return '';
  }

  const baseUrl = process.env.API_URL || '';
  let tags = '';

  // common.js global (si existe)
  const commonPath = path.join(FRONTEND_DIR, 'scripts', 'common.js');
  if (fs.existsSync(commonPath)) {
    tags += `<script src="${baseUrl}/scripts/common.js"></script>\n`;
  }

  // Scripts específicos de la página
  if (pageScripts.type === 'single') {
    tags += `<script src="${baseUrl}/scripts/${pageScripts.file}"></script>`;
  } else if (pageScripts.type === 'multiple') {
    pageScripts.files.forEach(file => {
      tags += `<script src="${baseUrl}/scripts/${pageScripts.folder}/${file}"></script>\n`;
    });
  }

  return tags;
}

/**
 * Genera tags de CSS específicos de página
 */
function generatePageCSSLinks(pageName, pageCSSFiles) {
  if (pageCSSFiles.length === 0) {
    return '';
  }

  return pageCSSFiles.map(file => {
    return `<link rel="stylesheet" href="/scripts/${pageName}/${file}">`;
  }).join('\n');
}

// ============================================================================
// INICIALIZACIÓN (ejecuta al cargar el módulo)
// ============================================================================

console.log('🚀 Initializing Page Renderer with auto-discovery...');
const ROUTES = discoverPages();
const SHARED_SCRIPTS = discoverSharedScripts();
const SHARED_CSS = discoverSharedCSS();

// ============================================================================
// EXPORTS - Función principal de renderizado
// ============================================================================

/**
 * Renderiza una página HTML con auto-discovery completo
 */
exports.render = async (event) => {
  try {
    const requestPath = event.path || event.rawPath || '/';
    console.log(`🌐 Rendering page: ${requestPath}`);

    // 1. Obtener ruta (fallback a home si no existe)
    const route = ROUTES[requestPath] || ROUTES['/'];

    if (!route) {
      console.error(`❌ No route found for ${requestPath} and no home fallback`);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: '<h1>404 - Page not found</h1>'
      };
    }

    // 2. Leer HTML template
    const htmlPath = path.join(FRONTEND_DIR, 'pages', route.html);
    let html;

    try {
      html = fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      console.error(`❌ Error reading HTML file ${htmlPath}:`, error.message);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: '<h1>404 - Page not found</h1>'
      };
    }

    // 3. Auto-discovery de recursos de la página
    const pageScripts = discoverPageScripts(route.name);
    const pageCSSFiles = discoverPageCSS(route.name);

    // 4. Reemplazar variables de entorno en HTML
    html = html
      .replace(/{{API_URL}}/g, process.env.API_URL || '')
      .replace(/{{CLIENT_ID}}/g, process.env.CLIENT_ID || '')
      .replace(/{{COGNITO_DOMAIN}}/g, process.env.COGNITO_DOMAIN || '');

    // 5. Inyectar CSS (shared + page-specific)
    let styles = generateSharedCSSLinks(SHARED_CSS);
    styles += generatePageCSSLinks(route.name, pageCSSFiles);
    html = html.replace('<!-- STYLES -->', styles);

    // 6. Construir scripts en orden
    let scripts = buildConfigScript(); // Config inline
    scripts += generateSharedScriptTags(SHARED_SCRIPTS); // Shared (ordered)
    scripts += generatePageScriptTags(pageScripts); // Page-specific

    // 7. Inyectar scripts en HTML
    html = html.replace('<!-- SCRIPT -->', scripts);

    console.log(`✅ Page rendered: ${requestPath} (${html.length} chars)`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache', // HTML dinámico, no cachear
      },
      body: html
    };

  } catch (error) {
    console.error('❌ Error in page renderer:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<h1>500 - Server Error</h1><p>${error.message}</p>`
    };
  }
};
