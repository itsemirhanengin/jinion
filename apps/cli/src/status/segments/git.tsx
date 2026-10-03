import { Text } from '@jinion/tui';
import { Tag } from '@jinion/tui/chat';
import type { Segment } from '../segment.js';

export const git: Segment = {
  id: 'git',
  name: 'Git',
  description: 'The branch, with uncommitted files and commits ahead or behind; for several repositories, how many',
  styles: [
    { id: 'changes', name: 'with changes' },
    { id: 'branch', name: 'branch only' },
  ],
  git: true,
  render: ({ git, theme }, style) => {
    if (!git) return undefined;

    // A folder of several repositories sums them up; `/diff` tells them apart. A single one in a folder below is named.
    const [only] = git.repos;
    const where = git.repos.length > 1 || !only ? `${git.repos.length} repos` : only.repo.path ? `${only.repo.label} ${only.branch}` : only.branch;
    const sum = (key: 'changed' | 'ahead' | 'behind') => git.repos.reduce((total, repo) => total + repo[key], 0);

    const details =
      style === 'changes'
        ? [sum('changed') > 0 && `*${sum('changed')}`, sum('ahead') > 0 && `↑${sum('ahead')}`, sum('behind') > 0 && `↓${sum('behind')}`]
        : [];

    const extra = details.filter(Boolean).join(' ');

    return (
      <Tag
        name="G"
        value={
          <Text>
            {where}
            {extra && <Text color={theme.warning}> {extra}</Text>}
          </Text>
        }
        color={theme.code}
      />
    );
  },
};
