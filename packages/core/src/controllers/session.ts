import type { AgentSession } from '../agent/agent.js';
import type { AgentEvent } from '../agent/events.js';
import type { NoticeTone } from '../conversation/entries.js';
import type { Action, StampedAction } from '../conversation/reducer.js';
import { firstLine } from '../lib/text.js';
import { skillsAtom } from '../state/agent.js';
import { type SessionAtoms, type SessionStart, sessionAtoms } from '../state/session.js';
import { BUSY, type SessionContext } from './context.js';
import { ConversationController } from './conversation.js';
import { DialogController } from './dialogs.js';
import { InputController } from './input.js';
import type { Jinion } from './jinion.js';
import { ModeController } from './mode.js';
import { ModelController } from './model.js';
import { TaskController } from './tasks.js';
import { TurnController } from './turns.js';
import { WorktreeController } from './worktrees.js';

/** An action as its session took it: stamped, and numbered in the order they came. */
export interface SentAction extends StampedAction {
  seq: number;
}

export interface Notice {
  text: string;
  tone?: NoticeTone;
}

/** One conversation: its agent session, its atoms and what it does. Several can be open; a client shows one or more. */
export class Session {
  readonly atoms: SessionAtoms;
  /** What it waits for the user to answer; a client answers through it. */
  readonly dialogs: DialogController;
  readonly conversation: ConversationController;
  readonly turns: TurnController;
  readonly input: InputController;
  readonly models: ModelController;
  readonly modes: ModeController;
  readonly tasks: TaskController;
  readonly worktrees: WorktreeController;
  private readonly unsubscribe: () => void;
  private readonly listeners = new Set<(sent: SentAction) => void>();
  private sent = 0;

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
      dispatch: (action) => this.dispatch(action),
      notice: (text, tone) => this.notice(text, tone),
      notify: (body) => app.notify(body, this),
      fillPrompt: (text, fill) => app.screen.fillPrompt(this.id, text, fill),
    };

    this.dialogs = new DialogController(context);
    this.worktrees = new WorktreeController(context, this.dialogs);
    this.conversation = new ConversationController(context, app.saved);
    this.models = new ModelController(context);
    this.modes = new ModeController(context);
    this.tasks = new TaskController(context);

    this.turns = new TurnController(context, this.dialogs, {
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

    this.input = new InputController(context, app, app.commands, this.turns);
    this.unsubscribe = agent.subscribe?.((event) => this.apply(event)) ?? (() => {});
  }

  /** The conversation it holds, as saved, so one can't be open in two sessions. */
  get id() {
    return this.app.store.get(this.atoms.state).id;
  }

  get working() {
    return this.app.store.get(this.atoms.working);
  }

  notice(text: string, tone?: NoticeTone) {
    this.dispatch({ type: 'notice', text, tone });
  }

  /** How many actions its conversation has taken since it opened; the next one is `seq + 1`. */
  get seq() {
    return this.sent;
  }

  /** Follows every change to its conversation, in order, as a client replaying them needs. */
  onAction(listener: (sent: SentAction) => void) {
    this.listeners.add(listener);

    return () => void this.listeners.delete(listener);
  }

  /**
   * Ends it for good: asks about a worktree with work in it, saves, and stops its agent with what ran in the
   * background. `undefined` when it stays open; otherwise what to tell the user wherever they look next.
   */
  async close(): Promise<Notice[] | undefined> {
    const { store } = this.app;

    if (this.working) {
      this.notice(BUSY, 'warning');

      return undefined;
    }

    const left = await this.worktrees.leave();
    if (!left) return undefined;

    this.conversation.save();

    const running = store.get(this.atoms.backgroundTasks).filter((task) => task.status === 'running');

    this.end();

    return [
      ...(left.notice ? [left.notice] : []),
      ...(running.length > 0
        ? [{ text: `Stopped what ran in the background of the last conversation: ${running.map((task) => firstLine(task.title)).join(', ')}.` }]
        : []),
    ];
  }

  /** On quit nobody is asked: saves, ends it, and says where a worktree with work in it stays. */
  async quit() {
    const kept = await this.worktrees.quit();

    this.conversation.save();
    this.end();

    return kept;
  }

  /** The one way its conversation changes: stamped once, so replaying it anywhere gives the same result. */
  private dispatch(action: Action) {
    const sent = { action, at: Date.now(), seq: ++this.sent };

    this.app.store.set(this.atoms.dispatch, sent);
    for (const listener of this.listeners) listener(sent);
  }

  private end() {
    this.listeners.clear();
    this.unsubscribe();
    this.agent.close();
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

    this.dispatch({ type: 'event', event });
  }
}
