import { fileURLToPath } from 'node:url';
import { savedSessions } from '@jinion/core/api/saved';
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron';
import { connectCore, demo, stopCores } from './cores.js';
import { answerPreviews } from './previews.js';
import { forgetProject, recentProjects, rememberProject } from './projects.js';
import { shellPath } from './shell-path.js';
import { watchUpdates } from './updates.js';

const devServer = process.env.VITE_DEV_SERVER_URL;
let quitting = false;

// Read before any core starts, since each takes the environment it is forked with.
if (app.isPackaged) process.env.PATH = shellPath() ?? process.env.PATH;

app.whenReady().then(() => {
  // A packaged app has its icon in its bundle; run from the sources it would show Electron's.
  if (!app.isPackaged) app.dock?.setIcon(fileURLToPath(new URL('../../resources/icon.png', import.meta.url)));

  Menu.setApplicationMenu(menu());
  answer();
  answerPreviews();
  watchUpdates();
  openWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// The cores get to save their sessions before the app goes.
app.on('before-quit', (event) => {
  if (quitting) return;

  quitting = true;
  event.preventDefault();
  void stopCores().then(() => app.quit());
});

function answer() {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('projects:recent', () => recentProjects());
  ipcMain.handle('projects:forget', (_event, path: string) => forgetProject(path));
  ipcMain.handle('projects:sessions', (_event, path: string) => savedSessions(path, demo));

  ipcMain.handle('projects:pick', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { title: 'Open a project', buttonLabel: 'Open', properties: ['openDirectory', 'createDirectory'] as const };
    const picked = window ? await dialog.showOpenDialog(window, { ...options, properties: [...options.properties] }) : undefined;

    return picked?.canceled === false ? picked.filePaths[0] : undefined;
  });

  ipcMain.handle('projects:open', (event, path: string) => {
    const project = rememberProject(path);

    connectCore(path, event.sender);

    return project;
  });
}

function openWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    // The chrome's color in the system's appearance, Navy's being the default accent, so the window shows no other while the page loads.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#16181f' : '#eceef3',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
    },
  });

  window.once('ready-to-show', () => window.show());

  // A link in a conversation, or the page a sign-in opens, goes to the browser; the app's window only shows the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);

    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin === new URL(window.webContents.getURL()).origin) return;

    event.preventDefault();
    openOutside(url);
  });

  if (devServer) void window.loadURL(devServer);
  else void window.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
}

// The window's own shortcuts (⌘N, ⌘W, ⌘B, ⌘L, ⌘1-9) reach the page only when no menu item takes them first, so
// closing the window moves to ⇧⌘W, as in editors whose ⌘W closes a tab.
function menu() {
  return Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'close', accelerator: 'Shift+CmdOrCtrl+W' }],
    },
  ]);
}

function openOutside(url: string) {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url);
}
