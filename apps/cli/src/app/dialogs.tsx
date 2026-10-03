import { AskPanel, PermissionPanel, PlanPanel } from '@jinion/tui/chat';
import type { AgentMode } from '../agent/agent.js';
import { MODES } from '../agent/modes.js';
import type { Dialog } from '../controllers/context.js';

const PLAN_CHOICES: Record<AgentMode, string> = {
  auto: 'Yes, and use auto mode',
  edits: 'Yes, and accept edits',
  manual: 'Yes, and approve each edit',
  plan: 'Yes, and keep planning mode',
};

export function DialogView({ dialog }: { dialog: Dialog }) {
  switch (dialog.id) {
    case 'ask':
      return <AskPanel questions={dialog.questions} onSubmit={dialog.onSubmit} onCancel={dialog.onCancel} />;
    case 'permission':
      return <PermissionPanel request={dialog.request} agent="jinion" onDecide={dialog.onDecide} onCancel={dialog.onCancel} />;
    case 'plan':
      return (
        <PlanPanel
          options={dialog.modes.map((mode) => ({ id: mode, label: PLAN_CHOICES[mode], description: MODES[mode].description }))}
          onDecide={dialog.onDecide}
          onCancel={dialog.onCancel}
        />
      );
  }
}
