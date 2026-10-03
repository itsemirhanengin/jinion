import { fuzzyFilter } from '@jinion/tui';
import type { ModelOption } from '@jinion/tui/chat';
import type { Jinion } from '../controllers/jinion.js';
import { ModelPicker } from '../panels/model.js';
import { selectionAtom, modelNameAtom } from '../state/agent.js';
import type { Command } from './registry.js';

const openModelPicker = (jinion: Jinion) => jinion.screen.openPanel({ id: 'model', placement: 'bottom', element: <ModelPicker /> });

/** An exact id or name first, then the closest fuzzy match, so `/model sonnet` picks the `sonnet` alias. */
function findModel(models: ModelOption[], query: string) {
  const wanted = query.trim().toLowerCase();
  return (
    models.find((model) => model.id.toLowerCase() === wanted || model.name.toLowerCase() === wanted) ??
    fuzzyFilter(models, wanted, (model) => `${model.name} ${model.id}`)[0]?.item
  );
}

export const model: Command = {
  name: 'model',
  description: 'Switch the model and its effort',
  argumentHint: '[model]',
  run: (jinion, args) => {
    if (!args.trim()) return openModelPicker(jinion);
    const options = jinion.models.options();
    if (!options) return;
    const found = findModel(options, args);
    if (!found) return jinion.notice(`No model matches "${args.trim()}". Type /model to pick one.`, 'error');
    const { effort } = jinion.store.get(selectionAtom);
    jinion.models.select({ model: found.id, effort: effort && found.efforts.includes(effort) ? effort : undefined });
  },
};

export const effort: Command = {
  name: 'effort',
  description: 'Change how hard the model thinks',
  argumentHint: '[level]',
  run: (jinion, args) => {
    if (!args.trim()) return openModelPicker(jinion);
    const options = jinion.models.options();
    if (!options) return;
    const level = args.trim().toLowerCase();
    const selection = jinion.store.get(selectionAtom);
    const name = jinion.store.get(modelNameAtom);
    const levels = options.find((option) => option.id === selection.model)?.efforts ?? [];
    if (levels.length === 0) return jinion.notice(`${name} has no effort setting.`, 'error');
    if (level !== 'default' && !levels.includes(level)) {
      return jinion.notice(`${name} takes ${[...levels, 'default'].join(', ')}.`, 'error');
    }
    jinion.models.select({ ...selection, effort: level === 'default' ? undefined : level });
  },
};
