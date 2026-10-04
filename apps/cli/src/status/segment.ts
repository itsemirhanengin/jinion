import type { ReactNode } from 'react';
import type { Theme } from '@jinion/tui';
import type { ModelSelection } from '@jinion/tui/chat';
import type { AgentAccount } from '../agent/accounts.js';
import type { AgentMode } from '../agent/agent.js';
import type { LimitWindow } from '../agent/usage.js';
import type { Session } from '../conversation/session.js';
import type { GitStatus } from '../git/status.js';

export interface StatusData {
  version: string;
  cwd: string;
  agent: string;
  model: { name: string; selection: ModelSelection };
  mode: AgentMode;
  account?: AgentAccount;
  session: Session;
  git?: GitStatus;
  limits?: LimitWindow[];
  now: number;
  theme: Theme;
}

export interface SegmentStyle {
  id: string;
  name: string;
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  styles?: SegmentStyle[];
  ticks?: boolean;
  git?: boolean;
  render(data: StatusData, style: string): ReactNode | undefined;
}

export const levelColor = (theme: Theme, used: number) => (used >= 0.8 ? theme.error : used >= 0.5 ? theme.warning : theme.success);
