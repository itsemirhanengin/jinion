import { app, BrowserWindow, ipcMain } from 'electron';
// CommonJS, whose exports Node can't name for an ES module.
import updater from 'electron-updater';

/** How often a running app looks for a newer version, after the look it takes as it starts. */
const EVERY = 4 * 60 * 60 * 1000;

/** The version downloaded and waiting for a restart. */
let ready: string | undefined;

/**
 * A packaged app looks for a newer version as it starts and every few hours after, downloads one on its own and tells
 * the windows once it is ready; the page's Update button restarts into it, and quitting installs it as well.
 */
export function watchUpdates() {
  ipcMain.handle('updates:ready', () => ready);
  if (!app.isPackaged) return;

  const { autoUpdater } = updater;

  ipcMain.on('updates:install', () => autoUpdater.quitAndInstall());

  autoUpdater.on('update-downloaded', ({ version }) => {
    ready = version;

    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('updates:ready', version);
  });

  // Offline, or the feed out of reach: the next look tries again.
  autoUpdater.on('error', () => {});

  const look = () => void autoUpdater.checkForUpdates().catch(() => {});

  look();
  setInterval(look, EVERY);
}
