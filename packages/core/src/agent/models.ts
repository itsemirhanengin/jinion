import { z } from 'zod';

export const ModelOption = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  efforts: z.array(z.string()),
});

export type ModelOption = z.infer<typeof ModelOption>;

export const ModelSelection = z.object({ model: z.string(), effort: z.string().optional() });

export type ModelSelection = z.infer<typeof ModelSelection>;

/** The id stands in until the models are known, or for one the backend doesn't list. */
export const modelName = ({ model }: ModelSelection, models: ModelOption[] | undefined) =>
  models?.find((option) => option.id === model)?.name ?? model;

export function modelLabel(selection: ModelSelection, models: ModelOption[] | undefined) {
  const name = modelName(selection, models);

  return selection.effort ? `${name} · ${selection.effort}` : name;
}
