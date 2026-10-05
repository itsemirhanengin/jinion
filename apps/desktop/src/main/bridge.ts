/** What the preload hands the page as `window.desktop`: the little the main process does for it. */
export interface DesktopBridge {
  version(): Promise<string>;
  recentProjects(): Promise<RecentProject[]>;
  /** The system's folder picker; `undefined` when the user cancels. */
  pickFolder(): Promise<string | undefined>;
  /** Starts the folder's core when it isn't running, and sends a port to it as a `jinion-core-port` message. */
  openProject(path: string): Promise<RecentProject>;
  forgetProject(path: string): Promise<void>;
  /** Called with the folder whose core stopped, so the page can say so. */
  onCoreExit(listener: (path: string) => void): void;
}

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
