import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { claudeConfigDir } from '../agent/claude/paths.js';
import { projectSlug, tildify } from '../lib/paths.js';
import { truncate } from '../lib/text.js';
import type { MemoryStore } from './store.js';
import type { MemoryScope, MemoryType, NewMemory } from './types.js';

const TYPES: Record<string, { scope: MemoryScope; type: MemoryType }> = {
  user: { scope: 'user', type: 'preference' },
  feedback: { scope: 'user', type: 'preference' },
  project: { scope: 'project', type: 'decision' },
  reference: { scope: 'project', type: 'reference' },
};

/** Notes whose title is already taken in their scope are skipped, so importing twice adds nothing. */
export function importClaudeMemory(store: MemoryStore, cwd: string) {
  const config = claudeConfigDir();
  const notes: NewMemory[] = [];

  const memories = join(config, 'projects', projectSlug(cwd), 'memory');

  for (const file of markdownFiles(memories)) {
    if (basename(file) === 'MEMORY.md') continue;

    const { fields, body } = frontmatter(readFileSync(file, 'utf8'));
    const { scope, type } = TYPES[fields.type ?? ''] ?? { scope: 'project', type: 'fact' };
    const title = humanize(fields.name ?? basename(file, '.md'));

    notes.push({ scope, type, title, description: fields.description ?? title, content: body });
  }

  const rules = [...markdownFiles(join(config, 'rules')), join(config, 'CLAUDE.md')].filter((file) => existsSync(file));

  for (const file of rules) {
    const content = readFileSync(file, 'utf8').trim();
    if (!content) continue;

    const title = basename(file) === 'CLAUDE.md' ? 'Global instructions' : humanize(basename(file, '.md'));
    const description = `From ${tildify(file)}: ${headline(content)}`;

    notes.push({ scope: 'user', type: 'preference', title, description, content });
  }

  const taken = new Set(store.list().map((memory) => `${memory.scope}:${memory.title.toLowerCase()}`));
  const added = notes.filter((note) => !taken.has(`${note.scope}:${note.title.toLowerCase()}`));

  for (const note of added) store.save(note);

  return { added: added.length, skipped: notes.length - added.length };
}

function markdownFiles(dir: string) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(dir, name));
}

/** Flat and nested (`metadata:`) keys only, which is all Claude Code's notes use. */
function frontmatter(text: string) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) return { fields: {} as Record<string, string>, body: text.trim() };

  const fields: Record<string, string> = {};

  for (const line of match[1]!.split('\n')) {
    const field = /^\s*([\w-]+):\s*(.*)$/.exec(line);

    if (field?.[2]) fields[field[1]!] = field[2].replace(/^["']|["']$/g, '');
  }

  return { fields, body: match[2]!.trim() };
}

function humanize(name: string) {
  const words = name.replace(/[-_]+/g, ' ').trim();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

function headline(markdown: string) {
  const line = markdown.split('\n').find((candidate) => candidate.replace(/^#+\s*/, '').trim()) ?? '';

  return truncate(line.replace(/^#+\s*/, '').trim(), 120);
}
