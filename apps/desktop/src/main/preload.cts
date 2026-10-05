/// <reference lib="dom" />
// CommonJS, since a sandboxed page's preload can't be a module.
import electron = require('electron');
import type { CorePortMessage, DesktopBridge } from './bridge.js';

const { contextBridge, ipcRenderer } = electron;

const desktop: DesktopBridge = {
  version: () => ipcRenderer.invoke('app:version'),
  recentProjects: () => ipcRenderer.invoke('projects:recent'),
  pickFolder: () => ipcRenderer.invoke('projects:pick'),
  openProject: (path) => ipcRenderer.invoke('projects:open', path),
  forgetProject: (path) => ipcRenderer.invoke('projects:forget', path),
  projectSessions: (path) => ipcRenderer.invoke('projects:sessions', path),
  onCoreExit: (listener) => ipcRenderer.on('core-exit', (_event, { path }: { path: string }) => listener(path)),
};

contextBridge.exposeInMainWorld('desktop', desktop);

// A port can't cross the context bridge, so it goes to the page as a message on its own window.
ipcRenderer.on('core-port', (event, { path }: { path: string }) => {
  const message: CorePortMessage = { type: 'jinion-core-port', path };

  window.postMessage(message, '*', event.ports);
});
