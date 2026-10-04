import type { RewindScope } from '../agent/agent.js';
import { promptCount } from '../conversation/entries.js';
import type { Action } from '../conversation/reducer.js';
import { toSaved } from '../conversation/session.js';
import type { SessionStore } from '../conversation/store.js';
import { conversationDigest, titleDue } from '../conversation/titles.js';
import { errorMessage } from '../lib/errors.js';
import { quote } from '../lib/text.js';
import { BUSY, type SessionContext } from './context.js';

export interface RewindPoint {
  entry: string;
  promptId: string;
  text: string;
}

export class ConversationController {
  private naming = false;
  private planAccepted = false;

  constructor(
    private readonly context: SessionContext,
    private readonly saved: SessionStore,
  ) {}

  get session() {
    return this.context.store.get(this.context.atoms.state);
  }

  dispatch(action: Action) {
    this.context.dispatch(action);
  }

  save() {
    const saved = toSaved(this.session);

    if (saved) this.saved.save(saved);
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
    const { backend, notice } = this.context;

    if (name) {
      this.retitle(name, 'user');

      return notice(`Renamed the conversation to “${name}”.`, 'success');
    }

    if (!backend.titleFor) return notice(`${backend.name} can't name conversations. Type /rename and a name.`, 'warning');
    if (promptCount(this.session.entries) === 0) return notice('There is nothing to name yet.', 'muted');

    this.name(true).then(
      (named) =>
        named
          ? notice(`Named the conversation “${named}”. It is named again as it moves on.`, 'success')
          : notice('Couldn’t name the conversation. Type /rename and a name.', 'warning'),
      (error: unknown) => notice(`Couldn't name the conversation: ${errorMessage(error)}`, 'error'),
    );
  }

  openRewind() {
    const { backend, agent, atoms, notice, screen, store } = this.context;
    if (!agent.rewind) return notice(`${backend.name} can't rewind.`, 'warning');
    if (store.get(atoms.working)) return notice(BUSY, 'warning');

    const points = this.rewindPoints();
    if (points.length === 0) return notice('There is nothing to rewind yet.', 'muted');

    screen.openView({ id: 'rewind', points });
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
    const { agent, notice, fillPrompt } = this.context;
    const quoted = quote(point.text);

    try {
      await agent.rewind!(point.promptId, scope);
    } catch (error) {
      return notice(`Couldn't rewind: ${errorMessage(error)}`, 'error');
    }

    if (scope.conversation) {
      this.dispatch({ type: 'rewind', entry: point.entry });
      fillPrompt(point.text, 'replace');
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

  private async name(fresh: boolean) {
    const { backend } = this.context;
    if (!backend.titleFor || this.naming) return undefined;

    const { entries, title, titled } = this.session;

    this.naming = true;

    try {
      const named = await backend.titleFor(conversationDigest(entries), fresh || !titled ? undefined : title);

      if (named) this.retitle(named, 'agent');

      return named;
    } finally {
      this.naming = false;
    }
  }

  private retitle(title: string, by: 'agent' | 'user') {
    const { id, entries } = this.session;

    this.dispatch({ type: 'retitle', session: id, title, by, turns: promptCount(entries) });
    if (!this.context.store.get(this.context.atoms.working)) this.save();
  }
}
