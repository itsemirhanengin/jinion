import { useEffect } from 'react';
import { usePanels } from '@jinion/tui';
import { AskPanel, PermissionPanel, PlanPanel } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import type { Dialog } from '@jinion/core/conversation/dialogs';
import { dialogAtom } from '../state/session.js';
import { useApi } from './api.js';

const PLAN_CHOICES: Record<AgentMode, string> = {
  auto: 'Yes, and use auto mode',
  edits: 'Yes, and accept edits',
  manual: 'Yes, and approve each edit',
  plan: 'Yes, and keep planning mode',
};

/** Shows the dialog the session the user looks at waits on, in place of the prompt, and puts it away once answered. */
export function useDialogs() {
  const panels = usePanels();
  const dialog = useAtomValue(dialogAtom);

  useEffect(() => {
    if (!dialog) return;

    panels.open({ id: dialog.id, placement: 'bottom', element: <DialogView dialog={dialog} /> });

    return () => panels.close(dialog.id);
  }, [dialog]);
}

/** Each answer names its dialog, so one meant for a dialog that is gone answers nothing else. */
function DialogView({ dialog }: { dialog: Dialog }) {
  const api = useApi();

  const cancel = () => api.act(api.inSession('dialog/cancel', {}));

  switch (dialog.id) {
    case 'ask':
      return <AskPanel questions={dialog.questions} onSubmit={(answer) => api.act(api.inSession('dialog/answer', { dialog: 'ask', answer }))} onCancel={cancel} />;

    case 'permission':
      return (
        <PermissionPanel
          request={dialog.request}
          agent="jinion"
          onDecide={(answer) => api.act(api.inSession('dialog/answer', { dialog: 'permission', answer }))}
          onCancel={cancel}
        />
      );

    case 'plan':
      return (
        <PlanPanel
          options={dialog.modes.map((mode) => ({ id: mode, label: PLAN_CHOICES[mode], description: MODES[mode].description }))}
          onDecide={(decision) =>
            api.act(
              api.inSession('dialog/answer', {
                dialog: 'plan',
                answer: decision.approve ? { approve: true, mode: decision.option as AgentMode } : decision,
              }),
            )
          }
          onCancel={cancel}
        />
      );
  }
}
