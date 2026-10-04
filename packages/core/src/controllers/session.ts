import type { AgentSession } from '../agent/agent.js';
import type { AgentEvent } from '../agent/events.js';
import type { NoticeTone } from '../conversation/entries.js';
import { skillsAtom } from '../state/agent.js';
import { type SessionAtoms, type SessionStart, sessionAtoms } from '../state/session.js';
import { Attachments } from './attachments.js';
import type { SessionContext } from './context.js';
import { ConversationController } from './conversation.js';
import { InputController } from './input.js';
import type { Jinion } from './jinion.js';
import { ModeController } from './mode.js';
import { ModelController } from './model.js';
import { TaskController } from './tasks.js';
import { TurnController } from './turns.js';
import { WorktreeController } from './worktrees.js';

/** One conversation: its agent session, its atoms and what it does. Several can be open; a client shows one or more. */
export class Session {
  readonly atoms: SessionAtoms;
  readonly attachments: Attachments;
  readonly conversation: ConversationController;
  readonly turns: TurnController;
  readonly input: InputController;
  readonly models: ModelController;
  readonly modes: ModeController;
  readonly tasks: TaskController;
  readonly worktrees: WorktreeController;

  constructor(
    private readonly app: Jinion,
    readonly agent: AgentSession,
    start: SessionStart,
  ) {
    this.atoms = sessionAtoms(start);

    const context: SessionContext = {
      store: app.store,
      backend: app.backend,
      info: app.info,
      screen: app.screen,
      agent,
      atoms: this.atoms,
      notice: (text, tone) => this.notice(text, tone),
      notify: (body) => app.notify(body),
    };

    this.attachments = new Attachments(context);
    this.worktrees = new WorktreeController(context);
    this.conversation = new ConversationController(context, app.sessions, this.worktrees);
    this.models = new ModelController(context);
    this.modes = new ModeController(context);
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
        app.accounts.turnEnded();
      },
    });

    this.input = new InputController(context, app, app.commands, this.attachments, this.turns);
  }

  get working() {
    return this.app.store.get(this.atoms.working);
  }

  /** Follows what the agent says between turns; the result stops it. */
  start() {
    return this.agent.subscribe?.((event) => this.apply(event)) ?? (() => {});
  }

  notice(text: string, tone?: NoticeTone) {
    this.app.store.set(this.atoms.dispatch, { type: 'notice', text, tone });
  }

  /** Saves the conversation and ends its agent session; says where a worktree with work in it stays. */
  async quit() {
    const kept = await this.worktrees.quit();

    this.conversation.save();
    this.agent.close();

    return kept;
  }

  private apply(event: AgentEvent) {
    const { store } = this.app;

    switch (event.type) {
      case 'limits':
        this.app.accounts.recordLimits(event.windows);
        break;

      case 'mode':
        this.modes.show(event.mode);
        break;

      case 'commands':
        store.set(skillsAtom, event.commands);
        break;

      case 'tasks':
        store.set(this.atoms.tasks, event.tasks);
        break;

      case 'task-end':
        this.tasks.ended(event.task);
        break;

      case 'turn-start':
        return this.turns.followAgent();
    }

    store.set(this.atoms.dispatch, { type: 'event', event });
  }
}
