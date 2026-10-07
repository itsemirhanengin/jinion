import { classNames, Spinner } from '@jinion/ui';
import { type Feature, useLayout } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { ArrowLeft, ArrowRight, ExternalLink, Globe, RotateCw, SquareMousePointer } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Core } from '../../core/core.js';
import { previewStatesAtom, previewUrlsAtom } from '../../state/previews.js';
import { useCore } from '../../state/session.js';
import { Empty } from './empty.js';
import { bridgeKey, closePreview, loadOnce, loadPreview, PREVIEW, shownPreview, togglePoint } from './previews.js';

/** The project's page from its dev server, beside the thread, where pointing at it hands what is picked to the composer. */
export function preview(core: Core): Feature {
  return {
    id: 'preview',
    tabs: [{ kind: PREVIEW, Title: PreviewTitle, Mark: PreviewMark, Content: PreviewTab, onClose: (id) => closePreview(core, id) }],
    commands: [
      {
        id: 'preview.point',
        title: 'Point at the page',
        keys: 'mod+shift+c',
        when: (workbench) => shownPreview(workbench) !== undefined,
        run: (workbench) => togglePoint(core, shownPreview(workbench)!),
      },
    ],
  };
}

function PreviewTitle({ id }: { id: string }) {
  const url = useAtomValue(previewUrlsAtom)[id];
  const state = useAtomValue(previewStatesAtom)[id];

  return state?.title || (url ? hostOf(url) : 'Preview');
}

function PreviewMark({ id }: { id: string }) {
  const loading = useAtomValue(previewStatesAtom)[id]?.loading;

  return loading ? <Spinner className="shrink-0 text-primary" /> : <Globe className="size-4 shrink-0 text-faint" />;
}

function PreviewTab({ id }: { id: string }) {
  const core = useCore();
  const url = useAtomValue(previewUrlsAtom)[id];
  const state = useAtomValue(previewStatesAtom)[id];

  return (
    <div className="flex h-full flex-col">
      <Bar id={id} />
      {url && !state?.error ? (
        <Page id={id} url={url} pointing={state?.pointing ?? false} />
      ) : (
        <Empty problem={state?.error && url && `${hostOf(state.url || url)} didn't answer: ${state.error}.`} onOpen={(address) => loadPreview(core, id, address)} />
      )}
    </div>
  );
}

/** Going back and forth, the address, pointing at the page, and the page in the browser. */
function Bar({ id }: { id: string }) {
  const core = useCore();
  const url = useAtomValue(previewUrlsAtom)[id];
  const state = useAtomValue(previewStatesAtom)[id];

  const key = bridgeKey(core, id);
  const shown = state?.url || url || '';

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-3">
      <Icon label="Back" disabled={!state?.canGoBack} onClick={() => window.desktop.preview.go(key, 'back')}>
        <ArrowLeft />
      </Icon>
      <Icon label="Forward" disabled={!state?.canGoForward} onClick={() => window.desktop.preview.go(key, 'forward')}>
        <ArrowRight />
      </Icon>
      <Icon label="Reload" disabled={!url} onClick={() => (state?.error ? loadPreview(core, id, url!) : window.desktop.preview.go(key, 'reload'))}>
        <RotateCw />
      </Icon>
      <form
        className="mx-1 flex min-w-0 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          loadPreview(core, id, new FormData(event.currentTarget).get('address') as string);
        }}
      >
        <input
          key={shown}
          name="address"
          aria-label="Address"
          defaultValue={shown}
          placeholder="Type an address"
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
          className="h-7 min-w-0 flex-1 rounded-lg bg-shade px-2.5 outline-none placeholder:text-faint focus:ring-1 focus:ring-edge"
        />
      </form>
      <Icon label="Point at the page: click an element, or drag over an area (⇧⌘C)" on={state?.pointing} disabled={!url || Boolean(state?.error)} onClick={() => togglePoint(core, id)}>
        <SquareMousePointer />
      </Icon>
      <Icon label="Open in the browser" disabled={!shown} onClick={() => window.open(shown)}>
        <ExternalLink />
      </Icon>
    </div>
  );
}

/**
 * Where the main process draws the page, over the window: it follows this box, hides while the tab doesn't show, and
 * gives way to a still of itself while something of the window, such as a menu, covers it.
 */
function Page({ id, url, pointing }: { id: string; url: string; pointing: boolean }) {
  const core = useCore();
  const box = useRef<HTMLDivElement>(null);
  const covered = useCovered(box);

  // What moves the box without resizing it, which the observer doesn't see.
  const arrangement = useLayout((layout) => [layout.groups.length, layout.activity, layout.sidebarWidth, layout.share, layout.right.open, layout.right.size].join());

  const [still, setStill] = useState<string>();

  const key = bridgeKey(core, id);

  useEffect(() => {
    const element = box.current;
    if (!element || still) return;

    const place = () => {
      const { x, y, width, height } = element.getBoundingClientRect();

      if (width < 1 || height < 1) window.desktop.preview.hide(key);
      else window.desktop.preview.show(key, { x, y, width, height });
    };

    const observer = new ResizeObserver(place);

    observer.observe(element);
    addEventListener('resize', place);
    place();
    loadOnce(core, id, url);

    return () => {
      observer.disconnect();
      removeEventListener('resize', place);
      window.desktop.preview.hide(key);
    };
  }, [key, still, arrangement]);

  useEffect(() => {
    if (!covered) return setStill(undefined);

    let current = true;

    void window.desktop.preview.capture(key).then((image) => current && setStill(image || undefined));

    return () => {
      current = false;
    };
  }, [covered, key]);

  return (
    <div ref={box} className={classNames('relative min-h-0 flex-1 bg-white', pointing && 'ring-2 ring-accent ring-inset')}>
      {still && <img src={still} alt="" className="absolute inset-0 size-full object-cover object-left-top" />}
    </div>
  );
}

/**
 * Whether something the window draws over itself, as a menu or a dialog in a portal of its own, lies over the box: the
 * page is a view of its own over the window, which nothing of the window can draw over.
 */
function useCovered(box: React.RefObject<HTMLDivElement | null>) {
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const check = () => {
      const area = box.current?.getBoundingClientRect();
      const root = document.getElementById('root');

      setCovered(Boolean(area) && [...document.body.children].some((child) => child !== root && child.tagName !== 'SCRIPT' && overlaps(child, area!)));
    };

    // A popup is put in its portal a moment after the portal itself.
    const observer = new MutationObserver(() => {
      requestAnimationFrame(check);
      setTimeout(check, 50);
    });

    observer.observe(document.body, { childList: true });
    check();

    return () => observer.disconnect();
  }, []);

  return covered;
}

function overlaps(element: Element, area: DOMRect) {
  return [element, ...element.querySelectorAll('*')].slice(0, 200).some((each) => {
    const rect = each.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0 && rect.left < area.right && rect.right > area.left && rect.top < area.bottom && rect.bottom > area.top;
  });
}

function Icon({ label, on, disabled, onClick, children }: { label: string; on?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        'flex size-7 shrink-0 cursor-default items-center justify-center rounded-lg [&_svg]:size-4 [&_svg]:shrink-0',
        on ? 'bg-(--tint-blue) text-(--tint-blue-ink)' : 'text-muted enabled:hover:bg-shade enabled:hover:text-ink disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

