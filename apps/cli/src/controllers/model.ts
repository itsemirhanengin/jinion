import type { ModelOption, ModelSelection } from '@jinion/tui/chat';
import { errorMessage } from '../lib/errors.js';
import { saveModel } from '../settings/user.js';
import { modelLabelAtom, modelsAtom, selectionAtom } from '../state/agent.js';
import type { Context } from './context.js';

export class ModelController {
  constructor(private readonly context: Context) {}

  load() {
    const { agent, store } = this.context;
    store.set(modelsAtom, undefined);
    agent.models().then(
      (models) => store.set(modelsAtom, models),
      () => store.set(modelsAtom, []),
    );
  }

  /** `undefined` after telling the user they are not known yet. */
  options(): ModelOption[] | undefined {
    const { agent, store, notice } = this.context;
    const options = store.get(modelsAtom);
    if (!options) notice(`${agent.name} is still listing its models. Try again in a moment.`, 'warning');
    return options;
  }

  select(next: ModelSelection) {
    const { agent, store, notice } = this.context;
    agent.select(next).then(
      () => {
        store.set(selectionAtom, next);
        saveModel(agent.name, next);
        notice(`Switched to ${store.get(modelLabelAtom)}.`);
      },
      (error: unknown) => notice(`Couldn't switch the model: ${errorMessage(error)}`, 'error'),
    );
  }
}
