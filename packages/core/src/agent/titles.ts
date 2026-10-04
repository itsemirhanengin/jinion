import { firstLine, truncate } from '../lib/text.js';

/** What a small model is told to name a conversation, whichever backend runs it. */
export const TITLE_INSTRUCTIONS = `You name conversations between a developer and a coding agent, so the developer can find them again in a list of many.

Reply with the title only, never an explanation, also when there is little to name: a noun phrase of 3 to 6 words, in the language the developer writes in (also when their messages are short), sentence case, no quotes, no trailing period. Write names of files, functions and commands exactly as they are, e.g. math.ts.
Name what the conversation as a whole works on: what is being built, fixed, investigated or decided, and where; not just its latest message. A greeting or small talk is not work; when there is nothing else yet, name what the developer asked about, or the greeting itself.
When a current title is given and it still fits the conversation as a whole, reply with it unchanged. It no longer fits when it names a greeting or small talk and there is work now, or names only a part of work that has grown.`;

export const titlePrompt = (digest: string, current?: string) =>
  [current && `Current title: ${current}`, `The conversation:\n${digest}`].filter(Boolean).join('\n\n');

/** Longer than a title: the model explained itself instead. */
const MAX_WORDS = 10;

export function cleanTitle(reply: string) {
  const line = firstLine(reply.trim()).replace(/^title:\s*/i, '').replace(/^["'“”‘’`*]+|["'“”‘’`*.]+$/g, '').trim();
  if (!line || line.split(/\s+/).length > MAX_WORDS) return undefined;

  return truncate(line, 80);
}
