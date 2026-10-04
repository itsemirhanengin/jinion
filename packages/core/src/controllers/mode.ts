import type { AgentMode } from '../agent/agent.js';
import { errorMessage } from '../lib/errors.js';
import { saveProjectSettings } from '../settings/project.js';
import { MODES, nextMode } from '../agent/modes.js';
import type { SessionContext } from './context.js';

export class ModeController {
  private switches = Promise.resolve();

  constructor(private readonly context: SessionContext) {}

  get current() {
    return this.context.store.get(this.context.atoms.mode);
  }

  select(next: AgentMode) {
    const { backend, agent, notice } = this.context;
    if (!backend.modes.includes(next)) return notice(`${backend.name} has no ${MODES[next].name} mode.`, 'warning');

    this.keep(next);

    this.switches = this.switches
      .then(() => agent.setMode(next))
      .catch((error: unknown) => notice(`Couldn't switch the mode: ${errorMessage(error)}`, 'error'));
  }

  cycle() {
    this.select(nextMode(this.context.backend.modes, this.current));
  }

  show(mode: AgentMode) {
    this.context.store.set(this.context.atoms.mode, mode);
  }

  /** The project starts its next session in it too. */
  keep(mode: AgentMode) {
    this.show(mode);
    saveProjectSettings(this.context.info.cwd, { mode });
  }
}
