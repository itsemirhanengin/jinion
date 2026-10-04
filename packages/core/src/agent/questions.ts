import { z } from 'zod';

export const QuestionOption = z.object({
  label: z.string(),
  description: z.string().optional(),
  recommended: z.boolean().optional(),
});

export type QuestionOption = z.infer<typeof QuestionOption>;

export const Question = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(QuestionOption),
  multiple: z.boolean().optional(),
  /** `false` leaves out the answer typed in its own words. */
  other: z.boolean().optional(),
});

export type Question = z.infer<typeof Question>;

export const QuestionAnswer = z.object({
  options: z.array(z.number().int().nonnegative()),
  text: z.string().optional(),
  note: z.string().optional(),
});

export type QuestionAnswer = z.infer<typeof QuestionAnswer>;
