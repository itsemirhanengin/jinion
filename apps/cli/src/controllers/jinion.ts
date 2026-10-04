import { basename } from 'node:path';
import type { NoticeTone } from '../conversation/entries.js';
import { createStore } from 'jotai';
import type { Agent } from '../agent/agent.js';
import type { AgentEvent } from '../agent/events.js';
import type { CommandRegistry } from '../commands/registry.js';
import { fromSaved, createSession, resumeOf, type SavedSession } from '../conversation/session.js';
import type { SessionStore } from '../conversation/store.js';
import type { MemoryStore } from '../memory/store.js';
import { accountAtom, modeAtom, selectionAtom, skillsAtom, tasksAtom } from '../state/agent.js';
import { notificationsAtom } from '../state/preferences.js';
import { DEFAULT_CONTEXT_WINDOW, dispatchAtom, sessionAtom } from '../state/session.js';
import { AccountController } from './accounts.js';
import { Attachments } from './attachments.js';
import type { AppInfo, Context, Screen } from './context.js';
import { ConversationController } from './conversation.js';
import { InputController } from './input.js';
import { ModeController } from './mode.js';
import { ModelController } from './model.js';
import { TaskController } from './tasks.js';
import { TurnController } from './turns.js';
import { WorktreeController } from './worktrees.js';

export interface JinionOptions {
  agent: Agent;
  info: AppInfo;
  sessions: SessionStore;
  memory: MemoryStore;
  commands: CommandRegistry;
  /** Continued from the start, e.g. for `--continue`. */
  initial?: SavedSession;
  /** Printed once the screen is gone, e.g. where a kept worktree is. */
  onExit?(message: string): void;
}

export class Jinion {
  readonly store = createStore();
  readonly agent: Agent;
  readonly info: AppInfo;
  readonly sessions: SessionStore;
  readonly memory: MemoryStore;
  readonly commands: CommandRegistry;
  readonly attachments: Attachments;
  readonly conversation: ConversationController;
  readonly turns: TurnController;
  readonly input: InputController;
  readonly models: ModelController;
  readonly modes: ModeController;
  readonly accounts: AccountController;
  readonly tasks: TaskController;
  readonly worktrees: WorktreeController;
  private readonly onExit?: (message: string) => void;

  constructor(
    options: JinionOptions,
    readonly screen: Screen,
  ) {
    ({ agent: this.agent, info: this.info, sessions: this.sessions, memory: this.memory, commands: this.commands, onExit: this.onExit } = options);

    const context: Context = {
      store: this.store,
      agent: this.agent,
      info: this.info,
      screen,
      notice: (text, tone) => this.notice(text, tone),
      notify: (body) => this.notify(body),
    };

    this.attachments = new Attachments(context);
    this.worktrees = new WorktreeController(context);
    this.conversation = new ConversationController(context, this.sessions, this.worktrees);
    this.models = new ModelController(context);
    this.modes = new ModeController(context);
    this.accounts = new AccountController(context, () => this.refresh());
    this.tasks = new TaskController(context);

    this.turns = new TurnController(context, this.attachments, {
      apply: (event) => this.apply(event),
      preparing: () => this.worktrees.prepare(),
      planAccepted: (mode) => {
        this.modes.keep(mode);
        this.conversation.markPlanAccepted();
      },
      ended: () => {
        this.conversation.turnEnded();
        this.accounts.turnEnded();
      },
    });

    this.input = new InputController(context, this, this.commands, this.attachments, this.turns);

    this.store.set(sessionAtom, options.initial ? fromSaved(options.initial) : createSession(DEFAULT_CONTEXT_WINDOW));
    if (options.initial) this.agent.reset?.(resumeOf(options.initial), this.worktrees.folderOf(options.initial));
    this.store.set(selectionAtom, this.agent.selection);
    this.store.set(modeAtom, this.agent.mode);
    this.store.set(accountAtom, this.agent.accounts?.current);
  }

  start() {
    this.refresh();

    return this.agent.subscribe?.((event) => this.apply(event)) ?? (() => {});
  }

  refresh() {
    this.models.load();
    this.accounts.loadIdentity();
    this.reloadSkills();
  }

  /** Later changes, e.g. as MCP servers connect, come as `commands` events. */
  reloadSkills() {
    this.agent.commands().then(
      (skills) => this.store.set(skillsAtom, skills),
      () => {},
    );
  }

  notice(text: string, tone?: NoticeTone) {
    this.store.set(dispatchAtom, { type: 'notice', text, tone });
  }

  notify(body: string) {
    if (this.store.get(notificationsAtom) && !this.screen.focused()) {
      this.screen.notify(`jinion · ${basename(this.info.cwd)}`, body);
    }
  }

  async quit() {
    const kept = await this.worktrees.quit();

    this.conversation.save();
    this.screen.exit();
    if (kept) this.onExit?.(kept);
  }

  private apply(event: AgentEvent) {
    switch (event.type) {
      case 'limits':
        this.accounts.recordLimits(event.windows);
        break;

      case 'mode':
        this.modes.show(event.mode);
        break;

      case 'commands':
        this.store.set(skillsAtom, event.commands);
        break;

      case 'tasks':
        this.store.set(tasksAtom, event.tasks);
        break;

      case 'task-end':
        this.tasks.ended(event.task);
        break;

      case 'turn-start':
        return this.turns.followAgent();
    }

    this.store.set(dispatchAtom, { type: 'event', event });
  }
}
