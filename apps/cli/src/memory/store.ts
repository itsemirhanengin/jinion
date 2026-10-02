import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { jinionHome, projectDir } from '../paths.js';

/** `user` notes are about the user and hold in every project; `project` notes belong to one project. */
export const MEMORY_SCOPES = ['user', 'project'] as const;
export const MEMORY_TYPES = ['preference', 'decision', 'fact', 'reference'] as const;

export type MemoryScope = (typeof MEMORY_SCOPES)[number];
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface Memory {
  scope: MemoryScope;
  /** Unique within its scope; `scope/id` names a note everywhere. */
  id: string;
  title: string;
  /** One line, for the index the agent sees in every conversation. */
  description: string;
  type: MemoryType;
  /** `YYYY-MM-DD` */
  updated: string;
  content: string;
}

export type NewMemory = Omit<Memory, 'id' | 'updated'> & { id?: string };

/**
 * Notes that carry over between conversations, one markdown file each with a small frontmatter, so they can be read
 * and edited by hand: `~/.jinion/memory` for the user, `~/.jinion/projects/<project>/memory` for the project.
 */
export class MemoryStore {
  constructor(private readonly cwd: string) {}

  dir(scope: MemoryScope) {
    return scope === 'user' ? join(jinionHome(), 'memory') : join(projectDir(this.cwd), 'memory');
  }

  path(memory: Pick<Memory, 'scope' | 'id'>) {
    return join(this.dir(memory.scope), `${memory.id}.md`);
  }

  list(): Memory[] {
    return MEMORY_SCOPES.flatMap((scope) => {
      const dir = this.dir(scope);
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((name) => name.endsWith('.md'))
        .flatMap((name) => {
          const memory = parse(scope, name.slice(0, -3), readFileSync(join(dir, name), 'utf8'));
          return memory ? [memory] : [];
        })
        .sort((a, b) => a.title.localeCompare(b.title));
    });
  }

  /** `user/id` or `project/id`. */
  find(name: string) {
    const [scope, id] = name.split('/') as [MemoryScope, string | undefined];
    return this.list().find((memory) => memory.scope === scope && memory.id === id);
  }

  /** Writes a new note, or replaces the one with `id`. */
  save(note: NewMemory): Memory {
    const taken = new Set(this.list().filter((memory) => memory.scope === note.scope).map((memory) => memory.id));
    const id = note.id && taken.has(note.id) ? note.id : unique(slug(note.id ?? note.title), taken);
    const memory: Memory = { ...note, id, updated: new Date().toISOString().slice(0, 10) };
    mkdirSync(this.dir(memory.scope), { recursive: true });
    writeFileSync(this.path(memory), format(memory));
    return memory;
  }

  remove(name: string) {
    const memory = this.find(name);
    if (memory) rmSync(this.path(memory));
    return memory;
  }
}

const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();

function format(memory: Memory) {
  return [
    '---',
    `title: ${oneLine(memory.title)}`,
    `description: ${oneLine(memory.description)}`,
    `type: ${memory.type}`,
    `updated: ${memory.updated}`,
    '---',
    '',
    memory.content.trim(),
    '',
  ].join('\n');
}

function parse(scope: MemoryScope, id: string, text: string): Memory | undefined {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) return undefined;
  const fields: Record<string, string> = Object.fromEntries(
    match[1]!.split('\n').flatMap((line) => {
      const colon = line.indexOf(':');
      return colon === -1 ? [] : [[line.slice(0, colon).trim(), line.slice(colon + 1).trim()]];
    }),
  );
  const type = (MEMORY_TYPES as readonly string[]).includes(fields.type ?? '') ? (fields.type as MemoryType) : 'fact';
  return {
    scope,
    id,
    title: fields.title || id,
    description: fields.description || fields.title || id,
    type,
    updated: fields.updated ?? '',
    content: match[2]!.trim(),
  };
}

function slug(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/, '') || 'note'
  );
}

function unique(id: string, taken: Set<string>) {
  if (!taken.has(id)) return id;
  let number = 2;
  while (taken.has(`${id}-${number}`)) number++;
  return `${id}-${number}`;
}
