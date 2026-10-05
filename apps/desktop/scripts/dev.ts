import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

// The `electron` package's main export is the path to its binary, and throws when the binary was never downloaded.
let electron: string;

try {
  electron = createRequire(import.meta.url)('electron') as string;
} catch {
  console.error("Electron's binary is missing. Run `node node_modules/electron/install.js` in apps/desktop once.");
  process.exit(1);
}

const compiled = spawnSync('tsc', ['-p', 'tsconfig.main.json'], { stdio: 'inherit' });
if (compiled.status !== 0) process.exit(compiled.status ?? 1);

const server = await createServer({ configFile: 'vite.config.ts' });

await server.listen();

const url = server.resolvedUrls?.local[0];
const app = spawn(electron, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } });

app.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
