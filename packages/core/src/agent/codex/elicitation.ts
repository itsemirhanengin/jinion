import type { RunContext } from '../agent.js';
import type { Question, QuestionAnswer } from '../questions.js';

type Field = {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  title?: string;
  description?: string;
  enum?: string[];
  enumNames?: string[];
  oneOf?: { const: string; title: string }[];
  items?: { enum?: string[]; anyOf?: { const: string; title: string }[] };
};

export type Elicitation = { serverName: string } & (
  | { mode: 'form'; message: string; requestedSchema: { properties: Record<string, Field | undefined> } }
  | { mode: 'url'; message: string; url: string }
  | { mode: string; message?: string }
);

export interface ElicitationAnswer {
  action: 'accept' | 'decline' | 'cancel';
  content: Record<string, unknown> | null;
  _meta: null;
}

const declined: ElicitationAnswer = { action: 'decline', content: null, _meta: null };

/**
 * What an MCP server asks the user through Codex: a form becomes questions, a field each, and a page to open a
 * permission to go on once it is open. Codex's own kinds of request are declined, which lets the call go on.
 */
export async function elicit(request: Elicitation, turn: RunContext | undefined): Promise<ElicitationAnswer> {
  if (!turn) return declined;

  try {
    if (request.mode === 'url' && 'url' in request) {
      const decision = await turn.approve({
        title: `${request.serverName} wants you to open a page`,
        subject: request.url,
        description: request.message || undefined,
      });

      return decision.allow ? { action: 'accept', content: null, _meta: null } : declined;
    }

    if (request.mode !== 'form' || !('requestedSchema' in request)) return declined;

    const fields = Object.entries(request.requestedSchema.properties).flatMap(([key, field]) => (field ? [{ key, field, choices: choicesOf(field) }] : []));

    const questions: Question[] = fields.map(({ key, field, choices }, index) => {
      const label = [field.title ?? key, field.description].filter(Boolean).join(': ');

      return {
        id: key,
        prompt: index === 0 ? `${request.serverName}: ${request.message}\n\n${label}` : label,
        options: choices.map(({ title }) => ({ label: title })),
        multiple: field.type === 'array' || undefined,
        other: choices.length === 0 || undefined,
      };
    });

    const answers = await turn.ask(questions);

    return { action: 'accept', content: Object.fromEntries(fields.map((field, index) => [field.key, answered(field, answers[index])])), _meta: null };
  } catch {
    return { action: 'cancel', content: null, _meta: null };
  }
}

function choicesOf(field: Field) {
  if (field.type === 'boolean') return [{ title: 'Yes', value: true }, { title: 'No', value: false }];

  const options = field.oneOf ?? field.items?.anyOf;
  if (options) return options.map((option) => ({ title: option.title, value: option.const }));

  const values = field.enum ?? field.items?.enum ?? [];

  return values.map((value, index) => ({ title: field.enumNames?.[index] ?? value, value }));
}

function answered({ field, choices }: { field: Field; choices: { value: unknown }[] }, answer: QuestionAnswer | undefined) {
  const picked = (answer?.options ?? []).map((option) => choices[option]?.value);

  if (field.type === 'array') return picked;
  if (picked.length > 0) return picked[0];
  if (field.type === 'number' || field.type === 'integer') return Number(answer?.text);

  return answer?.text ?? '';
}
