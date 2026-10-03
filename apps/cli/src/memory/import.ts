import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type { MemoryScope, MemoryStore, MemoryType, NewMemory } from './store.js';

/** Where Claude Code's own memory types go in Jinion's. */
const TYPES: Record<string, { scope: MemoryScope; type: MemoryType }> = {
  user: { scope: 'user', type: 'preference' },
  feedback: { scope: 'user', type: 'preference' },
  project: { scope: 'project', type: 'decision' },
  reference: { scope: 'project', type: 'reference' },
};

/**
 * Brings in what Claude Code collected: its memory notes for this project, and the user's own instructions in
 * `~/.claude/rules` and `~/.claude/CLAUDE.md`. Notes whose title is already taken in their scope are skipped, so
 * importing twice adds nothing.
 */
export function importClaudeMemory(store: MemoryStore, cwd: string) {
  const config = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  const notes: NewMemory[] = [];

  const memories = join(config, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'), 'memory');
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
    const description = `From ${file.replace(homedir(), '~')}: ${firstLine(content)}`;
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

/** The flat and the nested (`metadata:`) keys of a frontmatter block, which is all Claude Code's notes use. */
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

/** `no-coauthor-in-commits` reads as `No coauthor in commits`. */
function humanize(name: string) {
  const words = name.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function firstLine(text: string) {
  const line = text.split('\n').find((candidate) => candidate.replace(/^#+\s*/, '').trim()) ?? '';
  const plain = line.replace(/^#+\s*/, '').trim();
  return plain.length > 120 ? `${plain.slice(0, 119)}…` : plain;
}
