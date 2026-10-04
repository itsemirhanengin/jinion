import { z } from 'zod';
import { Question, QuestionAnswer } from './questions.js';
import { TodoGroup } from './todos.js';

export const FileRef = z.object({ path: z.string(), lines: z.string().optional() });

export type FileRef = z.infer<typeof FileRef>;

export const GrepMatch = z.object({ file: z.string(), line: z.number(), text: z.string() });

export type GrepMatch = z.infer<typeof GrepMatch>;

export const SearchHit = z.object({ title: z.string(), url: z.string() });

export type SearchHit = z.infer<typeof SearchHit>;

const nothing = z.object({});

/** Each tool's input, and what its result holds beyond the call's output. */
const TOOLS = {
  read: { input: z.object({ files: z.array(FileRef) }), result: nothing },
  /** `files` is set when only file names were searched for, without matching lines. */
  grep: {
    input: z.object({ pattern: z.string(), path: z.string() }),
    result: z.object({ matches: z.array(GrepMatch), files: z.array(z.string()).optional() }),
  },
  glob: { input: z.object({ pattern: z.string() }), result: z.object({ files: z.array(z.string()) }) },
  /** The background task the command went on as, instead of an exit code. Codex sets no timeout. */
  bash: {
    input: z.object({ command: z.string(), timeoutMs: z.number().optional() }),
    result: z.object({ exitCode: z.number(), wallMs: z.number(), background: z.string().optional() }),
  },
  /** The input patch can be a preview; the result carries the applied one when it differs. */
  edit: {
    input: z.object({ path: z.string(), patch: z.string(), created: z.boolean().optional() }),
    result: z.object({ patch: z.string().optional() }),
  },
  todo: { input: z.object({ groups: z.array(TodoGroup) }), result: nothing },
  ask: { input: z.object({ questions: z.array(Question) }), result: z.object({ answers: z.array(QuestionAnswer) }) },
  memory: { input: z.object({ action: z.enum(['remember', 'recall', 'forget']), detail: z.string() }), result: nothing },
  plan: { input: z.object({ plan: z.string() }), result: nothing },
  /** What the page said to the prompt comes as the call's output. */
  fetch: {
    input: z.object({ url: z.string(), prompt: z.string() }),
    result: z.object({ bytes: z.number().optional(), code: z.number().optional(), codeText: z.string().optional() }),
  },
  search: {
    input: z.object({ query: z.string() }),
    result: z.object({ hits: z.array(SearchHit), searches: z.number().optional(), durationMs: z.number().optional() }),
  },
  /** Its result comes as the call's output. */
  mcp: { input: z.object({ server: z.string(), tool: z.string(), arguments: z.string().optional() }), result: nothing },
  other: { input: z.object({ title: z.string(), detail: z.string().optional() }), result: nothing },
  /** Its tool calls come with this call's id as `parent`, also after it went on as the `background` task. */
  agent: { input: z.object({ description: z.string(), kind: z.string().optional() }), result: z.object({ background: z.string().optional() }) },
};

type ToolSchemas = typeof TOOLS;

export type Tools = { [N in keyof ToolSchemas]: { input: z.infer<ToolSchemas[N]['input']>; result: z.infer<ToolSchemas[N]['result']> } };

export type ToolName = keyof Tools;

export type ToolCall = { [N in ToolName]: { name: N; input: Tools[N]['input'] } }[ToolName];

export type ToolResult = Tools[ToolName]['result'];

export type ToolRun = { [N in ToolName]: { name: N; input: Tools[N]['input']; result?: Tools[N]['result'] } }[ToolName];

const NAMES = Object.keys(TOOLS) as ToolName[];

// The unions are built from the table, so their types come from the mapped types above rather than from the build.
const byName = <T extends z.ZodObject>(variant: (name: ToolName) => T) => NAMES.map(variant) as [T, ...T[]];

export const ToolCall = z.discriminatedUnion(
  'name',
  byName((name) => z.object({ name: z.literal(name), input: TOOLS[name].input })),
) as unknown as z.ZodType<ToolCall>;

export const ToolRun = z.discriminatedUnion(
  'name',
  byName((name) => z.object({ name: z.literal(name), input: TOOLS[name].input, result: TOOLS[name].result.optional() })),
) as unknown as z.ZodType<ToolRun>;

export const ToolResult = z.union(NAMES.map((name) => TOOLS[name].result) as [z.ZodObject, ...z.ZodObject[]]) as unknown as z.ZodType<ToolResult>;
