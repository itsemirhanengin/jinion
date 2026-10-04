import { basename } from 'node:path';
import type { NoticeTone } from '../conversation/entries.js';
import { createStore } from 'jotai/vanilla';
import type { AgentBackend, AgentMode } from '../agent/agent.js';
import type { ModelSelection } from '../agent/models.js';
import type { CommandRegistry } from '../commands/registry.js';
import { fromSaved, createSessionState, resumeOf, type SavedSession } from '../conversation/session.js';
import type { SessionStore } from '../conversation/store.js';
import type { MemoryStore } from '../memory/store.js';
// biome-ignore lint/style/noRestrictedImports: the app is what sets the session the user looks at.
import { activeSessionAtom } from '../state/active.js';
import { accountAtom, modelsAtom, skillsAtom } from '../state/agent.js';
import { notificationsAtom } from '../state/preferences.js';
import { DEFAULT_CONTEXT_WINDOW } from '../state/session.js';
import { AccountController } from './accounts.js';
import type { AppContext, AppInfo, Screen } from './context.js';
import { McpController } from './mcp.js';
import { Session } from './session.js';

export interface JinionOptions {
  backend: AgentBackend;
  /** The model to start with; the backend's default when left out. */
  selection?: ModelSelection;
  /** The project's mode; the backend's default when left out. */
  mode?: AgentMode;
  info: AppInfo;
  sessions: SessionStore;
  memory: MemoryStore;
  commands: CommandRegistry;
  /** Continued from the start, e.g. for `--continue`. */
  initial?: SavedSession;
  /** Printed once the screen is gone, e.g. where a kept worktree is. */
  onExit?(message: string): void;
}

/** The app: what every session shares, and the session the user looks at. */
export class Jinion {
  readonly store = createStore();
  readonly backend: AgentBackend;
  readonly info: AppInfo;
  readonly sessions: SessionStore;
  readonly memory: MemoryStore;
  readonly commands: CommandRegistry;
  readonly accounts: AccountController;
  readonly mcp: McpController;
  /** The session the user looks at. */
  readonly session: Session;
  private readonly onExit?: (message: string) => void;

  constructor(
    options: JinionOptions,
    readonly screen: Screen,
  ) {
    ({ backend: this.backend, info: this.info, sessions: this.sessions, memory: this.memory, commands: this.commands, onExit: this.onExit } = options);

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
      working: () => this.session.working,
      started: () => this.store.get(this.session.atoms.state).agentSession !== undefined,
    });

    this.mcp = new McpController(context, () => this.reloadSkills());

    const { initial } = options;
    const agent = this.backend.session({ cwd: this.info.cwd, selection: options.selection, mode: options.mode });

    this.session = new Session(this, agent, {
      state: initial ? fromSaved(initial) : createSessionState(DEFAULT_CONTEXT_WINDOW),
      selection: agent.selection,
      mode: agent.mode,
    });

    if (initial) agent.reset?.(resumeOf(initial), this.session.worktrees.folderOf(initial));
    this.store.set(activeSessionAtom, this.session.atoms);
    this.store.set(accountAtom, this.backend.accounts?.current);
  }

  start() {
    this.refresh();

    return this.session.start();
  }

  refresh() {
    this.loadModels();
    this.accounts.loadIdentity();
    this.reloadSkills();
  }

  notice(text: string, tone?: NoticeTone) {
    this.session.notice(text, tone);
  }

  /** Also while the window has focus, when it comes from a session the user isn't looking at. */
  notify(body: string, from?: Session) {
    if (!this.store.get(notificationsAtom)) return;
    if (this.screen.focused() && (from === undefined || from === this.session)) return;

    this.screen.notify(`jinion · ${basename(this.info.cwd)}`, body);
  }

  async quit() {
    const kept = await this.session.quit();

    this.screen.exit();
    if (kept) this.onExit?.(kept);
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
