/// <reference lib="dom" />
// CommonJS, since a sandboxed page's preload can't be a module.
import electron = require('electron');
import type { CorePortMessage, DesktopBridge, PreviewPick, PreviewState } from './bridge.js';

const { contextBridge, ipcRenderer } = electron;

const desktop: DesktopBridge = {
  preview: {
    show: (id, bounds) => ipcRenderer.send('preview:show', id, bounds),
    hide: (id) => ipcRenderer.send('preview:hide', id),
    load: (id, url) => ipcRenderer.send('preview:load', id, url),
    go: (id, where) => ipcRenderer.send('preview:go', id, where),
    point: (id, on) => ipcRenderer.send('preview:point', id, on),
    capture: (id) => ipcRenderer.invoke('preview:capture', id),
    close: (id) => ipcRenderer.send('preview:close', id),
    onState: (listener) => ipcRenderer.on('preview:state', (_event, id: string, state: PreviewState) => listener(id, state)),
    onPick: (listener) => ipcRenderer.on('preview:pick', (_event, id: string, pick: PreviewPick) => listener(id, pick)),
  },
  version: () => ipcRenderer.invoke('app:version'),
  recentProjects: () => ipcRenderer.invoke('projects:recent'),
  pickFolder: () => ipcRenderer.invoke('projects:pick'),
  openProject: (path) => ipcRenderer.invoke('projects:open', path),
  forgetProject: (path) => ipcRenderer.invoke('projects:forget', path),
  projectSessions: (path) => ipcRenderer.invoke('projects:sessions', path),
  onCoreExit: (listener) => ipcRenderer.on('core-exit', (_event, { path }: { path: string }) => listener(path)),
  updateReady: () => ipcRenderer.invoke('updates:ready'),
  onUpdateReady: (listener) => ipcRenderer.on('updates:ready', (_event, version: string) => listener(version)),
  installUpdate: () => ipcRenderer.send('updates:install'),
};

contextBridge.exposeInMainWorld('desktop', desktop);

// A port can't cross the context bridge, so it goes to the page as a message on its own window.
ipcRenderer.on('core-port', (event, { path }: { path: string }) => {
  const message: CorePortMessage = { type: 'jinion-core-port', path };

  window.postMessage(message, '*', event.ports);
});
