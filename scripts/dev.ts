/**
 * Script para iniciar ambos servidores de desarrollo en paralelo
 *
 * Uso: bun run dev
 */

import { spawn } from 'bun';

console.log(`
╔═══════════════════════════════════════════════════════╗
║  🚀 Iniciando BoyHappy Dev Environment (Bun)          ║
╚═══════════════════════════════════════════════════════╝
`);

// Función para colorear output
const colorize = (color: string, text: string) => {
  const colors: Record<string, string> = {
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
  };
  return `${colors[color] || ''}${text}${colors.reset}`;
};

// Spawn API server
const apiProcess = spawn({
  cmd: ['bun', '--hot', 'scripts/dev-api.ts'],
  stdout: 'pipe',
  stderr: 'pipe',
});

// Spawn Frontend server (Bun)
const appProcess = spawn({
  cmd: ['bun', '--hot', 'scripts/dev-app.ts'],
  stdout: 'pipe',
  stderr: 'pipe',
});

// Pipe output con colores
const pipeOutput = async (process: any, prefix: string, color: string) => {
  const decoder = new TextDecoder();

  for await (const chunk of process.stdout) {
    const text = decoder.decode(chunk);
    console.log(`${colorize(color, prefix)} ${text.trim()}`);
  }

  for await (const chunk of process.stderr) {
    const text = decoder.decode(chunk);
    console.error(`${colorize(color, prefix)} ${text.trim()}`);
  }
};

// Pipe outputs en paralelo
Promise.all([
  pipeOutput(apiProcess, '[API]', 'blue'),
  pipeOutput(appProcess, '[APP]', 'green'),
]);

// Graceful shutdown
const cleanup = () => {
  console.log('\n👋 Cerrando servidores...');
  apiProcess.kill();
  appProcess.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Esperar a que terminen (nunca debería pasar en desarrollo)
await Promise.all([apiProcess.exited, appProcess.exited]);
