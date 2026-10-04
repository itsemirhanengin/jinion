import type { Jinion } from '../controllers/jinion.js';
import type { Session } from '../controllers/session.js';
import { readFields, sessionFields, watchFields } from './fields.js';
import { accountMethods } from './methods/accounts.js';
import { appMethods } from './methods/app.js';
import { dialogMethods } from './methods/dialogs.js';
import { gitMethods } from './methods/git.js';
import { sessionMethods } from './methods/session.js';
import { sessionsMethods } from './methods/sessions.js';
import { ApiCode, type ClientContract, clientSchemas, type ServerContract, type Sessions } from './protocol.js';
import { type Params, type Result, RpcError, RpcPeer } from './rpc.js';
import type { Transport } from './transport.js';

type Method = keyof ServerContract['requests'];

/** What a connection needs of its server. */
export interface Host {
  readonly app: Jinion;
  sessions(): Sessions;
  /** Runs `answer` with `connection` as the client being answered, so what it opens on screen goes to that client. */
  answering<T>(connection: Connection, answer: () => T): T;
}

/** The methods of one area, such as accounts, registered on each connection. */
export type Methods = (connection: Connection) => void;

const METHODS: Methods[] = [appMethods, sessionsMethods, sessionMethods, dialogMethods, gitMethods, accountMethods];

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
    readonly host: Host,
  ) {
    this.peer = new RpcPeer(transport, clientSchemas);
    this.peer.on('client/focus', ({ focused }) => (this.focused = focused));
    for (const register of METHODS) register(this);
  }

  get app() {
    return this.host.app;
  }

  /** Answered once the client is initialized; `undefined` goes back as `null`, as JSON-RPC wants a result. */
  answer<M extends Method>(
    method: M,
    handler: (params: Params<ServerContract, M>) => Result<ServerContract, M> | void | Promise<Result<ServerContract, M> | void>,
  ) {
    this.peer.handle(method, (params) => {
      if (!this.ready && method !== 'initialize') throw new RpcError(ApiCode.notInitialized, `Send initialize before ${method}.`);

      return this.host.answering(this, () => handler(params)) as Result<ServerContract, M>;
    });
  }

  find(id: string) {
    const session = this.app.sessions.find((open) => open.id === id);
    if (!session) throw new RpcError(ApiCode.unknownSession, `There is no open session ${id}.`);

    return session;
  }

  /** Follows again from a fresh snapshot when it already did, e.g. after the client missed a change. */
  follow(session: Session) {
    const { store } = this.app;
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

  unfollow(id: string) {
    this.following.get(id)?.();
    this.following.delete(id);
  }

  /** Stops following sessions that are no longer open. */
  prune(open: Set<string>) {
    for (const id of this.following.keys()) if (!open.has(id)) this.unfollow(id);
  }

  closed() {
    for (const id of this.following.keys()) this.unfollow(id);
  }
}
