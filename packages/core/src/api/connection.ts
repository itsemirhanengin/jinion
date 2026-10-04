import type { Jinion } from '../controllers/jinion.js';
import type { Session } from '../controllers/session.js';
import { readFields, sessionFields, appFields, watchFields } from './fields.js';
import { ApiCode, type ClientContract, clientSchemas, PROTOCOL_VERSION, type ServerContract, type Sessions } from './protocol.js';
import { type Params, type Result, RpcCode, RpcError, RpcPeer } from './rpc.js';
import type { Transport } from './transport.js';

type Method = keyof ServerContract['requests'];

/** What a connection needs of its server. */
export interface Host {
  readonly app: Jinion;
  sessions(): Sessions;
  /** Runs `answer` with `connection` as the client being answered, so what it opens on screen goes to that client. */
  answering<T>(connection: Connection, answer: () => T): T;
}

/** One client: what it asks of the app, and the sessions it follows. */
export class Connection {
  readonly peer: RpcPeer<ServerContract, ClientContract>;
  ready = false;
  /** Until the client says otherwise, as a terminal that can't tell. */
  focused = true;
  notifications: 'desktop' | 'bell' = 'desktop';
  private readonly following = new Map<string, () => void>();

  constructor(
    transport: Transport,
    private readonly host: Host,
  ) {
    this.peer = new RpcPeer(transport, clientSchemas);
    this.peer.on('client/focus', ({ focused }) => (this.focused = focused));

    this.answer('initialize', ({ protocolVersion, notifications }) => {
      if (this.ready) throw new RpcError(RpcCode.invalidRequest, 'The client is already initialized.');

      if (protocolVersion !== PROTOCOL_VERSION) {
        throw new RpcError(ApiCode.unsupportedVersion, `jinion speaks protocol ${PROTOCOL_VERSION}, the client ${protocolVersion}.`, {
          supported: [PROTOCOL_VERSION],
        });
      }

      const { app } = host;

      this.ready = true;
      this.notifications = notifications ?? this.notifications;

      return {
        protocolVersion: PROTOCOL_VERSION,
        server: { name: 'jinion', version: app.info.version },
        info: app.info,
        app: readFields(app.store, appFields),
        ...host.sessions(),
      };
    });

    this.answer('sessions/open', ({ resume, worktree }) => {
      const saved = resume === undefined ? undefined : host.app.saved.list().find((session) => session.id === resume);
      if (resume !== undefined && !saved) throw new RpcError(ApiCode.unknownSession, `There is no saved conversation ${resume}.`);

      return { session: host.app.openSession(saved, { worktree }).id };
    });

    this.answer('sessions/activate', ({ session }) => host.app.activate(this.find(session)));
    this.answer('sessions/close', async ({ session }) => ({ closed: await host.app.close(this.find(session)) }));
    this.answer('session/subscribe', ({ session }) => this.follow(this.find(session)));
    this.answer('session/unsubscribe', ({ session }) => this.unfollow(session));

    // A command acts on the session the user looks at, and one types into the session they look at.
    this.answer('session/submit', ({ session, text }) => {
      const target = this.find(session);

      if (host.app.session !== target) host.app.activate(target);
      target.input.submit(text);
    });

    this.answer('session/interrupt', ({ session }) => this.find(session).turns.interrupt());

    this.answer('dialog/answer', ({ session, dialog, answer }) => {
      const target = this.find(session);
      if (host.app.store.get(target.atoms.dialog)?.id !== dialog) throw new RpcError(ApiCode.dialogGone, 'That dialog is no longer open.');

      target.dialogs.answer(answer);
    });

    this.answer('dialog/cancel', ({ session }) => this.find(session).dialogs.cancel());
  }

  /** Stops following sessions that are no longer open. */
  prune(open: Set<string>) {
    for (const id of this.following.keys()) if (!open.has(id)) this.unfollow(id);
  }

  closed() {
    for (const id of this.following.keys()) this.unfollow(id);
  }

  /** Answered once the client is initialized; `undefined` goes back as `null`, as JSON-RPC wants a result. */
  private answer<M extends Method>(method: M, handler: (params: Params<ServerContract, M>) => Result<ServerContract, M> | void | Promise<Result<ServerContract, M>>) {
    this.peer.handle(method, (params) => {
      if (!this.ready && method !== 'initialize') throw new RpcError(ApiCode.notInitialized, `Send initialize before ${method}.`);

      return this.host.answering(this, () => handler(params)) as Result<ServerContract, M>;
    });
  }

  private find(id: string) {
    const session = this.host.app.sessions.find((open) => open.id === id);
    if (!session) throw new RpcError(ApiCode.unknownSession, `There is no open session ${id}.`);

    return session;
  }

  /** Follows again from a fresh snapshot when it already did, e.g. after the client missed a change. */
  private follow(session: Session) {
    const { store } = this.host.app;
    const { id } = session;
    const fields = sessionFields(session.atoms);

    this.unfollow(id);

    const stopActions = session.onAction((sent) => this.peer.notify('session/action', { session: id, ...sent }));
    const stopFields = watchFields(store, fields, (change) => this.peer.notify('session/field', { session: id, ...change }));

    this.following.set(id, () => {
      stopActions();
      stopFields();
    });

    return { state: store.get(session.atoms.state), fields: readFields(store, fields), seq: session.seq };
  }

  private unfollow(id: string) {
    this.following.get(id)?.();
    this.following.delete(id);
  }
}
