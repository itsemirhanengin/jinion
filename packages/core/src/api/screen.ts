import type { Screen, View } from '../controllers/context.js';
import type { ClientContract } from './protocol.js';

type Notifications = ClientContract['notifications'];

/** The clients a server has, as its screen sees them. */
export interface Clients {
  /** To the client whose request is being answered, or to every client when it comes from nobody's. */
  send<M extends keyof Notifications>(method: M, params: Notifications[M]): void;
  broadcast<M extends keyof Notifications>(method: M, params: Notifications[M]): void;
  focused(): boolean;
  notifications(): 'desktop' | 'bell';
}

/** The app's screen when its clients draw it: what the controllers ask of it goes to them as notifications. */
export class ClientScreen implements Screen {
  constructor(private readonly clients: Clients) {}

  get notifications() {
    return this.clients.notifications();
  }

  openView(view: View) {
    this.clients.send('screen/view', { view });
  }

  focused() {
    return this.clients.focused();
  }

  notify(title: string, body: string) {
    this.clients.broadcast('screen/notify', { title, body });
  }

  toggleExpanded() {
    this.clients.send('screen/expand', {});
  }

  exit() {
    this.clients.broadcast('screen/exit', {});
  }
}
