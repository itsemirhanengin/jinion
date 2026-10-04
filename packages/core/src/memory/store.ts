import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { jinionHome, projectDir } from '../lib/paths.js';
import { frontmatter } from '../lib/text.js';
import { type Memory, MemoryScope, MemoryType, type NewMemory } from './types.js';

/** One markdown file per note, so they can be read and edited by hand. */
export class MemoryStore {
  constructor(private readonly cwd: string) {}

  dir(scope: MemoryScope) {
    return scope === 'user' ? join(jinionHome(), 'memory') : join(projectDir(this.cwd), 'memory');
  }

  path(memory: Pick<Memory, 'scope' | 'id'>) {
    return join(this.dir(memory.scope), `${memory.id}.md`);
  }

  list(): Memory[] {
    return MemoryScope.options.flatMap((scope) => {
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

  find(name: string) {
    const [scope, id] = name.split('/') as [MemoryScope, string | undefined];

    return this.list().find((memory) => memory.scope === scope && memory.id === id);
  }

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
  const parsed = frontmatter(text);
  if (!parsed) return undefined;

  const { fields, body } = parsed;
  const type = MemoryType.safeParse(fields.type).data ?? 'fact';

  return {
    scope,
    id,
    title: fields.title || id,
    description: fields.description || fields.title || id,
    type,
    updated: fields.updated ?? '',
    content: body.trim(),
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
