import type { RewindScope } from '../agent/agent.js';
import { promptCount } from '../conversation/entries.js';
import type { Action } from '../conversation/reducer.js';
import { resumeOf, toSaved, type SavedSession } from '../conversation/session.js';
import type { SessionStore } from '../conversation/store.js';
import { conversationDigest, titleDue } from '../conversation/titles.js';
import { errorMessage } from '../lib/errors.js';
import { firstLine, quote } from '../lib/text.js';
import { backgroundTasksAtom, tasksAtom } from '../state/agent.js';
import { draftAtom } from '../state/prompt.js';
import { dispatchAtom, sessionAtom } from '../state/session.js';
import { workingAtom } from '../state/turn.js';
import { BUSY, type Context } from './context.js';

export interface RewindPoint {
  entry: string;
  promptId: string;
  text: string;
}

export class ConversationController {
  private naming = false;
  private planAccepted = false;

  constructor(
    private readonly context: Context,
    private readonly sessions: SessionStore,
  ) {}

  get session() {
    return this.context.store.get(sessionAtom);
  }

  dispatch(action: Action) {
    this.context.store.set(dispatchAtom, action);
  }

  save() {
    const saved = toSaved(this.session);
    if (saved) this.sessions.save(saved);
  }

  newSession() {
    this.switchTo({ type: 'clear' });
  }

  resume(saved: SavedSession) {
    this.switchTo({ type: 'load', session: saved });
  }

  private switchTo(action: Extract<Action, { type: 'clear' | 'load' }>) {
    const { store, agent, notice } = this.context;
    if (store.get(workingAtom)) return notice(BUSY, 'warning');
    this.save();
    const running = store.get(backgroundTasksAtom).filter((task) => task.status === 'running');
    agent.reset?.(action.type === 'load' ? resumeOf(action.session) : undefined);
    store.set(tasksAtom, []);
    this.dispatch(action);
    if (running.length > 0) {
      notice(`Stopped what ran in the background of the last conversation: ${running.map((task) => firstLine(task.title)).join(', ')}.`);
    }
  }

  markPlanAccepted() {
    this.planAccepted = true;
  }

  /** Saved after every turn, so a crash loses at most the turn in progress; renamed as Claude Code does, keeping a name the user gave. */
  turnEnded() {
    this.save();
    const accepted = this.planAccepted;
    this.planAccepted = false;
    if (this.session.titled?.by === 'user') return;
    if (accepted || titleDue(this.session)) this.name(accepted).catch(() => {});
  }

  rename(name?: string) {
    const { agent, notice } = this.context;
    if (name) {
      this.retitle(name, 'user');
      return notice(`Renamed the conversation to “${name}”.`, 'success');
    }
    if (!agent.titleFor) return notice(`${agent.name} can't name conversations. Type /rename and a name.`, 'warning');
    if (promptCount(this.session.entries) === 0) return notice('There is nothing to name yet.', 'muted');
    this.name(true).then(
      (named) =>
        named
          ? notice(`Named the conversation “${named}”. It is named again as it moves on.`, 'success')
          : notice('Couldn’t name the conversation. Type /rename and a name.', 'warning'),
      (error: unknown) => notice(`Couldn't name the conversation: ${errorMessage(error)}`, 'error'),
    );
  }

  private async name(fresh: boolean) {
    const { agent } = this.context;
    if (!agent.titleFor || this.naming) return undefined;
    const { entries, title, titled } = this.session;
    this.naming = true;
    try {
      const named = await agent.titleFor(conversationDigest(entries), fresh || !titled ? undefined : title);
      if (named) this.retitle(named, 'agent');
      return named;
    } finally {
      this.naming = false;
    }
  }

  private retitle(title: string, by: 'agent' | 'user') {
    const { id, entries } = this.session;
    this.dispatch({ type: 'retitle', session: id, title, by, turns: promptCount(entries) });
    if (!this.context.store.get(workingAtom)) this.save();
  }

  /** A message that joined a running turn is no place to go back to, as in Claude Code. */
  rewindPoints(): RewindPoint[] {
    return this.session.entries
      .flatMap((entry) =>
        entry.kind === 'user' && entry.promptId && !entry.steered ? [{ entry: entry.id, promptId: entry.promptId, text: entry.text }] : [],
      )
      .reverse();
  }

  async rewindTo(point: RewindPoint, scope: RewindScope) {
    const { agent, notice, store } = this.context;
    const quoted = quote(point.text);
    try {
      await agent.rewind!(point.promptId, scope);
    } catch (error) {
      return notice(`Couldn't rewind: ${errorMessage(error)}`, 'error');
    }
    if (scope.conversation) {
      this.dispatch({ type: 'rewind', entry: point.entry });
      store.set(draftAtom, point.text);
    }
    notice(
      scope.code && scope.conversation
        ? `Went back to before ${quoted}, files and conversation.`
        : scope.conversation
          ? `The conversation went back to before ${quoted}; the files stay as they are.`
          : `The files went back to how they were before ${quoted}; the conversation goes on.`,
      'success',
    );
  }
}
