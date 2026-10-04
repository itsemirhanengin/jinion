import { atom, createStore, type PrimitiveAtom } from 'jotai/vanilla';
import type { PromptFill, View } from '../controllers/context.js';
import { reduce } from '../conversation/reducer.js';
import type { AppFields } from './fields.js';
import { type ClientContract, type Initialized, PROTOCOL_VERSION, type ServerContract, type SessionSnapshot, type Sessions } from './protocol.js';
import { type Params, type Result, RpcPeer } from './rpc.js';
import type { Transport } from './transport.js';

type Method = keyof ServerContract['requests'];

type Change = (snapshot: SessionSnapshot) => SessionSnapshot;

/** What the server asks a client's screen to do. */
export interface ScreenHandlers {
  view(view: View): void;
  fillPrompt(session: string, text: string, fill: PromptFill): void;
  notify(title: string, body: string): void;
  expand(): void;
  exit(): void;
}

export interface ClientOptions {
  name: string;
  version: string;
  notifications?: 'desktop' | 'bell';
  screen: ScreenHandlers;
}

/**
 * A client of `JinionServer`: holds what the server tells it in its own store, and the sessions it follows as their
 * snapshot, replayed action by action with the reducer the server runs, so both hold the same conversation.
 */
export class JinionClient {
  readonly store = createStore();
  readonly sessionsAtom = atom<Sessions>({ sessions: [] });
  /** Until `initialize` answers. */
  readonly appAtom = atom<AppFields | undefined>(undefined);
  private readonly peer: RpcPeer<ClientContract, ServerContract>;
  private readonly followed = new Map<string, PrimitiveAtom<SessionSnapshot | undefined>>();
  /** Changes that came while a snapshot was on its way, applied to it once it arrives. */
  private readonly waiting = new Map<string, Change[]>();

  constructor(
    transport: Transport,
    private readonly options: ClientOptions,
  ) {
    const { store } = this;
    const { screen } = options;

    this.peer = new RpcPeer(transport);
    this.peer.on('sessions/changed', (sessions) => this.sessionsChanged(sessions));
    this.peer.on('app/field', ({ name, value }) => store.set(this.appAtom, (app) => app && { ...app, [name]: value }));

    this.peer.on('session/field', ({ session, name, value }) =>
      this.change(session, (snapshot) => ({ ...snapshot, fields: { ...snapshot.fields, [name]: value } })),
    );

    this.peer.on('session/action', ({ session, seq, action, at }) =>
      this.change(session, (snapshot) => {
        if (seq <= snapshot.seq) return snapshot;
        if (seq === snapshot.seq + 1) return { ...snapshot, state: reduce(snapshot.state, action, at), seq };

        // A change went missing, so the conversation starts over from a fresh snapshot.
        void this.follow(session);

        return snapshot;
      }),
    );

    this.peer.on('screen/view', ({ view }) => screen.view(view));
    this.peer.on('screen/fill-prompt', ({ session, text, fill }) => screen.fillPrompt(session, text, fill));
    this.peer.on('screen/notify', ({ title, body }) => screen.notify(title, body));
    this.peer.on('screen/expand', () => screen.expand());
    this.peer.on('screen/exit', () => screen.exit());
  }

  async initialize(): Promise<Initialized> {
    const { name, version, notifications } = this.options;
    const initialized = await this.request('initialize', { protocolVersion: PROTOCOL_VERSION, client: { name, version }, notifications });
    const { sessions, active, app } = initialized;

    this.store.set(this.sessionsAtom, { sessions, active });
    this.store.set(this.appAtom, app);

    return initialized;
  }

  request<M extends Method>(method: M, params: Params<ServerContract, M>): Promise<Result<ServerContract, M>> {
    return this.peer.request(method, params);
  }

  /** What comes with a request of this client's, such as a sign-in link or how far `usage/history` got. */
  on<M extends keyof ClientContract['notifications']>(method: M, listener: (params: ClientContract['notifications'][M]) => void) {
    return this.peer.on(method, listener);
  }

  /** The session as this client holds it; `undefined` until it is followed. */
  session(id: string) {
    const known = this.followed.get(id);
    if (known) return known;

    const created = atom<SessionSnapshot | undefined>(undefined);

    this.followed.set(id, created);

    return created;
  }

  async follow(id: string) {
    const changes: Change[] = [];

    this.waiting.set(id, changes);

    try {
      const snapshot = await this.request('session/subscribe', { session: id });

      this.store.set(this.session(id), changes.reduce((current, change) => change(current), snapshot));
    } finally {
      if (this.waiting.get(id) === changes) this.waiting.delete(id);
    }
  }

  async unfollow(id: string) {
    await this.request('session/unsubscribe', { session: id });
    this.store.set(this.session(id), undefined);
  }

  /** Whether the user looks at this client, so the server knows when to notify them elsewhere. */
  focus(focused: boolean) {
    this.peer.notify('client/focus', { focused });
  }

  close() {
    this.peer.close();
  }

  private change(id: string, change: Change) {
    const waiting = this.waiting.get(id);
    if (waiting) return void waiting.push(change);

    const followed = this.followed.get(id);
    const snapshot = followed && this.store.get(followed);

    if (snapshot) this.store.set(followed, change(snapshot));
  }

  private sessionsChanged(sessions: Sessions) {
    const open = new Set(sessions.sessions.map((session) => session.id));

    for (const [id, followed] of this.followed) {
      if (open.has(id)) continue;

      this.store.set(followed, undefined);
      this.followed.delete(id);
    }

    this.store.set(this.sessionsAtom, sessions);
  }
}
