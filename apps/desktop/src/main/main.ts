import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Menu, shell } from 'electron';

const devServer = process.env.VITE_DEV_SERVER_URL;

app.whenReady().then(() => {
  Menu.setApplicationMenu(menu());
  openWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function openWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 20 },
    backgroundColor: '#ffffff',
    webPreferences: { sandbox: true, contextIsolation: true },
  });

  window.once('ready-to-show', () => window.show());

  // A link in a conversation opens in the browser; the app's window only ever shows the app.
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
