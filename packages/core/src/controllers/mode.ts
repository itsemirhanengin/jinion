import type { AgentMode } from '../agent/agent.js';
import { errorMessage } from '../lib/errors.js';
import { saveProjectSettings } from '../settings/project.js';
import { modeAtom } from '../state/agent.js';
import { MODES, nextMode } from '../agent/modes.js';
import type { Context } from './context.js';

export class ModeController {
  private switches = Promise.resolve();

  constructor(private readonly context: Context) {}

  get current() {
    return this.context.store.get(modeAtom);
  }

  select(next: AgentMode) {
    const { agent, notice } = this.context;
    if (!agent.modes.includes(next)) return notice(`${agent.name} has no ${MODES[next].name} mode.`, 'warning');

    this.keep(next);

    this.switches = this.switches
      .then(() => agent.setMode(next))
      .catch((error: unknown) => notice(`Couldn't switch the mode: ${errorMessage(error)}`, 'error'));
  }

  cycle() {
    this.select(nextMode(this.context.agent.modes, this.current));
  }

  show(mode: AgentMode) {
    this.context.store.set(modeAtom, mode);
  }

  keep(mode: AgentMode) {
    this.show(mode);
    saveProjectSettings(this.context.info.cwd, { mode });
  }
}
