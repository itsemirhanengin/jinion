import type { AgentBackend } from '../agent/agent.js';
import { modelLabel, type ModelOption, type ModelSelection } from '../agent/models.js';
import { errorMessage } from '../lib/errors.js';
import { firstLine } from '../lib/text.js';
import { saveAgent, saveModel } from '../settings/user.js';
import { modelsAtom } from '../state/agent.js';
import { BUSY, type SessionContext } from './context.js';
import type { Jinion } from './jinion.js';

export interface ModelChoice {
  agent: string;
  model: ModelOption;
}

/** The models come from the backends; each session picks its own, on any of them. */
export class ModelController {
  constructor(
    private readonly context: SessionContext,
    private readonly app: Jinion,
    private readonly switchTo: (backend: AgentBackend, selection: ModelSelection) => void,
  ) {}

  /** Every backend's models listed so far, the session's own first. */
  choices(): ModelChoice[] {
    const { backend, store } = this.context;
    const listed = store.get(modelsAtom);

    this.app.loadAll();

    return [backend, ...this.app.backends.filter((other) => other !== backend)].flatMap(({ name }) =>
      (listed[name] ?? []).map((model) => ({ agent: name, model })),
    );
  }

  /** The backends still listing their models. */
  listing() {
    const listed = this.context.store.get(modelsAtom);

    return this.app.backends.filter(({ name }) => !listed[name]).map(({ name }) => name);
  }

  /** On another backend, the conversation moves there. Later sessions start with it too. */
  select(next: ModelSelection, agent = this.context.backend.name) {
    const { backend, store, atoms, notice } = this.context;
    if (agent !== backend.name) return this.move(this.app.named(agent), next);

    const before = store.get(atoms.modelLabel);
    const waits = this.context.agent.modelPerTurn && store.get(atoms.working);

    this.context.agent.select(next).then(
      () => {
        store.set(atoms.selection, next);
        saveModel(backend.name, next);
        saveAgent(backend.name);

        const label = store.get(atoms.modelLabel);

        notice(waits ? `Switched to ${label}. The running turn finishes on ${before}; your next message uses ${label}.` : `Switched to ${label}.`);
      },
      (error: unknown) => notice(`Couldn't switch the model: ${errorMessage(error)}`, 'error'),
    );
  }

  private move(backend: AgentBackend, next: ModelSelection) {
    const { store, atoms, notice } = this.context;
    if (store.get(atoms.working)) return notice(BUSY, 'warning');

    const running = store.get(atoms.backgroundTasks).filter((task) => task.status === 'running');
    const started = store.get(atoms.entries).some((entry) => entry.kind === 'user');

    this.switchTo(backend, next);
    saveModel(backend.name, next);
    saveAgent(backend.name);

    const label = modelLabel(next, store.get(modelsAtom)[backend.name]);
    const stopped = running.length > 0 ? ` Stopped what ran in the background: ${running.map((task) => firstLine(task.title)).join(', ')}.` : '';
    const handover = started ? ' It reads the conversation so far with your next message.' : '';

    notice(`Switched to ${label} on ${backend.name}.${handover}${stopped}`);
  }
}
