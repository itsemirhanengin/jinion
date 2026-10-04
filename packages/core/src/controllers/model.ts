import type { ModelOption, ModelSelection } from '../agent/models.js';
import { errorMessage } from '../lib/errors.js';
import { saveModel } from '../settings/user.js';
import { modelsAtom } from '../state/agent.js';
import type { SessionContext } from './context.js';

/** The models come from the app; each session picks its own. */
export class ModelController {
  constructor(private readonly context: SessionContext) {}

  /** `undefined` after telling the user they are not known yet. */
  options(): ModelOption[] | undefined {
    const { backend, store, notice } = this.context;
    const options = store.get(modelsAtom);

    if (!options) notice(`${backend.name} is still listing its models. Try again in a moment.`, 'warning');

    return options;
  }

  /** Later sessions start with it too. */
  select(next: ModelSelection) {
    const { backend, agent, atoms, store, notice } = this.context;

    agent.select(next).then(
      () => {
        store.set(atoms.selection, next);
        saveModel(backend.name, next);
        notice(`Switched to ${store.get(atoms.modelLabel)}.`);
      },
      (error: unknown) => notice(`Couldn't switch the model: ${errorMessage(error)}`, 'error'),
    );
  }
}
