/// <reference lib="dom" />
// CommonJS, as a sandboxed preload must be. It runs in a world of its own beside the page's, so the page can't reach it,
// and draws in a closed shadow root, so the page's styles can't reach what it draws.
import electron = require('electron');
import type { Bounds, PickedElement, PreviewPick } from './bridge.js';

const { contextBridge, ipcRenderer } = electron;

/** How far the pointer goes with the button down before a click becomes a drag. */
const DRAG = 4;

const ACCENT = '#2563eb';

const STYLES = [
  'display',
  'position',
  'width',
  'height',
  'margin',
  'padding',
  'gap',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'color',
  'background-color',
  'border',
  'border-radius',
  'box-shadow',
];

/** What a computed style says when it says nothing worth sending. */
const NOTHING = new Set(['', 'none', 'normal', 'auto', '0px', 'rgba(0, 0, 0, 0)', '0px none rgb(0, 0, 0)']);

const BLOCKED = ['click', 'dblclick', 'mousedown', 'mouseup', 'auxclick', 'contextmenu'] as const;

let pointing = false;
let overlay: Overlay | undefined;
let hovered: Element | undefined;
let start: { x: number; y: number } | undefined;
let dragging = false;
let marks = 0;
const frameworks = new WeakMap<Element, Pick<PickedElement, 'components' | 'source'>>();

ipcRenderer.on('jinion:point', (_event, on: boolean) => (on ? begin() : end(false)));

function begin() {
  if (pointing) return;

  pointing = true;
  overlay ??= new Overlay();
  overlay.attach();
  addEventListener('pointermove', move, true);
  addEventListener('pointerdown', down, true);
  addEventListener('pointerup', up, true);
  addEventListener('keydown', key, true);
  addEventListener('scroll', scrolled, true);
  for (const name of BLOCKED) addEventListener(name, block, true);
}

/** `tell` when the page ends it, as Esc or a pick does, so the app's bar shows it. */
function end(tell: boolean) {
  if (!pointing) return;

  pointing = false;
  hovered = undefined;
  start = undefined;
  dragging = false;
  overlay?.detach();
  removeEventListener('pointermove', move, true);
  removeEventListener('pointerdown', down, true);
  removeEventListener('pointerup', up, true);
  removeEventListener('keydown', key, true);
  removeEventListener('scroll', scrolled, true);
  for (const name of BLOCKED) removeEventListener(name, block, true);
  if (tell) ipcRenderer.send('jinion:pointing', false);
}

function move(event: PointerEvent) {
  block(event);

  if (start && (dragging || Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG)) {
    dragging = true;
    overlay?.area(between(start, event));

    return;
  }

  outline(document.elementFromPoint(event.clientX, event.clientY) ?? undefined);
}

function down(event: PointerEvent) {
  if (event.button !== 0) return;

  block(event);
  start = { x: event.clientX, y: event.clientY };
  dragging = false;
}

function up(event: PointerEvent) {
  if (event.button !== 0 || !start) return;

  block(event);

  const from = start;
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const area = dragging ? between(from, event) : undefined;

  start = undefined;
  dragging = false;
  void pick(area ? areaPick(area) : element && elementPick(element), event.shiftKey);
}

function key(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;

  block(event);
  end(true);
}

function scrolled() {
  if (hovered) overlay?.outline(hovered.getBoundingClientRect(), labelOf(hovered));
}

function block(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function outline(element: Element | undefined) {
  if (!element || element === hovered) return;

  hovered = element;
  overlay?.outline(element.getBoundingClientRect(), labelOf(element));
}

/** Sent with what it shows, captured once nothing of ours is over it; with shift held, pointing goes on. */
async function pick(picked: PreviewPick | undefined | null, more: boolean) {
  overlay?.hide();
  await frames(2);

  if (picked) {
    await ipcRenderer.invoke('jinion:picked', picked);
    toast(picked.kind === 'area' ? 'Added the area to the message' : `Added ${nameOf(picked)} to the message`);
  }

  if (!more) return end(true);

  hovered = undefined;
  overlay?.show();
}

/** As its chip in the composer names it. */
const nameOf = ({ tag, components }: PickedElement) => (components[0] ? `${components[0]} ${tag}` : `<${tag}>`);

/** Says the pick went to the message, where the user looks: at the foot of the page, for a moment. */
function toast(text: string) {
  const host = document.createElement('div');
  const pill = document.createElement('div');

  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';

  pill.style.cssText =
    'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);padding:4px 10px;border-radius:999px;background:#181e33;color:#fff;font:12px/16px -apple-system,system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 2px rgb(0 0 0 / 0.2);transition:opacity 200ms;';

  pill.textContent = text;
  host.attachShadow({ mode: 'closed' }).append(pill);
  document.documentElement.append(host);

  setTimeout(() => {
    pill.style.opacity = '0';
    setTimeout(() => host.remove(), 200);
  }, 1600);
}

function elementPick(element: Element): PreviewPick {
  return { kind: 'element', url: location.href, viewport: viewport(), ...describe(element) };
}

function areaPick(area: Bounds): PreviewPick {
  const inside = [...document.body.querySelectorAll('*')].filter((element) => within(element.getBoundingClientRect(), area));
  const all = new Set(inside);
  const outermost = inside.filter((element) => !element.parentElement || !all.has(element.parentElement));
  const middle = document.elementFromPoint(area.x + area.width / 2, area.y + area.height / 2);
  const shown = outermost.length > 0 ? outermost : middle ? [middle] : [];

  return {
    kind: 'area',
    url: location.href,
    viewport: viewport(),
    bounds: area,
    elements: shown.slice(0, 8).map((element) => {
      const { tag, components, source, selector, text } = describe(element);

      return { tag, components, source, selector, text: clip(text, 120) };
    }),
  };
}

function describe(element: Element): PickedElement {
  const { x, y, width, height } = element.getBoundingClientRect();
  const computed = getComputedStyle(element);
  const styles = Object.fromEntries(STYLES.map((name) => [name, computed.getPropertyValue(name)]).filter(([, value]) => !NOTHING.has(value!)));

  return {
    tag: element.tagName.toLowerCase(),
    ...frameworkOf(element),
    selector: selectorOf(element),
    text: clip(((element as HTMLElement).innerText ?? element.textContent ?? '').replace(/\s+/g, ' ').trim(), 300),
    html: clip(element.outerHTML, 800),
    styles,
    bounds: { x, y, width, height },
  };
}

function labelOf(element: Element) {
  const [component] = frameworkOf(element).components;

  return { tag: element.tagName.toLowerCase(), component };
}

/**
 * The components the element is in, read in the page's own world, where React and Vue keep them on the DOM: the element
 * is marked for the moment it takes, since an element can't cross between worlds.
 */
function frameworkOf(element: Element) {
  const known = frameworks.get(element);
  if (known) return known;

  const marker = String(++marks);
  let found: Pick<PickedElement, 'components' | 'source'> = { components: [] };

  try {
    element.setAttribute('data-jinion-pick', marker);
    found = contextBridge.executeInMainWorld({ func: componentsInPage, args: [marker] }) ?? found;
  } catch {
    // Without the bridge's call, or on a page that throws reading its own nodes, the element goes without them.
  } finally {
    element.removeAttribute('data-jinion-pick');
  }

  frameworks.set(element, found);

  return found;
}

/** Runs in the page's world, serialized, so it holds all it needs. */
function componentsInPage(marker: string) {
  // biome-ignore lint/suspicious/noExplicitAny: React's and Vue's own fields on a DOM node, which no type describes.
  const element = document.querySelector(`[data-jinion-pick="${marker}"]`) as any;
  const components: string[] = [];
  let source: string | undefined;

  if (!element) return { components };

  const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$'));
  let fiber = fiberKey ? element[fiberKey] : undefined;

  while (fiber && components.length < 5) {
    const type = fiber.type;

    const name =
      typeof type === 'function'
        ? type.displayName || type.name
        : type && typeof type === 'object'
          ? type.displayName || type.render?.displayName || type.render?.name || type.type?.displayName || type.type?.name
          : undefined;

    if (name && !components.includes(name)) components.push(name);
    if (name && !source && fiber._debugSource) source = `${fiber._debugSource.fileName}:${fiber._debugSource.lineNumber}`;
    fiber = fiber.return;
  }

  let vue = element.__vueParentComponent;

  while (vue && components.length < 5) {
    const name = vue.type?.__name || vue.type?.name;

    if (name && !components.includes(name)) components.push(name);
    if (!source && vue.type?.__file) source = vue.type.__file;
    vue = vue.parent;
  }

  return source ? { components, source } : { components };
}

/** A few steps up, enough to tell the element apart, stopping at an id. */
function selectorOf(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && parts.length < 5) {
    const tag = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`${tag}#${CSS.escape(current.id)}`);
      break;
    }

    const classes = [...current.classList].filter((name) => !/\d{3,}|[_-][a-z0-9]{5,}$/i.test(name)).slice(0, 2);
    const same = current.parentElement ? [...current.parentElement.children].filter((child) => child.tagName === current!.tagName) : [];
    const nth = same.length > 1 ? `:nth-of-type(${same.indexOf(current) + 1})` : '';

    parts.unshift(`${tag}${classes.map((name) => `.${CSS.escape(name)}`).join('')}${nth}`);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

const viewport = () => ({ width: innerWidth, height: innerHeight });

const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length)}…` : text);

const within = (rect: DOMRect, area: Bounds) =>
  rect.width > 0 && rect.height > 0 && rect.left >= area.x - 1 && rect.top >= area.y - 1 && rect.right <= area.x + area.width + 1 && rect.bottom <= area.y + area.height + 1;

const between = (from: { x: number; y: number }, to: { clientX: number; clientY: number }): Bounds => ({
  x: Math.min(from.x, to.clientX),
  y: Math.min(from.y, to.clientY),
  width: Math.abs(to.clientX - from.x),
  height: Math.abs(to.clientY - from.y),
});

// A page whose window is hidden draws no frames, so the wait has an end of its own.
const frames = async (count: number) => {
  for (let index = 0; index < count; index++) await Promise.race([new Promise((resolve) => requestAnimationFrame(resolve)), new Promise((resolve) => setTimeout(resolve, 50))]);
};

/** What pointing draws over the page: the outline and its label, or the area being drawn and its size. */
class Overlay {
  private readonly host = document.createElement('div');
  private readonly box = document.createElement('div');
  private readonly label = document.createElement('div');
  private readonly areaBox = document.createElement('div');
  private readonly size = document.createElement('div');
  private readonly cursor = document.createElement('style');

  constructor() {
    const root = this.host.attachShadow({ mode: 'closed' });

    this.host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    this.box.style.cssText = `position:fixed;display:none;box-sizing:border-box;border:2px solid ${ACCENT};background:rgb(37 99 235 / 0.08);border-radius:2px;`;

    this.label.style.cssText =
      'position:fixed;display:none;padding:2px 6px;border-radius:6px;background:#181e33;color:#fff;font:12px/16px -apple-system,system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 2px rgb(0 0 0 / 0.2);';

    this.areaBox.style.cssText = `position:fixed;display:none;box-sizing:border-box;border:1px dashed ${ACCENT};background:rgb(37 99 235 / 0.06);`;
    this.size.style.cssText = `position:fixed;display:none;color:${ACCENT};font:11px/14px ui-monospace,Menlo,monospace;`;
    this.cursor.textContent = '* { cursor: crosshair !important; }';
    root.append(this.box, this.label, this.areaBox, this.size);
  }

  attach() {
    document.documentElement.append(this.host);
    document.head?.append(this.cursor);
    this.show();
  }

  detach() {
    this.host.remove();
    this.cursor.remove();
    this.clear();
  }

  hide() {
    this.host.style.visibility = 'hidden';
  }

  show() {
    this.clear();
    this.host.style.visibility = 'visible';
  }

  outline(rect: DOMRect, { tag, component }: { tag: string; component?: string }) {
    this.areaBox.style.display = 'none';
    this.size.style.display = 'none';
    place(this.box, rect);
    this.label.replaceChildren(text(tag, 'font-weight:600'), ...(component ? [text(` ${component}`, 'opacity:0.6')] : []));
    this.label.style.display = 'block';
    this.label.style.left = `${Math.max(4, Math.min(rect.left, innerWidth - this.label.offsetWidth - 4))}px`;
    this.label.style.top = `${rect.top > 26 ? rect.top - 24 : rect.bottom + 4}px`;
  }

  area(area: Bounds) {
    this.box.style.display = 'none';
    this.label.style.display = 'none';
    place(this.areaBox, area);
    this.size.textContent = `${Math.round(area.width)} × ${Math.round(area.height)}`;
    this.size.style.display = 'block';
    this.size.style.left = `${area.x + area.width}px`;
    this.size.style.top = `${area.y + area.height + 4}px`;
    this.size.style.transform = 'translateX(-100%)';
  }

  private clear() {
    for (const element of [this.box, this.label, this.areaBox, this.size]) element.style.display = 'none';
  }
}

function place(element: HTMLElement, { x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  Object.assign(element.style, { display: 'block', left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
}

function text(content: string, style: string) {
  const span = document.createElement('span');

  span.textContent = content;
  span.style.cssText = style;

  return span;
}
