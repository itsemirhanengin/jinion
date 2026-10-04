import { fuzzyFilter } from '../lib/fuzzy.js';
import type { Jinion } from '../controllers/jinion.js';
import type { ModelChoice } from '../controllers/model.js';
import type { Command } from './registry.js';

export const model: Command = {
  name: 'model',
  description: "Switch the model, Claude's or Codex's, and its effort",
  argumentHint: '[model]',
  run: (jinion, args) => {
    if (!args.trim()) return openModelPicker(jinion);

    const { models } = jinion.session;
    const found = findModel(models.choices(), args);

    if (!found) {
      const listing = models.listing();
      const still = listing.length > 0 ? ` ${listing.join(' and ')} ${listing.length > 1 ? 'are' : 'is'} still listing models.` : '';

      return jinion.notice(`No model matches "${args.trim()}".${still} Type /model to pick one.`, 'error');
    }

    const { effort } = jinion.store.get(jinion.session.atoms.selection);
    const { agent, model: option } = found;

    models.select({ model: option.id, effort: effort && option.efforts.includes(effort) ? effort : undefined }, agent);
  },
};

export const effort: Command = {
  name: 'effort',
  description: 'Change how hard the model thinks',
  argumentHint: '[level]',
  run: (jinion, args) => {
    if (!args.trim()) return openModelPicker(jinion);

    const level = args.trim().toLowerCase();
    const { atoms, backend, models } = jinion.session;
    const selection = jinion.store.get(atoms.selection);
    const name = jinion.store.get(atoms.modelName);
    const own = models.choices().filter((choice) => choice.agent === backend.name);
    if (own.length === 0) return jinion.notice(`${backend.name} is still listing its models. Try again in a moment.`, 'warning');

    const levels = own.find((choice) => choice.model.id === selection.model)?.model.efforts ?? [];
    if (levels.length === 0) return jinion.notice(`${name} has no effort setting.`, 'error');

    if (level !== 'default' && !levels.includes(level)) {
      return jinion.notice(`${name} takes ${[...levels, 'default'].join(', ')}.`, 'error');
    }

    models.select({ ...selection, effort: level === 'default' ? undefined : level });
  },
};

const openModelPicker = (jinion: Jinion) => {
  jinion.loadAll();
  jinion.screen.openView({ id: 'model' });
};

/** An exact id or name first, then the closest fuzzy match, so `/model sonnet` picks the `sonnet` alias. */
function findModel(choices: ModelChoice[], query: string) {
  const wanted = query.trim().toLowerCase();

  return (
    choices.find(({ model }) => model.id.toLowerCase() === wanted || model.name.toLowerCase() === wanted) ??
    fuzzyFilter(choices, wanted, ({ agent, model }) => `${model.name} ${model.id} ${agent}`)[0]?.item
  );
}
