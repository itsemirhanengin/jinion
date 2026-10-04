import { importClaudeMemory } from '../memory/import.js';
import { plural } from '../lib/format.js';
import { truncate } from '../lib/text.js';
import type { Command } from './registry.js';

export const remember: Command = {
  name: 'remember',
  description: 'Save a note the agent keeps in later conversations (remember user … for every project)',
  argumentHint: '<note>',
  run: (jinion, args) => {
    const [first = '', ...rest] = args.trim().split(/\s+/);
    const scope = first === 'user' || first === 'project' ? first : 'project';
    const content = (first === scope ? rest.join(' ') : args).trim();
    if (!content) return jinion.notice('Say what to remember, e.g. /remember use pnpm, not npm.', 'warning');

    const line = content.split('\n')[0]!;

    const memory = jinion.memory.save({
      scope,
      type: scope === 'user' ? 'preference' : 'fact',
      title: truncate(line, 60),
      description: truncate(line, 160),
      content,
    });

    jinion.notice(`Saved ${memory.scope}/${memory.id}. The agent sees it from the next conversation on.`, 'success');
  },
};

export const memory: Command = {
  name: 'memory',
  description: "The notes the agent keeps; memory import brings in Claude Code's",
  argumentHint: '[import]',
  run: (jinion, args) => {
    if (args.trim() !== 'import') return jinion.screen.openView({ id: 'memory' });

    const { added, skipped } = importClaudeMemory(jinion.memory, jinion.info.cwd);
    const note = skipped > 0 ? ` (${skipped} already here)` : '';

    jinion.notice(
      added > 0
        ? `Imported ${plural(added, 'note')} from Claude Code${note}. The agent sees them from the next conversation on.`
        : `Nothing new to import from Claude Code${note}.`,
      added > 0 ? 'success' : 'muted',
    );
  },
};
