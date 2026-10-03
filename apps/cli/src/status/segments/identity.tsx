import { basename } from 'node:path';
import { Text } from '@jinion/tui';
import { Tag } from '@jinion/tui/chat';
import { accountLabel } from '../../agent/accounts.js';
import { MODES } from '../../agent/modes.js';
import { tildify } from '../../lib/paths.js';
import { modeColor } from '../../ui/modes.js';
import type { Segment } from '../segment.js';

export const brand: Segment = {
  id: 'brand',
  name: 'Jinion',
  description: 'The app name',
  render: ({ theme }) => <Text color={theme.muted}>jinion</Text>,
};

export const model: Segment = {
  id: 'model',
  name: 'Model',
  description: 'The model in use',
  styles: [
    { id: 'effort', name: 'with effort' },
    { id: 'name', name: 'name only' },
  ],
  render: ({ model, theme }, style) => {
    const effort = style === 'effort' && model.selection.effort;
    return <Tag name="M" value={effort ? `${model.name} · ${effort}` : model.name} color={theme.status.model} />;
  },
};

export const account: Segment = {
  id: 'account',
  name: 'Account',
  description: 'Who the agent runs as, from /account',
  styles: [
    { id: 'plan', name: 'organization or email, and plan' },
    { id: 'name', name: 'account name' },
  ],
  render: ({ account, theme }, style) =>
    account && <Tag name="A" value={style === 'name' ? account.name : accountLabel(account)} color={theme.accent} />,
};

export const mode: Segment = {
  id: 'mode',
  name: 'Mode',
  description: 'How freely the agent acts; it also shows under the prompt',
  render: ({ mode, theme }) => <Text color={modeColor(theme, mode)}>{MODES[mode].name}</Text>,
};

export const directory: Segment = {
  id: 'directory',
  name: 'Directory',
  description: 'Where jinion is working',
  styles: [
    { id: 'short', name: 'last two folders' },
    { id: 'full', name: 'full path' },
    { id: 'folder', name: 'folder name' },
  ],
  render: ({ cwd, theme }, style) => {
    const path = tildify(cwd);
    const value = style === 'full' ? path : style === 'folder' ? basename(cwd) : path.split('/').filter(Boolean).slice(-2).join('/');
    return <Tag name="D" value={value} color={theme.status.directory} />;
  },
};

export const agent: Segment = {
  id: 'agent',
  name: 'Agent',
  description: 'The backend jinion drives',
  render: ({ agent, theme }) => <Text color={theme.muted}>{agent}</Text>,
};

export const version: Segment = {
  id: 'version',
  name: 'Version',
  description: "jinion's version",
  render: ({ version, theme }) => <Text color={theme.muted}>v{version}</Text>,
};
