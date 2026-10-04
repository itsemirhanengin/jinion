import type { PermissionDecision, PermissionRequest } from '../agent/permissions.js';
import type { Question, QuestionAnswer } from '../agent/questions.js';
import type { AgentMode, PlanDecision, RunContext } from '../agent/agent.js';
import type { AgentEvent } from '../agent/events.js';
import { elapsed } from '../lib/format.js';
import { errorMessage } from '../lib/errors.js';
import { quote } from '../lib/text.js';
import type { Action } from '../conversation/reducer.js';
import { draftAtom, queueAtom } from '../state/prompt.js';
import { dispatchAtom, entriesAtom } from '../state/session.js';
import { turnAbortAtom, workingAtom } from '../state/turn.js';
import type { Attachments } from './attachments.js';
import { BUSY, type Context, type Dialog } from './context.js';

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
    private readonly context: Context,
    private readonly attachments: Attachments,
    private readonly hooks: TurnHooks,
  ) {}

  get working() {
    return this.context.store.get(workingAtom);
  }

  async prompt(text: string) {
    if (this.working) return this.context.notice('jinion is still working. Press esc to interrupt it first.', 'warning');

    const sent = this.attachments.resolve(text);

    this.dispatch({ type: 'submit', text, prompt: sent.text === text ? undefined : sent.text });
    await this.run(quote(text), (turn) => this.afterPreparing(() => this.context.agent.run(sent, turn)));
  }

  steer(text: string) {
    const sent = this.attachments.resolve(text);
    const id = this.context.agent.steer?.(sent);
    if (id === undefined) return this.enqueue(text);

    this.dispatch({ type: 'steer', text, prompt: sent.text === text ? undefined : sent.text, id });
  }

  enqueue(text: string) {
    this.context.store.set(queueAtom, (queue) => [...queue, text]);
  }

  interrupt() {
    this.context.store.get(turnAbortAtom)?.abort();
  }

  followAgent() {
    const join = this.context.agent.join?.bind(this.context.agent);
    if (!join) return;

    if (this.context.store.get(turnAbortAtom)) {
      this.agentTurnWaiting = true;

      return;
    }

    this.dispatch({ type: 'agent-turn' });
    void this.run('the background task', join);
  }

  compact(focus?: string) {
    const { agent, notice, store } = this.context;
    const compact = agent.compact?.bind(agent);
    if (!compact) return notice(`${agent.name} can't compact the conversation.`, 'warning');
    if (this.working) return notice(BUSY, 'warning');
    if (!store.get(entriesAtom).some((entry) => entry.kind === 'user')) return notice('There is nothing to compact yet.', 'muted');

    this.dispatch({ type: 'agent-turn' });
    void this.run('the compaction', (turn) => compact(focus, turn));
  }

  private dispatch(action: Action) {
    this.context.store.set(dispatchAtom, action);
  }

  private async *afterPreparing(events: () => AsyncIterable<AgentEvent>) {
    await this.hooks.preparing();
    yield* events();
  }

  private async run(label: string, events: (turn: RunContext) => AsyncIterable<AgentEvent>) {
    const { store, notify } = this.context;
    const abort = new AbortController();

    store.set(turnAbortAtom, abort);

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
      store.set(turnAbortAtom, undefined);
      this.context.screen.closePanel('ask');
      this.context.screen.closePanel('permission');
      this.hooks.ended();
      this.next();
    }
  }

  private runContext(abort: AbortController): RunContext {
    const dialogs = new DialogLine(this.context, abort);

    return {
      signal: abort.signal,
      ask: (questions: Question[]) =>
        dialogs.open<QuestionAnswer[]>(`jinion asks: ${questions[0]?.prompt ?? 'a question'}`, (done, cancel) => ({
          id: 'ask',
          questions,
          onSubmit: done,
          onCancel: cancel,
        })),
      approve: async (request: PermissionRequest, call?: string) => {
        if (call) this.dispatch({ type: 'approval', id: call, waiting: true });

        try {
          const message = [request.title, request.command ?? request.subject].filter(Boolean).join(': ');

          return await dialogs.open<PermissionDecision>(message, (done, cancel) => ({
            id: 'permission',
            request,
            onDecide: done,
            onCancel: cancel,
          }));
        } finally {
          if (call) this.dispatch({ type: 'approval', id: call, waiting: false });
        }
      },
      approvePlan: (modes: AgentMode[]) =>
        dialogs.open<PlanDecision>('The plan is ready for you to review.', (done, cancel) => ({
          id: 'plan',
          modes,
          onDecide: (decision) => {
            if (decision.approve) this.hooks.planAccepted(decision.mode);
            done(decision);
          },
          onCancel: cancel,
        })),
    };
  }

  private returnQueueToPrompt() {
    const { store } = this.context;
    const waiting = store.get(queueAtom);
    if (waiting.length === 0) return;

    store.set(queueAtom, []);
    store.set(draftAtom, (draft) => [...waiting, draft].filter(Boolean).join('\n'));
  }

  private next() {
    if (this.agentTurnWaiting) {
      this.agentTurnWaiting = false;

      return this.followAgent();
    }

    const [text, ...rest] = this.context.store.get(queueAtom);
    if (text === undefined) return;

    this.context.store.set(queueAtom, rest);
    void this.prompt(text);
  }
}

/** Parallel tool calls can ask at the same time, so their dialogs open one after another. */
class DialogLine {
  private line = Promise.resolve();

  constructor(
    private readonly context: Context,
    private readonly abort: AbortController,
  ) {}

  open<T>(message: string, dialog: (done: (value: T) => void, cancel: () => void) => Dialog): Promise<T> {
    const { screen, notify } = this.context;
    const { signal } = this.abort;

    const show = () =>
      new Promise<T>((resolve, reject) => {
        if (signal.aborted) return reject(signal.reason);

        const shown = dialog(
          (value) => {
            screen.closePanel(shown.id);
            resolve(value);
          },
          () => this.abort.abort(),
        );

        screen.showDialog(shown);
        notify(message);

        signal.addEventListener(
          'abort',
          () => {
            screen.closePanel(shown.id);
            reject(signal.reason);
          },
          { once: true },
        );
      });

    const result = this.line.then(show);

    this.line = result.then(
      () => {},
      () => {},
    );

    return result;
  }
}
