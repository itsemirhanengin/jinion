import { Jinion, type JinionOptions } from '../controllers/jinion.js';
import type { Session } from '../controllers/session.js';
import { appFields, watchFields } from './fields.js';
import { Connection, type Host } from './connection.js';
import type { ClientContract, Sessions } from './protocol.js';
import { type Clients, ClientScreen } from './screen.js';
import type { Transport } from './transport.js';

type Notifications = ClientContract['notifications'];

/**
 * The app behind the API: one `Jinion`, driven by any number of clients over any transport. Every client sees the
 * open sessions and the app's fields; each follows the sessions it shows, from a snapshot and then action by action.
 */
export class JinionServer implements Host {
  readonly app: Jinion;
  private readonly connections = new Set<Connection>();
  private readonly watched = new Map<Session, () => void>();
  private caller?: Connection;

  constructor(options: JinionOptions) {
    this.app = new Jinion(options, new ClientScreen(this.clients()));
    this.app.onSessionsChange(() => this.sessionsChanged());
    watchFields(this.app.store, appFields, (change) => this.broadcast('app/field', change));
    this.watchSessions();
    this.app.terminals.onChange((terminals) => this.broadcast('terminals/changed', { terminals }));

    this.app.terminals.onOutput((output) => {
      for (const connection of this.connections) if (connection.terminals.has(output.id)) connection.peer.notify('terminals/output', output);
    });
  }

  connect(transport: Transport) {
    const connection = new Connection(transport, this);

    this.connections.add(connection);

    connection.peer.onClose(() => {
      connection.closed();
      this.connections.delete(connection);
    });

    return connection;
  }

  sessions(): Sessions {
    const { app } = this;
    const open = app.sessions;

    return {
      sessions: open.map((session) => ({ id: session.id, title: app.store.get(session.atoms.title), working: session.working })),
      active: open.includes(app.session) ? app.session.id : undefined,
    };
  }

  answering<T>(connection: Connection, answer: () => T) {
    const outer = this.caller;

    this.caller = connection;

    try {
      return answer();
    } finally {
      this.caller = outer;
    }
  }

  private clients(): Clients {
    const ready = () => [...this.connections].filter((connection) => connection.ready);

    return {
      send: (method, params) => (this.caller ? this.caller.peer.notify(method, params) : this.broadcast(method, params)),
      broadcast: (method, params) => this.broadcast(method, params),
      focused: () => ready().some((connection) => connection.focused),
      notifications: () => (this.caller ?? ready().at(-1))?.notifications ?? 'desktop',
    };
  }

  private broadcast<M extends keyof Notifications>(method: M, params: Notifications[M]) {
    for (const connection of this.connections) if (connection.ready) connection.peer.notify(method, params);
  }

  private sessionsChanged() {
    this.watchSessions();

    const open = new Set(this.app.sessions.map((session) => session.id));

    for (const connection of this.connections) connection.prune(open);
    this.broadcast('sessions/changed', this.sessions());
  }

  /** A summary changes with its session's title and whether it works, which tabs show. */
  private watchSessions() {
    const { store, sessions } = this.app;

    for (const [session, stop] of this.watched) {
      if (sessions.includes(session)) continue;

      stop();
      this.watched.delete(session);
    }

    for (const session of sessions) {
      if (this.watched.has(session)) continue;

      const changed = () => this.broadcast('sessions/changed', this.sessions());
      const stops = [store.sub(session.atoms.title, changed), store.sub(session.atoms.working, changed)];

      this.watched.set(session, () => {
        for (const stop of stops) stop();
      });
    }
  }
}
