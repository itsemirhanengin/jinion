export interface QuestionOption {
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface Question {
  id: string;
  prompt: string;
  options: QuestionOption[];
  multiple?: boolean;
}

export interface QuestionAnswer {
  options: number[];
  text?: string;
  note?: string;
}
