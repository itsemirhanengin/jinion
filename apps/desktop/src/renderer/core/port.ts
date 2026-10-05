import type { CorePortMessage, DesktopBridge } from '../../main/bridge.js';

declare global {
  interface Window {
    desktop: DesktopBridge;
  }
}

const waiting = new Map<string, (port: MessagePort) => void>();

// The preload posts each port to the page's own window, with the folder whose core it reaches.
addEventListener('message', (event: MessageEvent<CorePortMessage>) => {
  const [port] = event.ports;
  if (event.source !== window || event.data?.type !== 'jinion-core-port' || !port) return;

  waiting.get(event.data.path)?.(port);
  waiting.delete(event.data.path);
});

/** The next port to the folder's core; ask for it before opening the project, so it isn't missed. */
export function waitForPort(path: string) {
  return new Promise<MessagePort>((resolve) => waiting.set(path, resolve));
}
