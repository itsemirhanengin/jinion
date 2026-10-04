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
