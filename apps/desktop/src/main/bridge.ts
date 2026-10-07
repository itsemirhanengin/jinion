import type { SavedSummary } from '@jinion/core/api/schemas';

/** What the preload hands the page as `window.desktop`: the little the main process does for it. */
export interface DesktopBridge {
  version(): Promise<string>;
  recentProjects(): Promise<RecentProject[]>;
  /** The system's folder picker; `undefined` when the user cancels. */
  pickFolder(): Promise<string | undefined>;
  /** Starts the folder's core when it isn't running, and sends a port to it as a `jinion-core-port` message. */
  openProject(path: string): Promise<RecentProject>;
  forgetProject(path: string): Promise<void>;
  /** The folder's saved threads, read without starting its core. */
  projectSessions(path: string): Promise<SavedSummary[]>;
  /** Called with the folder whose core stopped, so the page can say so. */
  onCoreExit(listener: (path: string) => void): void;
  preview: PreviewBridge;
}

/**
 * A page of the project's dev server, drawn by the main process over the window where the page puts it; `id` is the
 * preview's, kept by the page.
 */
export interface PreviewBridge {
  /** Opens the preview when it isn't open, and puts it at `bounds`, in the page's pixels. */
  show(id: string, bounds: Bounds): void;
  hide(id: string): void;
  load(id: string, url: string): void;
  go(id: string, where: 'back' | 'forward' | 'reload'): void;
  /** While on, a click on the page picks an element and a drag an area, instead of reaching the page. */
  point(id: string, on: boolean): void;
  /** The page as it shows now, as a PNG data URL, drawn in its place while something of the window covers it. */
  capture(id: string): Promise<string>;
  close(id: string): void;
  onState(listener: (id: string, state: PreviewState) => void): void;
  onPick(listener: (id: string, pick: PreviewPick) => void): void;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreviewState {
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  pointing: boolean;
  /** Why the last page didn't load, as Chromium says it. */
  error?: string;
}

export interface PreviewImage {
  mediaType: 'image/png' | 'image/jpeg';
  data: string;
}

/** An element of the page, as the agent gets it to find it in the code. */
export interface PickedElement {
  tag: string;
  /** The components it is in, the nearest first, when the page is React or Vue in development. */
  components: string[];
  /** Where the nearest component is written, when the framework says. */
  source?: string;
  selector: string;
  text: string;
  html: string;
  /** The few computed styles that say how it looks and sits. */
  styles: Record<string, string>;
  bounds: Bounds;
}

export type PreviewPick =
  | ({ kind: 'element'; url: string; viewport: { width: number; height: number }; image?: PreviewImage } & PickedElement)
  | {
      kind: 'area';
      url: string;
      viewport: { width: number; height: number };
      bounds: Bounds;
      image?: PreviewImage;
      /** The outermost elements inside the area. */
      elements: Pick<PickedElement, 'tag' | 'components' | 'source' | 'selector' | 'text'>[];
    };

export interface RecentProject {
  path: string;
  name: string;
  openedAt: number;
  branch?: string;
}

/** What the preload posts to the page with the port, since a port can't cross the context bridge. */
export interface CorePortMessage {
  type: 'jinion-core-port';
  path: string;
}
