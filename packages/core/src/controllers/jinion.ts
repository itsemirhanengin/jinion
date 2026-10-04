import { basename } from 'node:path';
import type { NoticeTone } from '../conversation/entries.js';
import { createStore } from 'jotai/vanilla';
import type { AgentBackend, AgentMode } from '../agent/agent.js';
import type { ModelSelection } from '../agent/models.js';
import type { CommandRegistry } from '../commands/registry.js';
import { fromSaved, createSessionState, resumeOf, type SavedSession } from '../conversation/session.js';
import type { SessionStore } from '../conversation/store.js';
import { worktreeExists } from '../git/worktrees.js';
import { tildify } from '../lib/paths.js';
import type { MemoryStore } from '../memory/store.js';
// biome-ignore lint/style/noRestrictedImports: the app is what sets the session the user looks at.
import { activeSessionAtom } from '../state/active.js';
import { accountAtom, modelsAtom, skillsAtom } from '../state/agent.js';
import { notificationsAtom, worktreesAtom } from '../state/preferences.js';
import { DEFAULT_CONTEXT_WINDOW } from '../state/session.js';
import { AccountController } from './accounts.js';
import type { AppContext, AppInfo, Screen } from './context.js';
import { McpController } from './mcp.js';
import { type Notice, Session } from './session.js';

export interface JinionOptions {
  backend: AgentBackend;
  /** The model to start with; the backend's default when left out. */
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
  readonly backend: AgentBackend;
  readonly info: AppInfo;
  readonly saved: SessionStore;
  readonly memory: MemoryStore;
  readonly commands: CommandRegistry;
  readonly accounts: AccountController;
  readonly mcp: McpController;
  private readonly open: Session[] = [];
  private active?: Session;
  private readonly onExit?: (message: string) => void;

  constructor(
    private readonly options: JinionOptions,
    readonly screen: Screen,
  ) {
    ({ backend: this.backend, info: this.info, saved: this.saved, memory: this.memory, commands: this.commands, onExit: this.onExit } = options);

    const context: AppContext = {
      store: this.store,
      backend: this.backend,
      info: this.info,
      screen,
      notice: (text, tone) => this.notice(text, tone),
      notify: (body) => this.notify(body),
    };

    this.accounts = new AccountController(context, {
      switched: () => this.refresh(),
      working: () => this.open.some((session) => session.working),
      started: () => this.store.get(this.session.atoms.state).agentSession !== undefined,
    });

    this.mcp = new McpController(context, () => this.reloadSkills());
    this.store.set(accountAtom, this.backend.accounts?.current);
    this.activate(this.openSession(options.initial));
  }

  /** The session the user looks at. */
  get session() {
    if (!this.active) throw new Error('No session is open.');

    return this.active;
  }

  get sessions(): readonly Session[] {
    return this.open;
  }

  start() {
    this.refresh();
  }

  refresh() {
    this.loadModels();
    this.accounts.loadIdentity();
    this.reloadSkills();
  }

  /**
   * Opens a new conversation, or `saved` where it left off, in its worktree if that is still there. A conversation
   * already open isn't opened twice: its session comes back instead. New sessions start with the model and mode of
   * the one the user looks at.
   */
  openSession(saved?: SavedSession, { worktree }: OpenOptions = {}) {
    const already = saved && this.open.find((session) => session.id === saved.id);
    if (already) return already;

    const { store, active } = this;
    const gone = saved?.worktree && !worktreeExists(saved.worktree) ? saved.worktree : undefined;
    const contextWindow = active ? store.get(active.atoms.state).usage.contextWindow : DEFAULT_CONTEXT_WINDOW;

    const agent = this.backend.session({
      cwd: (!gone && saved?.worktree?.folder) || this.info.cwd,
      selection: active ? store.get(active.atoms.selection) : this.options.selection,
      mode: active ? store.get(active.atoms.mode) : this.options.mode,
      resume: saved && resumeOf(saved),
    });

    const session = new Session(this, agent, {
      state: saved ? fromSaved(gone ? { ...saved, worktree: undefined } : saved) : createSessionState(contextWindow),
      selection: agent.selection,
      mode: agent.mode,
      worktree: worktree ?? store.get(worktreesAtom),
    });

    this.open.push(session);

    if (gone) {
      session.notice(`Your worktree ${tildify(gone.path)} no longer exists. The conversation continues in the project folder.`, 'warning');
    }

    return session;
  }

  activate(session: Session) {
    this.active = session;
    this.store.set(activeSessionAtom, session.atoms);
  }

  /** Closes `session`, unless the user keeps it, and shows another; a new conversation when it was the last. */
  async close(session: Session) {
    const notices = await this.end(session);
    if (!notices) return false;

    if (session === this.active) this.show(this.open.at(-1) ?? this.openSession(), notices);

    return true;
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

  /** Also while the window has focus, when it comes from a session the user isn't looking at. */
  notify(body: string, from?: Session) {
    if (!this.store.get(notificationsAtom)) return;
    if (this.screen.focused() && (from === undefined || from === this.active)) return;

    this.screen.notify(`jinion · ${basename(this.info.cwd)}`, body);
  }

  async quit() {
    const kept = await Promise.all(this.open.map((session) => session.quit()));

    this.screen.exit();
    for (const message of kept) if (message) this.onExit?.(message);
  }

  private async replace(saved?: SavedSession) {
    const notices = await this.end(this.session);

    if (notices) this.show(this.openSession(saved), notices);
  }

  /** `undefined` when the session stays open. */
  private async end(session: Session) {
    const notices = await session.close();

    if (notices) this.open.splice(this.open.indexOf(session), 1);

    return notices;
  }

  private show(session: Session, notices: Notice[]) {
    this.activate(session);
    for (const { text, tone } of notices) session.notice(text, tone);
  }

  private loadModels() {
    this.store.set(modelsAtom, undefined);

    this.backend.models().then(
      (models) => this.store.set(modelsAtom, models),
      () => this.store.set(modelsAtom, []),
    );
  }

  /** Later changes, e.g. as MCP servers connect, come as `commands` events. */
  private reloadSkills() {
    this.backend.commands().then(
      (skills) => this.store.set(skillsAtom, skills),
      () => {},
    );
  }
}
