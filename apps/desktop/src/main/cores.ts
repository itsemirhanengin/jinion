import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, MessageChannelMain, type UtilityProcess, utilityProcess, type WebContents } from 'electron';

const cores = new Map<string, UtilityProcess>();

/** `--demo` plays the core's scripted backend instead of Claude and Codex, as `jinion --demo` does. */
const demo = process.argv.includes('--demo');

/** Starts the folder's core when it isn't running, and hands the page a port to it; one core serves a folder. */
export function connectCore(path: string, contents: WebContents) {
  const core = cores.get(path) ?? start(path, contents);
  const { port1, port2 } = new MessageChannelMain();

  core.postMessage({ type: 'connect' }, [port1]);
  contents.postMessage('core-port', { path }, [port2]);
}

/** Lets each core save its sessions and stop, giving up on one that takes longer than a few seconds. */
export async function stopCores() {
  await Promise.all(
    [...cores.values()].map(
      (core) =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            core.kill();
            resolve();
          }, 3000);

          core.once('exit', () => {
            clearTimeout(timer);
            resolve();
          });

          core.postMessage({ type: 'quit' });
        }),
    ),
  );
}

function start(path: string, contents: WebContents) {
  const core = utilityProcess.fork(fileURLToPath(new URL('./core-process.js', import.meta.url)), [], {
    serviceName: `Jinion core: ${basename(path)}`,
    cwd: path,
    stdio: 'inherit',
    env: { ...process.env, JINION_CORE: JSON.stringify({ cwd: path, version: app.getVersion(), demo }) },
  });

  core.once('exit', () => {
    cores.delete(path);
    if (!contents.isDestroyed()) contents.send('core-exit', { path });
  });

  cores.set(path, core);

  return core;
}
