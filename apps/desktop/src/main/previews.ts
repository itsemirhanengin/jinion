import { fileURLToPath } from 'node:url';
import { BrowserWindow, ipcMain, type Rectangle, shell, type WebContents, WebContentsView } from 'electron';
import type { Bounds, PreviewImage, PreviewPick, PreviewState } from './bridge.js';

interface Preview {
  view: WebContentsView;
  window: BrowserWindow;
  /** The app's page the preview belongs to, which gets its state and picks. */
  owner: WebContents;
  pointing: boolean;
  error?: string;
}

/** Claude takes images up to 5 MB once encoded; a larger capture goes as a JPEG. */
const MAX_BYTES = 3_750_000;

/** Kept in the preview while it has the keys, as editing and going back do in a browser. */
const PAGE_KEYS = new Set(['c', 'v', 'x', 'a', 'z', 'y', 'f', '[', ']']);

const previews = new Map<string, Preview>();

/** Addresses asked for before their preview opened. */
const waiting = new Map<string, string>();

/** The page's previews: each a view of its own over the window, sandboxed in a session of their own. */
export function answerPreviews() {
  ipcMain.on('preview:show', (event, id: string, bounds: Bounds) => {
    const preview = previews.get(id) ?? open(id, event.sender);
    if (!preview) return;

    preview.view.setBounds(scaled(bounds, event.sender.getZoomFactor()));
    preview.view.setVisible(true);
  });

  ipcMain.on('preview:hide', (_event, id: string) => previews.get(id)?.view.setVisible(false));

  // The page may ask before its box shows, which is what opens the view.
  ipcMain.on('preview:load', (_event, id: string, url: string) => {
    if (!/^https?:\/\//.test(url)) return;

    const preview = previews.get(id);

    if (preview) load(preview, url);
    else waiting.set(id, url);
  });

  ipcMain.on('preview:go', (_event, id: string, where: 'back' | 'forward' | 'reload') => {
    const contents = previews.get(id)?.view.webContents;
    if (!contents) return;

    if (where === 'back') contents.navigationHistory.goBack();
    else if (where === 'forward') contents.navigationHistory.goForward();
    else contents.reload();
  });

  ipcMain.on('preview:point', (_event, id: string, on: boolean) => {
    const preview = previews.get(id);
    if (!preview) return;

    preview.pointing = on;
    preview.view.webContents.send('jinion:point', on);
    if (on) preview.view.webContents.focus();
    sendState(preview, id);
  });

  ipcMain.handle('preview:capture', async (_event, id: string) => {
    const preview = previews.get(id);

    return preview ? (await preview.view.webContents.capturePage()).toDataURL() : '';
  });

  ipcMain.on('preview:close', (_event, id: string) => close(id));

  // Answered once the capture is taken, so the page's outline comes back only after it.
  ipcMain.handle('jinion:picked', (event, pick: PreviewPick) => picked(event.sender, pick));

  ipcMain.on('jinion:pointing', (event, on: boolean) => {
    const found = previewOf(event.sender);
    if (!found) return;

    found.preview.pointing = on;
    sendState(found.preview, found.id);
  });
}

function open(id: string, owner: WebContents) {
  const window = BrowserWindow.fromWebContents(owner);
  if (!window) return;

  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      partition: 'persist:preview',
      preload: fileURLToPath(new URL('./preview-preload.cjs', import.meta.url)),
    },
  });

  const preview: Preview = { view, window, owner, pointing: false };
  const { webContents: contents } = view;
  const update = () => sendState(preview, id);

  previews.set(id, preview);
  window.contentView.addChildView(view);
  view.setBackgroundColor('#ffffff');

  contents.on('did-start-loading', () => {
    preview.error = undefined;
    update();
  });

  // A frame of the page failing, as an ad's, isn't the page failing.
  contents.on('did-fail-load', (_event, code, description, _url, mainFrame) => {
    if (!mainFrame || code === -3) return;

    preview.error = description;
    update();
  });

  contents.on('did-stop-loading', update);
  contents.on('did-navigate-in-page', update);
  contents.on('page-title-updated', update);

  // A new page loads without the point script's listeners, so pointing ends with the old one.
  contents.on('did-navigate', () => {
    preview.pointing = false;
    update();
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);

    return { action: 'deny' };
  });

  // The app's shortcuts work while the preview has the keys, but for the ones a page needs itself.
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.meta || input.control)) return;

    const key = input.key.toLowerCase();

    if (key === 'r' && !input.shift) {
      event.preventDefault();
      contents.reload();
    } else if (!PAGE_KEYS.has(key)) {
      event.preventDefault();
      owner.focus();
      owner.sendInputEvent({ type: 'keyDown', keyCode: input.key, modifiers: modifiersOf(input) });
    }
  });

  owner.once('destroyed', () => close(id));

  const url = waiting.get(id);

  waiting.delete(id);
  if (url) load(preview, url);

  return preview;
}

function load(preview: Preview, url: string) {
  // A failure shows through `did-fail-load`.
  void preview.view.webContents.loadURL(url).catch(() => {});
}

function close(id: string) {
  const preview = previews.get(id);

  waiting.delete(id);
  if (!preview) return;

  previews.delete(id);
  if (!preview.window.isDestroyed()) preview.window.contentView.removeChildView(preview.view);
  preview.view.webContents.close();
}

/** The pick with what it shows, captured once the outline is off the page. */
async function picked(sender: WebContents, pick: PreviewPick) {
  const found = previewOf(sender);
  if (!found) return;

  const { preview, id } = found;
  const image = await capture(preview.view, pick.bounds).catch(() => undefined);

  if (!preview.owner.isDestroyed()) preview.owner.send('preview:pick', id, { ...pick, image });
}

/** What `bounds` shows, cut to what the view shows, since an element can reach past it. */
async function capture(view: WebContentsView, bounds: Bounds): Promise<PreviewImage | undefined> {
  const { webContents: contents } = view;
  const zoom = contents.getZoomFactor();
  const { width, height } = view.getBounds();
  const x = Math.max(0, bounds.x);
  const y = Math.max(0, bounds.y);
  const rect = scaled({ x, y, width: Math.min(bounds.x + bounds.width, width / zoom) - x, height: Math.min(bounds.y + bounds.height, height / zoom) - y }, zoom);

  if (rect.width < 1 || rect.height < 1) return;

  const image = await contents.capturePage(rect);
  const png = image.toPNG();

  return png.length <= MAX_BYTES
    ? { mediaType: 'image/png', data: png.toString('base64') }
    : { mediaType: 'image/jpeg', data: image.resize({ width: Math.min(image.getSize().width, 2048) }).toJPEG(85).toString('base64') };
}

function sendState(preview: Preview, id: string) {
  const { webContents: contents } = preview.view;
  if (preview.owner.isDestroyed() || contents.isDestroyed()) return;

  const state: PreviewState = {
    url: contents.getURL(),
    title: contents.getTitle(),
    loading: contents.isLoading(),
    canGoBack: contents.navigationHistory.canGoBack(),
    canGoForward: contents.navigationHistory.canGoForward(),
    pointing: preview.pointing,
    error: preview.error,
  };

  preview.owner.send('preview:state', id, state);
}

function previewOf(contents: WebContents) {
  for (const [id, preview] of previews) if (preview.view.webContents === contents) return { id, preview };
}

const scaled = (bounds: Bounds, zoom: number): Rectangle => ({
  x: Math.round(bounds.x * zoom),
  y: Math.round(bounds.y * zoom),
  width: Math.round(bounds.width * zoom),
  height: Math.round(bounds.height * zoom),
});

function modifiersOf(input: Electron.Input) {
  const modifiers: ('meta' | 'control' | 'shift' | 'alt')[] = [];

  if (input.meta) modifiers.push('meta');
  if (input.control) modifiers.push('control');
  if (input.shift) modifiers.push('shift');
  if (input.alt) modifiers.push('alt');

  return modifiers;
}
