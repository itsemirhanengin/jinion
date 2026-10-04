import type { ModelOption, ModelSelection } from '../agent/models.js';
import { errorMessage } from '../lib/errors.js';
import { saveModel } from '../settings/user.js';
import { modelLabelAtom, modelsAtom, selectionAtom } from '../state/agent.js';
import type { Context } from './context.js';

export class ModelController {
  constructor(private readonly context: Context) {}

  load() {
    const { backend, store } = this.context;

    store.set(modelsAtom, undefined);

    backend.models().then(
      (models) => store.set(modelsAtom, models),
      () => store.set(modelsAtom, []),
    );
  }

  /** `undefined` after telling the user they are not known yet. */
  options(): ModelOption[] | undefined {
    const { backend, store, notice } = this.context;
    const options = store.get(modelsAtom);

    if (!options) notice(`${backend.name} is still listing its models. Try again in a moment.`, 'warning');

    return options;
  }

  select(next: ModelSelection) {
    const { backend, agent, store, notice } = this.context;

    agent.select(next).then(
      () => {
        store.set(selectionAtom, next);
        saveModel(backend.name, next);
        notice(`Switched to ${store.get(modelLabelAtom)}.`);
      },
      (error: unknown) => notice(`Couldn't switch the model: ${errorMessage(error)}`, 'error'),
    );
  }
}
