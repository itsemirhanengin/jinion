import { fuzzyFilter, ModelPanel, usePanel, type ModelOption } from '@jinion/tui';
import { useJinion } from '../context.js';

/** `/model` and `/effort`: the agent's models with their effort levels. */
export function ModelPicker() {
  const app = useJinion();
  const { close } = usePanel();

  return (
    <ModelPanel
      models={app.model.options}
      current={app.model.selection}
      subtitle={app.model.agent}
      onSelect={(selection) => {
        close();
        app.actions.selectModel(selection);
      }}
      onCancel={close}
    />
  );
}

/** An exact id or name first, then the closest fuzzy match, so `/model sonnet` picks the `sonnet` alias. */
export function findModel(models: ModelOption[], query: string) {
  const wanted = query.trim().toLowerCase();
  return (
    models.find((model) => model.id.toLowerCase() === wanted || model.name.toLowerCase() === wanted) ??
    fuzzyFilter(models, wanted, (model) => `${model.name} ${model.id}`)[0]?.item
  );
}
