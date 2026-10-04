import type { ReactNode } from 'react';
import type { Theme } from '@jinion/tui';
import type { ModelSelection } from '@jinion/tui/chat';
import type { AgentAccount } from '@jinion/core/agent/accounts';
import type { AgentMode } from '@jinion/core/agent/agent';
import type { LimitWindow } from '@jinion/core/agent/usage';
import type { SessionState } from '@jinion/core/conversation/session';
import type { GitStatus } from '@jinion/core/api/protocol';

export interface StatusData {
  version: string;
  cwd: string;
  agent: string;
  model: { name: string; selection: ModelSelection };
  mode: AgentMode;
  account?: AgentAccount;
  session: SessionState;
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
