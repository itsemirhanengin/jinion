const REFERENCE = /^(?:\.\/)?([\w@.-][\w@./-]*\.\w+)(?::(\d+)(?:-(\d+))?)?$/;

/**
 * A file the agent named in its words, such as `src/files.ts`, `files.ts:27` or `files.ts:27-40`, when it is one of
 * the project's files; a bare name counts only when a single file has it. `lines` is as the file tab takes them.
 */
export function fileReference(code: string, files: string[]): { path: string; lines?: string } | undefined {
  const match = REFERENCE.exec(code.trim());
  if (!match) return undefined;

  const [, name, from, to] = match;
  const candidates = files.includes(name!) ? [name!] : files.filter((file) => file.endsWith(`/${name}`));
  if (candidates.length !== 1) return undefined;

  return { path: candidates[0]!, lines: from ? `${from}-${to ?? from}` : undefined };
}
