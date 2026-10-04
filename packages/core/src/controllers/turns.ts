import type { AgentMode, RunContext } from '../agent/agent.js';
import type { AgentEvent } from '../agent/events.js';
import { elapsed } from '../lib/format.js';
import { errorMessage } from '../lib/errors.js';
import { quote } from '../lib/text.js';
import { handoff } from '../conversation/handoff.js';
import type { Action } from '../conversation/reducer.js';
import { BUSY, type SessionContext } from './context.js';
import { DialogCancelled, type DialogController } from './dialogs.js';
import { promptOf, type Submission } from '../prompt/submission.js';
import { asksBeforeCommits } from '../settings/project.js';

const LONG_TURN_MS = 15_000;

export interface TurnHooks {
  apply(event: AgentEvent): void;
  planAccepted(mode: AgentMode): void;
  /** Before a prompt goes to the agent, e.g. to set up the conversation's worktree. */
  preparing(): Promise<void>;
  /** After a turn ends, before anything queued is sent. */
  ended(): void;
}

export class TurnController {
  /** The agent started a turn of its own while another ran; it is followed once that one ends. */
  private agentTurnWaiting = false;

  constructor(
    private readonly context: SessionContext,
    private readonly dialogs: DialogController,
    private readonly hooks: TurnHooks,
  ) {}

  get working() {
    return this.context.store.get(this.context.atoms.working);
  }

  async prompt(submission: Submission) {
    if (this.working) return this.context.notice('jinion is still working. Press esc to interrupt it first.', 'warning');

    const { text } = submission;
    const sent = promptOf(submission);
    const { entries, handover } = this.context.store.get(this.context.atoms.state);
    const handed = handover ? { ...sent, text: handoff(entries, sent.text) } : sent;

    this.dispatch({ type: 'submit', text, prompt: sent.text === text ? undefined : sent.text });
    await this.run(quote(text), (turn) => this.afterPreparing(() => this.context.agent.run(handed, turn)));
  }

  steer(submission: Submission) {
    const { text } = submission;
    const sent = promptOf(submission);
    const id = this.context.agent.steer?.(sent);
    if (id === undefined) return this.enqueue(submission);

    this.dispatch({ type: 'steer', text, prompt: sent.text === text ? undefined : sent.text, id });
  }

  enqueue(submission: Submission) {
    this.context.store.set(this.context.atoms.queue, (queue) => [...queue, submission]);
  }

  interrupt() {
    this.context.store.get(this.context.atoms.turnAbort)?.abort();
  }

  followAgent() {
    const join = this.context.agent.join?.bind(this.context.agent);
    if (!join) return;

    if (this.context.store.get(this.context.atoms.turnAbort)) {
      this.agentTurnWaiting = true;

      return;
    }

    this.dispatch({ type: 'agent-turn' });
    void this.run('the background task', join);
  }

  compact(focus?: string) {
    const { backend, agent, atoms, notice, store } = this.context;
    const compact = agent.compact?.bind(agent);
    if (!compact) return notice(`${backend.name} can't compact the conversation.`, 'warning');
    if (this.working) return notice(BUSY, 'warning');
    if (!store.get(atoms.entries).some((entry) => entry.kind === 'user')) return notice('There is nothing to compact yet.', 'muted');

    this.dispatch({ type: 'agent-turn' });
    void this.run('the compaction', (turn) => compact(focus, turn));
  }

  private dispatch(action: Action) {
    this.context.dispatch(action);
  }

  private async *afterPreparing(events: () => AsyncIterable<AgentEvent>) {
    await this.hooks.preparing();
    yield* events();
  }

  private async run(label: string, events: (turn: RunContext) => AsyncIterable<AgentEvent>) {
    const { store, atoms, notify } = this.context;
    const abort = new AbortController();

    store.set(atoms.turnAbort, abort);

    const started = Date.now();
    // A long turn may have sent the user elsewhere; a short one they likely watched.
    const notifyIfLong = (body: string) => Date.now() - started >= LONG_TURN_MS && notify(body);

    try {
      for await (const event of events(this.runContext(abort))) this.hooks.apply(event);

      this.dispatch({ type: 'finish', outcome: 'done' });
      notifyIfLong(`Done with ${label} after ${elapsed(Date.now() - started)}.`);
    } catch (error) {
      if (abort.signal.aborted) this.dispatch({ type: 'finish', outcome: 'interrupted' });
      else {
        const message = errorMessage(error);

        this.dispatch({ type: 'finish', outcome: 'failed', message });
        notifyIfLong(`Stopped with an error, working on ${label}: ${message}`);
      }

      this.returnQueueToPrompt();
    } finally {
      store.set(atoms.turnAbort, undefined);
      this.hooks.ended();
      this.next();
    }
  }

  /** What the agent asks during the turn goes to the user as dialogs; cancelling one stops the turn. */
  private runContext(abort: AbortController): RunContext {
    const { signal } = abort;

    const stopOnCancel = <T>(answer: Promise<T>) =>
      answer.catch((error: unknown) => {
        if (error instanceof DialogCancelled) abort.abort();

        throw error;
      });

    return {
      signal,
      ask: (questions) =>
        stopOnCancel(this.dialogs.open({ id: 'ask', questions }, { message: `jinion asks: ${questions[0]?.prompt ?? 'a question'}`, signal })),
      approve: async (request, call) => {
        if (call) this.dispatch({ type: 'approval', id: call, waiting: true });

        try {
          const message = [request.title, request.command ?? request.subject].filter(Boolean).join(': ');

          return await stopOnCancel(this.dialogs.open({ id: 'permission', request }, { message, signal }));
        } finally {
          if (call) this.dispatch({ type: 'approval', id: call, waiting: false });
        }
      },
      approvePlan: async (modes) => {
        const decision = await stopOnCancel(this.dialogs.open({ id: 'plan', modes }, { message: 'The plan is ready for you to review.', signal }));

        if (decision.approve) this.hooks.planAccepted(decision.mode);

        return decision;
      },
      asksBeforeCommits: () => asksBeforeCommits(this.context.info.cwd),
    };
  }

  private returnQueueToPrompt() {
    const { store, atoms, fillPrompt } = this.context;
    const waiting = store.get(atoms.queue);
    if (waiting.length === 0) return;

    store.set(atoms.queue, []);
    fillPrompt(waiting.map(({ text }) => text).join('\n'), 'prepend');
  }

  private next() {
    if (this.agentTurnWaiting) {
      this.agentTurnWaiting = false;

      return this.followAgent();
    }

    const { store, atoms } = this.context;
    const [submission, ...rest] = store.get(atoms.queue);
    if (!submission) return;

    store.set(atoms.queue, rest);
    void this.prompt(submission);
  }
}
