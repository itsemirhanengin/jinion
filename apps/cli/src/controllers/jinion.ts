import { basename } from 'node:path';
import type { NoticeTone } from '@jinion/tui/chat';
import { createStore } from 'jotai';
import type { Agent } from '../agent/agent.js';
import type { AgentEvent } from '../agent/events.js';
import type { CommandRegistry } from '../commands/registry.js';
import { fromSaved, createSession, type SavedSession } from '../conversation/session.js';
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

export interface JinionOptions {
  agent: Agent;
  info: AppInfo;
  sessions: SessionStore;
  memory: MemoryStore;
  commands: CommandRegistry;
  /** The agent is expected to be continuing it already, e.g. for `--continue`. */
  initial?: SavedSession;
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

  constructor(
    options: JinionOptions,
    readonly screen: Screen,
  ) {
    ({ agent: this.agent, info: this.info, sessions: this.sessions, memory: this.memory, commands: this.commands } = options);
    const context: Context = {
      store: this.store,
      agent: this.agent,
      info: this.info,
      screen,
      notice: (text, tone) => this.notice(text, tone),
      notify: (body) => this.notify(body),
    };
    this.attachments = new Attachments(context);
    this.conversation = new ConversationController(context, this.sessions);
    this.models = new ModelController(context);
    this.modes = new ModeController(context);
    this.accounts = new AccountController(context, () => this.refresh());
    this.tasks = new TaskController(context);
    this.turns = new TurnController(context, this.attachments, {
      apply: (event) => this.apply(event),
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

  quit() {
    this.conversation.save();
    this.screen.exit();
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
