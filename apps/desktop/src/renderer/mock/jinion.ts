import type { AgentMode } from '@jinion/core/agent/agent';
import type { ModelSelection } from '@jinion/core/agent/models';
import type { PermissionDecision } from '@jinion/core/agent/permissions';
import type { BackgroundTask } from '@jinion/core/agent/tasks';
import type { MemoryNote, SavedSummary, SessionFields, SessionSnapshot, Sessions } from '@jinion/core/api/schemas';
import { type Action, reduce, type TurnOutcome } from '@jinion/core/conversation/reducer';
import { createSessionState, firstPrompt, type SessionState } from '@jinion/core/conversation/session';
import { atom, type createStore, type PrimitiveAtom } from 'jotai';
import { memory, models, skills } from './catalog.js';
import { sampleFiles } from './files.js';
import type { Project } from './projects.js';
import { plan, scenarioFor } from './scenarios.js';
import { Script, type Stage } from './script.js';

type Store = ReturnType<typeof createStore>;

interface Turn {
  abort: AbortController;
  answer?: (decision: PermissionDecision) => void;
}

const CONTEXT_WINDOW = 200_000;

const fields: SessionFields = {
  agent: 'Claude',
  features: { steer: true, rewind: true, context: true, background: true, compact: true },
  selection: { model: 'claude-opus-4-6' },
  mode: 'edits',
  tasks: [],
  queue: [],
  wantsWorktree: false,
  working: false,
};

/**
 * Stands in for the core while the desktop app runs on sample data: the same shapes the API sends, the conversation
 * changed by the core's own reducer, and replies played from scripted scenarios.
 */
export class MockJinion {
  readonly sessionsAtom = atom<Sessions>({ sessions: [] });
  readonly savedAtom = atom<SavedSummary[]>([]);
  readonly memoryAtom = atom<MemoryNote[]>(memory);
  readonly filesAtom: PrimitiveAtom<Record<string, string>>;
  readonly models = models;
  readonly skills = skills;
  /** What the core would show as a desktop notification. */
  onNotify?: (title: string, body: string) => void;
  private readonly snapshots = new Map<string, PrimitiveAtom<SessionSnapshot>>();
  private readonly saved = new Map<string, SessionState & { updatedAt: number }>();
  private readonly turns = new Map<string, Turn>();

  constructor(
    private readonly store: Store,
    readonly project: Project,
  ) {
    this.filesAtom = atom(sampleFiles(project.name));

    const hour = 3_600_000;

    const past = project.id === 'acme-api'
      ? [
          { prompt: 'Explain how the job queue works', ago: 1.2 * hour },
          { prompt: 'Start the dev server', ago: 26 * hour },
          { prompt: 'Hi', ago: 30 * 24 * hour },
        ]
      : [{ prompt: 'Explain how the job queue works', ago: 50 * hour }];

    this.open();
    void this.seed(past);
  }

  session(id: string) {
    const known = this.snapshots.get(id);
    if (known) return known;

    throw new Error(`No session ${id} is open.`);
  }

  open() {
    const state = createSessionState(CONTEXT_WINDOW);

    this.snapshots.set(state.id, atom<SessionSnapshot>({ state, fields, seq: 0 }));
    this.store.set(this.sessionsAtom, ({ sessions }) => ({ sessions: [...sessions, { id: state.id, working: false }], active: state.id }));

    return state.id;
  }

  /** Opens a saved thread in a tab, or goes to its tab when it is open. */
  resume(id: string) {
    if (this.snapshots.has(id)) return this.activate(id);

    const saved = this.saved.get(id);
    if (!saved) return;

    const { updatedAt: _, ...state } = saved;

    this.snapshots.set(id, atom<SessionSnapshot>({ state, fields, seq: 0 }));
    this.store.set(this.sessionsAtom, ({ sessions }) => ({ sessions: [...sessions, { id, title: state.title, working: false }], active: id }));
    this.publishSaved();
  }

  activate(id: string) {
    this.store.set(this.sessionsAtom, (sessions) => ({ ...sessions, active: id }));
  }

  /** The thread stays in the sidebar unless nothing was asked in it. */
  close(id: string) {
    this.turns.get(id)?.abort.abort();

    const { state } = this.store.get(this.session(id));

    if (firstPrompt(state)) this.saved.set(id, { ...state, busySince: undefined, turnFrom: undefined, updatedAt: Date.now() });
    this.snapshots.delete(id);

    this.store.set(this.sessionsAtom, ({ sessions, active }) => {
      const index = sessions.findIndex((session) => session.id === id);
      const left = sessions.filter((session) => session.id !== id);
      const next = active === id ? (left[index] ?? left[index - 1])?.id : active;

      return { sessions: left, active: next };
    });

    this.publishSaved();
  }

  submit(id: string, text: string) {
    const { fields } = this.store.get(this.session(id));

    if (fields.working) return this.setFields(id, { queue: [...fields.queue, { text }] });

    void this.play(id, text);
  }

  unqueue(id: string, index: number) {
    const { fields } = this.store.get(this.session(id));

    this.setFields(id, { queue: fields.queue.filter((_, position) => position !== index) });
  }

  interrupt(id: string) {
    this.turns.get(id)?.abort.abort(new DOMException('Interrupted', 'AbortError'));
  }

  answer(id: string, decision: PermissionDecision) {
    const turn = this.turns.get(id);

    this.setFields(id, { dialog: undefined });
    turn?.answer?.(decision);
  }

  setMode(id: string, mode: AgentMode) {
    this.setFields(id, { mode });
  }

  setWorktree(id: string, on: boolean) {
    this.setFields(id, { wantsWorktree: on });
  }

  /** Goes back to before a message, and gives back its text to send again. */
  rewind(id: string, entry: string) {
    const { state, fields } = this.store.get(this.session(id));
    const message = state.entries.find((each) => each.id === entry);
    if (fields.working || message?.kind !== 'user') return undefined;

    this.dispatch(id, { type: 'rewind', entry });

    return message.text;
  }

  setModel(id: string, selection: ModelSelection, agent: string) {
    const { fields } = this.store.get(this.session(id));

    if (agent !== fields.agent) this.dispatch(id, { type: 'switch-agent', agent });
    this.setFields(id, { selection, agent });
  }

  stopTask(id: string, task: string) {
    const { fields } = this.store.get(this.session(id));

    this.setFields(id, { tasks: fields.tasks.map((each) => (each.id === task ? { ...each, status: 'stopped', endedAt: Date.now() } : each)) });
  }

  forget(note: MemoryNote) {
    this.store.set(this.memoryAtom, (notes) => notes.filter((each) => !(each.scope === note.scope && each.id === note.id)));
  }

  private async play(id: string, text: string) {
    const turn: Turn = { abort: new AbortController() };
    const scenario = scenarioFor(text);
    const planning = this.store.get(this.session(id)).fields.mode === 'plan';
    let outcome: TurnOutcome = 'done';

    this.turns.set(id, turn);
    this.dispatch(id, { type: 'submit', text });
    this.setFields(id, { working: true });

    try {
      const script = new Script(this.liveStage(id, turn));

      await (planning ? plan(script, text) : scenario.play(script, text));
    } catch (error) {
      outcome = turn.abort.signal.aborted ? 'interrupted' : 'failed';
      if (outcome === 'failed') console.error(error);
    }

    this.turns.delete(id);
    if (!this.snapshots.has(id)) return;

    const { usage } = this.store.get(this.session(id)).state;

    this.setFields(id, { dialog: undefined });
    this.dispatch(id, { type: 'event', event: { type: 'usage', usage: { ...usage, contextTokens: usage.contextTokens + 9_000 + text.length * 40 } } });
    this.dispatch(id, { type: 'finish', outcome });
    this.setFields(id, { working: false });

    const { state, fields } = this.store.get(this.session(id));

    if (outcome === 'done') this.onNotify?.(`jinion · ${this.project.name}`, `Done: ${state.title ?? text}`);

    const [next, ...rest] = fields.queue;

    if (next) {
      this.setFields(id, { queue: rest });
      void this.play(id, next.text);
    }
  }

  private liveStage(id: string, turn: Turn): Stage {
    const { signal } = turn.abort;

    return {
      instant: false,
      signal,
      mode: () => this.store.get(this.session(id)).fields.mode,
      advance: () => {},
      emit: (event) => this.dispatch(id, { type: 'event', event }),
      write: (path, content) => this.store.set(this.filesAtom, (files) => ({ ...files, [path]: content })),
      task: (task) => this.addTask(id, task),
      approve: (request) =>
        new Promise((resolve, reject) => {
          turn.answer = resolve;
          signal.addEventListener('abort', () => reject(signal.reason));
          this.setFields(id, { dialog: { id: 'permission', request } });
          this.onNotify?.(`jinion · ${this.project.name}`, request.title);
        }),
    };
  }

  private async seed(past: { prompt: string; ago: number }[]) {
    for (const { prompt, ago } of past) await this.record(prompt, Date.now() - ago);

    this.publishSaved();
  }

  /** A thread made up front: its scenario plays at once, on a clock that starts `at`. */
  private async record(prompt: string, at: number) {
    let state = createSessionState(CONTEXT_WINDOW);
    let clock = at;

    const apply = (action: Action) => {
      state = reduce(state, action, clock);
    };

    const stage: Stage = {
      instant: true,
      signal: new AbortController().signal,
      mode: () => 'edits',
      advance: (ms) => {
        clock += ms;
      },
      emit: (event) => apply({ type: 'event', event }),
      write: () => {},
      task: () => {},
      approve: async () => ({ allow: true }),
    };

    apply({ type: 'submit', text: prompt });
    await scenarioFor(prompt).play(new Script(stage), prompt);
    apply({ type: 'finish', outcome: 'done' });
    this.saved.set(state.id, { ...state, createdAt: at, updatedAt: clock });
  }

  private dispatch(id: string, action: Action) {
    this.store.set(this.session(id), (snapshot) => ({ ...snapshot, state: reduce(snapshot.state, action, Date.now()), seq: snapshot.seq + 1 }));
    this.summarize(id);
  }

  private setFields(id: string, changed: Partial<SessionFields>) {
    this.store.set(this.session(id), (snapshot) => ({ ...snapshot, fields: { ...snapshot.fields, ...changed } }));
    this.summarize(id);
  }

  private addTask(id: string, task: BackgroundTask) {
    const { fields } = this.store.get(this.session(id));

    this.setFields(id, { tasks: [...fields.tasks.filter((each) => each.id !== task.id), task] });
  }

  private summarize(id: string) {
    const { state, fields } = this.store.get(this.session(id));

    this.store.set(this.sessionsAtom, (sessions) => ({
      ...sessions,
      sessions: sessions.sessions.map((session) => (session.id === id ? { id, title: state.title, working: fields.working } : session)),
    }));
  }

  private publishSaved() {
    const summaries = [...this.saved.values()]
      .filter(({ id }) => !this.snapshots.has(id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((state) => ({
        id: state.id,
        title: state.title ?? firstPrompt(state) ?? 'Untitled',
        updatedAt: state.updatedAt,
        messages: state.entries.filter((entry) => entry.kind === 'user').length,
        firstPrompt: firstPrompt(state),
      }));

    this.store.set(this.savedAtom, summaries);
  }
}
