export interface CompletionItem {
  key: string;
  label: string;
  positions?: number[];
  hint?: string;
  description?: string;
  tag?: string;
  group?: string;
  insert: string;
  submit?: boolean;
}

export interface Completion {
  from: number;
  to: number;
  items: CompletionItem[];
  submit?: boolean;
}

export type CompletionSource = (value: string, cursor: number) => Completion | undefined;
