/** `@src/app.tsx` or `@"docs/release notes.md"`, at the start of the text or after whitespace, so emails don't count. */
export const MENTION = /(?<=^|\s)@(?:"[^"\n]+"|[^\s"]+)/g;

/** How a path goes into the prompt; paths with spaces are quoted. */
export const mention = (path: string) => (/\s/.test(path) ? `@"${path}"` : `@${path}`);
