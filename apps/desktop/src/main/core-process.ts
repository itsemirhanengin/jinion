import { portTransport } from '@jinion/core/api/port-transport';
import { coreOptions, startCore } from '@jinion/core/host';
import type { MessagePortMain } from 'electron';

// A utility process of its own per folder, so a busy core never stalls the window or another project's core.
const { cwd, version, demo } = JSON.parse(process.env.JINION_CORE ?? '{}') as { cwd: string; version: string; demo: boolean };
const { options } = coreOptions({ cwd, version, demo });
const core = startCore(options);

core.server.app.start();
// The composer's model menu is always in sight, so every backend's models are read up front, not on `/model` as in the CLI.
core.server.app.loadAll();

process.parentPort.on('message', async ({ data, ports }) => {
  if (data?.type === 'connect' && ports[0]) core.server.connect(portTransport(wrap(ports[0])));

  if (data?.type === 'quit') {
    await core.server.app.quit();
    process.exit(0);
  }
});

function wrap(port: MessagePortMain) {
  port.start();

  return {
    post: (text: string) => port.postMessage(text),
    onMessage: (listener: (text: string) => void) => port.on('message', ({ data }) => listener(data as string)),
    onClose: (listener: () => void) => port.on('close', listener),
    close: () => port.close(),
  };
}
