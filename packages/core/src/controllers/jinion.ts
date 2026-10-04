import { basename } from 'node:path';
import { isServer } from '../api/server-file.js';
import type { NoticeTone } from '../conversation/entries.js';
import { createStore } from 'jotai/vanilla';
import { type AgentBackend, type AgentCommand, type AgentMode, agentInfo, sessionFeatures } from '../agent/agent.js';
import type { ModelOption, ModelSelection } from '../agent/models.js';
import type { CommandRegistry } from '../commands/registry.js';
import { fromSaved, createSessionState, resumeOf, type SavedSession } from '../conversation/session.js';
import type { SessionStore } from '../conversation/store.js';
import { worktreeExists } from '../git/worktrees.js';
import { tildify } from '../lib/paths.js';
import type { MemoryStore } from '../memory/store.js';
import { loadSettings } from '../settings/user.js';
import { agentsAtom, modelsAtom, skillsAtom } from '../state/agent.js';
import { notificationsAtom, worktreesAtom } from '../state/preferences.js';
import { DEFAULT_CONTEXT_WINDOW } from '../state/session.js';
import { AccountController } from './accounts.js';
import type { AppContext, AppInfo, Screen } from './context.js';
import { McpController } from './mcp.js';
import { type Notice, Session } from './session.js';

export interface JinionOptions {
  /** In the order `/model` lists them; conversations saved before there were several ran on the first. */
  backends: AgentBackend[];
  /** The backend a new conversation starts on; the first when left out. */
  agent?: string;
  /** The model to start with on `agent`; the one last picked for it, or its default, when left out. */
  selection?: ModelSelection;
  /** The project's mode; the backend's default when left out. */
  mode?: AgentMode;
  info: AppInfo;
  /** The project's saved conversations. */
  saved: SessionStore;
  memory: MemoryStore;
  commands: CommandRegistry;
  /** Continued from the start, e.g. for `--continue`. */
  initial?: SavedSession;
  /** Printed once the screen is gone, e.g. where a kept worktree is. */
  onExit?(message: string): void;
}

export interface OpenOptions {
  /** A git worktree of its own with its first message; the user's default when left out. */
  worktree?: boolean;
}

/** The app: what every session shares, the sessions open in it, and the one the user looks at. */
export class Jinion {
  readonly store = createStore();
  readonly backends: readonly AgentBackend[];
  readonly info: AppInfo;
  readonly saved: SessionStore;
  readonly memory: MemoryStore;
  readonly commands: CommandRegistry;
  readonly accounts: AccountController;
  readonly mcp: McpController;
  private readonly open: Session[] = [];
  private active?: Session;
  /** The backends whose models, login and skills were read, which happens once a session or `/model` needs them. */
  private readonly loaded = new Set<AgentBackend>();
  private started = false;
  private readonly onExit?: (message: string) => void;
  private readonly sessionListeners = new Set<() => void>();

  constructor(
    private readonly options: JinionOptions,
    readonly screen: Screen,
  ) {
    ({ backends: this.backends, info: this.info, saved: this.saved, memory: this.memory, commands: this.commands, onExit: this.onExit } = options);

    const context: AppContext = {
      store: this.store,
      backends: this.backends,
      activeBackend: () => this.backend,
      info: this.info,
      screen,
      notice: (text, tone) => this.notice(text, tone),
      notify: (body) => this.notify(body),
    };

    this.accounts = new AccountController(context, {
      switched: (backend) => this.refresh(backend),
      working: () => this.open.some((session) => session.working),
      started: () => this.store.get(this.session.atoms.state).agentSession !== undefined,
    });

    this.mcp = new McpController(context, (backend) => this.reloadSkills(backend));
    this.store.set(agentsAtom, this.backends.map(agentInfo));
    this.activate(this.openFirst(options.initial));
  }

  /** The session the user looks at. */
  get session() {
    if (!this.active) throw new Error('No session is open.');

    return this.active;
  }

  /** The backend of the session the user looks at, which the app's accounts, MCP servers and usage are about. */
  get backend() {
    return this.session.backend;
  }

  get sessions(): readonly Session[] {
    return this.open;
  }

  start() {
    this.started = true;
    for (const session of this.open) this.load(session.backend);
  }

  /** Reads a backend's models, login and skills, the first time something needs them once the app started. */
  load(backend: AgentBackend) {
    if (!this.started || this.loaded.has(backend)) return;

    this.loaded.add(backend);
    this.refresh(backend);
  }

  /** Every backend's models, for `/model` to list them all. */
  loadAll() {
    for (const backend of this.backends) this.load(backend);
  }

  named(name: string) {
    const backend = this.backends.find((candidate) => candidate.name === name);
    if (!backend) throw new Error(`${name} isn't available in this jinion.`);

    return backend;
  }

  /** The model to use on `backend`: the one picked for it last, or its default. */
  selectionFor(backend: AgentBackend): ModelSelection {
    const { selection } = this.options;
    if (selection && backend === this.startingBackend()) return selection;

    return loadSettings().models?.[backend.name] ?? { model: backend.defaultModel };
  }

  /** `mode` when the backend has it; otherwise the project's mode, or the backend's first. */
  modeFor(backend: AgentBackend, mode?: AgentMode): AgentMode {
    const fits = [mode, this.options.mode, 'edits' as const].find((candidate) => candidate && backend.modes.includes(candidate));

    return fits ?? backend.modes[0]!;
  }

  /**
   * Opens a new conversation, or `saved` where it left off, in its worktree if that is still there. A conversation
   * already open isn't opened twice: its session comes back instead, and one open in another Jinion throws
   * `OpenElsewhere`. New sessions start with the model and mode of the one the user looks at.
   */
  openSession(saved?: SavedSession, { worktree }: OpenOptions = {}) {
    const already = saved && this.open.find((session) => session.id === saved.id);
    if (already) return already;

    const { store, active } = this;
    // A saved conversation goes on where it ran; a new one starts where the user is.
    const backend = saved ? this.named(saved.agent ?? this.backends[0]!.name) : (active?.backend ?? this.startingBackend());
    const gone = saved?.worktree && !worktreeExists(saved.worktree) ? saved.worktree : undefined;
    const contextWindow = active ? store.get(active.atoms.state).usage.contextWindow : DEFAULT_CONTEXT_WINDOW;
    const state = saved ? fromSaved(gone ? { ...saved, worktree: undefined } : saved) : createSessionState(contextWindow);

    this.claim(state.id, saved?.title);

    const agent = backend.session({
      cwd: (!gone && saved?.worktree?.folder) || this.info.cwd,
      selection: active?.backend === backend ? store.get(active.atoms.selection) : this.selectionFor(backend),
      mode: this.modeFor(backend, active && store.get(active.atoms.mode)),
      resume: saved && resumeOf(saved),
    });

    const session = new Session(this, backend, agent, {
      state: { ...state, agent: backend.name },
      features: sessionFeatures(agent),
      selection: agent.selection,
      mode: agent.mode,
      worktree: worktree ?? store.get(worktreesAtom),
    });

    this.open.push(session);
    this.load(backend);
    this.sessionsChanged();

    if (gone) {
      session.notice(`Your worktree ${tildify(gone.path)} no longer exists. The conversation continues in the project folder.`, 'warning');
    }

    return session;
  }

  activate(session: Session) {
    this.active = session;
    this.sessionsChanged();
  }

  /** Each time a session opens or closes, or another becomes the one the user looks at. */
  onSessionsChange(listener: () => void) {
    this.sessionListeners.add(listener);

    return () => void this.sessionListeners.delete(listener);
  }

  /** Closes `session`, unless the user keeps it, and shows another; a new conversation when it was the last. */
  async close(session: Session) {
    const notices = await this.end(session);
    if (!notices) return false;

    if (session === this.active) this.show(this.open.at(-1) ?? this.openSession(), notices);

    return true;
  }

  /** A new conversation, or `saved`, beside those open, and the one the user looks at from now on, as a new tab is. */
  openBeside(saved?: SavedSession) {
    const session = this.openSession(saved);

    this.activate(session);

    return session;
  }

  /** A new conversation in place of the one the user looks at, as `/clear` does. */
  newSession() {
    return this.replace();
  }

  /** `saved` in place of the conversation the user looks at, as `/resume` does. */
  resume(saved: SavedSession) {
    return this.replace(saved);
  }

  notice(text: string, tone?: NoticeTone) {
    this.session.notice(text, tone);
  }

  /** A backend's skills and MCP prompts, as one of its sessions reports them. */
  setSkills(backend: AgentBackend, skills: AgentCommand[]) {
    this.store.set(skillsAtom, (all) => ({ ...all, [backend.name]: skills }));
  }

  /** Also while the window has focus, when it comes from a session the user isn't looking at. */
  notify(body: string, from?: Session) {
    if (!this.store.get(notificationsAtom)) return;
    if (this.screen.focused() && (from === undefined || from === this.active)) return;

    this.screen.notify(`jinion · ${basename(this.info.cwd)}`, body);
  }

  async quit() {
    const kept = await Promise.all(this.open.map((session) => session.quit()));

    for (const session of this.open) this.saved.release(session.id);
    this.screen.exit();
    for (const message of kept) if (message) this.onExit?.(message);
  }

  private async replace(saved?: SavedSession) {
    // Before the session shown closes, so a conversation open in another Jinion leaves it as it is.
    if (saved) this.claim(saved.id, saved.title);

    const notices = await this.end(this.session);

    if (notices) this.show(this.openSession(saved), notices);
    else if (saved) this.saved.release(saved.id);
  }

  /** `undefined` when the session stays open. */
  private async end(session: Session) {
    const notices = await session.close();

    if (notices) {
      this.open.splice(this.open.indexOf(session), 1);
      this.saved.release(session.id);
      this.sessionsChanged();
    }

    return notices;
  }

  /** `initial` unless another Jinion has it open, as `--continue` may find; a new conversation then. */
  private openFirst(initial?: SavedSession) {
    try {
      return this.openSession(initial);
    } catch (error) {
      if (!(error instanceof OpenElsewhere)) throw error;

      const session = this.openSession();

      session.notice(`${error.message} This is a new conversation.`, 'warning');

      return session;
    }
  }

  private startingBackend() {
    return this.named(this.options.agent ?? this.backends[0]!.name);
  }

  private claim(id: string, title?: string) {
    const owner = this.saved.claim(id);

    if (owner !== undefined) throw new OpenElsewhere(owner, title);
  }

  private sessionsChanged() {
    for (const listener of this.sessionListeners) listener();
  }

  private show(session: Session, notices: Notice[]) {
    this.activate(session);
    for (const { text, tone } of notices) session.notice(text, tone);
  }

  private refresh(backend: AgentBackend) {
    this.loadModels(backend);
    this.accounts.loadIdentity(backend);
    this.reloadSkills(backend);
  }

  private loadModels(backend: AgentBackend) {
    const { name } = backend;
    const listed = (list: ModelOption[]) => this.store.set(modelsAtom, (all) => ({ ...all, [name]: list }));

    this.store.set(modelsAtom, ({ [name]: _, ...rest }) => rest);
    backend.models().then(listed, () => listed([]));
  }

  /** Later changes, e.g. as MCP servers connect, come as `commands` events. */
  private reloadSkills(backend: AgentBackend) {
    backend.commands().then(
      (skills) => this.setSkills(backend, skills),
      () => {},
    );
  }
}

/** Two processes writing one conversation would undo each other's turns. */
export class OpenElsewhere extends Error {
  constructor(
    readonly pid: number,
    title = 'This conversation',
  ) {
    super(
      isServer(pid)
        ? `“${title}” is open in jinion serve (pid ${pid}); jinion --attach shows it.`
        : `“${title}” is open in another jinion (pid ${pid}). Close it there to open it here.`,
    );
  }
}
