export const firstLine = (text: string) => text.split('\n')[0] ?? '';

export const firstFilledLine = (text: string) => text.split('\n').find((line) => line.trim()) ?? text;

export const truncate = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

export const clip = (text: string, length: number) => truncate(text.replace(/\s+/g, ' ').trim(), length);

export const quote = (text: string, length = 60) => `“${firstLine(text).slice(0, length)}”`;

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function frontmatter(source: string): { fields: Record<string, string>; body: string } | undefined {
  const match = FRONTMATTER.exec(source);
  if (!match) return undefined;
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { fields, body: match[2]! };
}
