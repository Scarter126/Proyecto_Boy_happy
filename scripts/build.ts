/**
 * Build Script para Producción con Bun
 *
 * Compila y prepara el proyecto para deployment:
 * - Frontend: Bundle con Bun (JSX/CSS/HTML nativo)
 * - API: Copia lambdas a dist/
 * - Layers: Copia layers a dist/
 */

import { rmSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');

console.log(`
╔═══════════════════════════════════════════════════════╗
║  🏗️  Building BoyHappy para Producción (Bun)         ║
╚═══════════════════════════════════════════════════════╝
`);

// === 1. LIMPIAR DIST ===
console.log('🧹 Limpiando dist/...');
try {
  rmSync(DIST, { recursive: true, force: true });
} catch (e) {
  // Ignorar si no existe
}
mkdirSync(DIST, { recursive: true });

// === 2. BUILD FRONTEND ===
console.log('\n📦 Compilando frontend con Bun...');

const FRONTEND_SRC = join(ROOT, 'frontend');
const FRONTEND_DIST = join(DIST, 'frontend');

try {
  mkdirSync(FRONTEND_DIST, { recursive: true });

  // Bun build para el frontend (entry point: main.jsx)
  const buildResult = await Bun.build({
    entrypoints: [join(FRONTEND_SRC, 'src/main.jsx')],
    outdir: FRONTEND_DIST,
    target: 'browser',
    format: 'esm',
    minify: true,
    sourcemap: 'external',
    splitting: true, // Code splitting automático
    naming: {
      entry: '[dir]/[name].[hash].[ext]',
      chunk: 'chunks/[name].[hash].[ext]',
      asset: 'assets/[name].[hash].[ext]',
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      'process.env.API_URL': JSON.stringify(process.env.API_URL || ''),
      'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
      'process.env.COGNITO_USER_POOL_ID': JSON.stringify(process.env.COGNITO_USER_POOL_ID || ''),
      'process.env.COGNITO_CLIENT_ID': JSON.stringify(process.env.COGNITO_CLIENT_ID || ''),
      'process.env.AWS_REGION': JSON.stringify(process.env.AWS_REGION || 'us-east-1'),
    },
  });

  if (!buildResult.success) {
    console.error('  ❌ Error en build:', buildResult.logs);
    process.exit(1);
  }

  // Copiar y actualizar index.html con referencias a archivos compilados
  const indexHtmlPath = join(FRONTEND_SRC, 'index.html');
  const indexHtmlContent = await Bun.file(indexHtmlPath).text();

  // Encontrar el archivo JS principal compilado
  const mainJsFile = buildResult.outputs.find(o => o.path.includes('main.') && o.path.endsWith('.js') && !o.path.includes('chunks/'));
  const mainCssFiles = buildResult.outputs.filter(o => o.path.endsWith('.css'));

  let updatedHtml = indexHtmlContent;

  // Reemplazar referencia a main.jsx con el archivo compilado
  if (mainJsFile) {
    const mainJsFileName = mainJsFile.path.split(/[\\/]/).pop();
    updatedHtml = updatedHtml.replace(
      '<script type="module" src="./src/main.jsx"></script>',
      `<script type="module" src="./${mainJsFileName}"></script>`
    );
  }

  // Agregar referencias a archivos CSS si existen
  if (mainCssFiles.length > 0) {
    const cssLinks = mainCssFiles.map(cssFile => {
      const cssFileName = cssFile.path.split(/[\\/]/).pop();
      return `<link rel="stylesheet" href="./${cssFileName}">`;
    }).join('\n    ');
    updatedHtml = updatedHtml.replace('</head>', `    ${cssLinks}\n</head>`);
  }

  await Bun.write(join(FRONTEND_DIST, 'index.html'), updatedHtml);

  // Copiar assets estáticos si existen
  const publicDir = join(FRONTEND_SRC, 'public');
  try {
    cpSync(publicDir, join(FRONTEND_DIST, 'public'), { recursive: true });
    console.log('  ✅ Public assets copiados');
  } catch (e) {
    console.log('  ℹ️  No hay carpeta public/');
  }

  // Copiar shared/ (assets compartidos)
  const sharedDir = join(FRONTEND_SRC, 'shared');
  try {
    cpSync(sharedDir, join(FRONTEND_DIST, 'shared'), { recursive: true });
    console.log('  ✅ Shared assets copiados');
  } catch (e) {
    console.log('  ℹ️  No hay carpeta shared/');
  }

  console.log('  ✅ Frontend compilado');
  console.log(`  📊 Outputs: ${buildResult.outputs.length} archivos`);
} catch (error) {
  console.error('  ❌ Error compilando frontend:', error);
  process.exit(1);
}

// === 3. COPIAR API LAMBDAS ===
console.log('\n📦 Copiando API Lambdas...');

const API_SRC = join(ROOT, 'api');
const API_DIST = join(DIST, 'api');

try {
  mkdirSync(API_DIST, { recursive: true });

  // Copiar todos los archivos .js de la API
  const apiFiles = readdirSync(API_SRC).filter(f => f.endsWith('.js'));
  apiFiles.forEach(file => {
    cpSync(join(API_SRC, file), join(API_DIST, file));
  });

  console.log(`  ✅ ${apiFiles.length} lambdas copiadas`);
} catch (error) {
  console.error('  ❌ Error copiando lambdas:', error);
  process.exit(1);
}

// === 4. COPIAR LAYERS ===
console.log('\n📦 Copiando Lambda Layers...');

const LAYERS_SRC = join(ROOT, 'layers');
const LAYERS_DIST = join(DIST, 'layers');

try {
  cpSync(LAYERS_SRC, LAYERS_DIST, { recursive: true });
  console.log('  ✅ Layers copiados');
} catch (error) {
  console.error('  ❌ Error copiando layers:', error);
  process.exit(1);
}

// === 5. BUILD INFRA (TypeScript CDK) ===
console.log('\n📦 Compilando Infraestructura (CDK)...');

try {
  // Compilar TypeScript directamente con tsc
  const proc = Bun.spawn(['npx', 'tsc'], {
    cwd: join(ROOT, 'infra'),
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new Error(`CDK build failed with exit code ${proc.exitCode}`);
  }

  console.log('  ✅ Infraestructura compilada');
} catch (error) {
  console.error('  ❌ Error compilando infraestructura:', error);
  process.exit(1);
}

// === RESUMEN ===
console.log(`
╔═══════════════════════════════════════════════════════╗
║  ✅ Build Completado                                  ║
╠═══════════════════════════════════════════════════════╣
║  Frontend:  dist/frontend/ (Bun build)              ║
║  API:       dist/api/                                ║
║  Layers:    dist/layers/                             ║
║  Infra:     infra/cdk.out/                           ║
╠═══════════════════════════════════════════════════════╣
║  Siguiente paso: bun run deploy                      ║
╚═══════════════════════════════════════════════════════╝
`);

process.exit(0);
