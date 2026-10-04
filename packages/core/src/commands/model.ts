import { fuzzyFilter } from '../lib/fuzzy.js';
import type { ModelOption } from '../agent/models.js';
import type { Jinion } from '../controllers/jinion.js';
import type { Command } from './registry.js';

export const model: Command = {
  name: 'model',
  description: 'Switch the model and its effort',
  argumentHint: '[model]',
  run: (jinion, args) => {
    if (!args.trim()) return openModelPicker(jinion);

    const options = jinion.session.models.options();
    if (!options) return;

    const found = findModel(options, args);
    if (!found) return jinion.notice(`No model matches "${args.trim()}". Type /model to pick one.`, 'error');

    const { effort } = jinion.store.get(jinion.session.atoms.selection);

    jinion.session.models.select({ model: found.id, effort: effort && found.efforts.includes(effort) ? effort : undefined });
  },
};

export const effort: Command = {
  name: 'effort',
  description: 'Change how hard the model thinks',
  argumentHint: '[level]',
  run: (jinion, args) => {
    if (!args.trim()) return openModelPicker(jinion);

    const options = jinion.session.models.options();
    if (!options) return;

    const level = args.trim().toLowerCase();
    const { atoms } = jinion.session;
    const selection = jinion.store.get(atoms.selection);
    const name = jinion.store.get(atoms.modelName);
    const levels = options.find((option) => option.id === selection.model)?.efforts ?? [];
    if (levels.length === 0) return jinion.notice(`${name} has no effort setting.`, 'error');

    if (level !== 'default' && !levels.includes(level)) {
      return jinion.notice(`${name} takes ${[...levels, 'default'].join(', ')}.`, 'error');
    }

    jinion.session.models.select({ ...selection, effort: level === 'default' ? undefined : level });
  },
};

const openModelPicker = (jinion: Jinion) => jinion.screen.openView({ id: 'model' });

/** An exact id or name first, then the closest fuzzy match, so `/model sonnet` picks the `sonnet` alias. */
function findModel(models: ModelOption[], query: string) {
  const wanted = query.trim().toLowerCase();

  return (
    models.find((model) => model.id.toLowerCase() === wanted || model.name.toLowerCase() === wanted) ??
    fuzzyFilter(models, wanted, (model) => `${model.name} ${model.id}`)[0]?.item
  );
}
