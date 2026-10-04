export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  efforts: string[];
}

export interface ModelSelection {
  model: string;
  effort?: string;
}

/** The id stands in until the models are known, or for one the backend doesn't list. */
export const modelName = ({ model }: ModelSelection, models: ModelOption[] | undefined) =>
  models?.find((option) => option.id === model)?.name ?? model;

export function modelLabel(selection: ModelSelection, models: ModelOption[] | undefined) {
  const name = modelName(selection, models);

  return selection.effort ? `${name} · ${selection.effort}` : name;
}
