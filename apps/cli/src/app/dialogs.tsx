import { useEffect } from 'react';
import { usePanels } from '@jinion/tui';
import { AskPanel, PermissionPanel, PlanPanel } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import type { Dialog } from '@jinion/core/conversation/dialogs';
import type { DialogController } from '@jinion/core/controllers/dialogs';
import { dialogAtom } from '@jinion/core/state/active';
import { useJinion } from './context.js';

const PLAN_CHOICES: Record<AgentMode, string> = {
  auto: 'Yes, and use auto mode',
  edits: 'Yes, and accept edits',
  manual: 'Yes, and approve each edit',
  plan: 'Yes, and keep planning mode',
};

/** Shows the dialog the session the user looks at waits on, in place of the prompt, and puts it away once answered. */
export function useDialogs() {
  const jinion = useJinion();
  const panels = usePanels();
  const dialog = useAtomValue(dialogAtom);

  useEffect(() => {
    if (!dialog) return;

    const { dialogs } = jinion.session;

    panels.open({ id: dialog.id, placement: 'bottom', element: <DialogView dialog={dialog} dialogs={dialogs} /> });

    return () => panels.close(dialog.id);
  }, [dialog]);
}

function DialogView({ dialog, dialogs }: { dialog: Dialog; dialogs: DialogController }) {
  const cancel = () => dialogs.cancel();

  switch (dialog.id) {
    case 'ask':
      return <AskPanel questions={dialog.questions} onSubmit={(answers) => dialogs.answer(answers)} onCancel={cancel} />;

    case 'permission':
      return <PermissionPanel request={dialog.request} agent="jinion" onDecide={(decision) => dialogs.answer(decision)} onCancel={cancel} />;

    case 'plan':
      return (
        <PlanPanel
          options={dialog.modes.map((mode) => ({ id: mode, label: PLAN_CHOICES[mode], description: MODES[mode].description }))}
          onDecide={(decision) => dialogs.answer(decision.approve ? { approve: true, mode: decision.option as AgentMode } : decision)}
          onCancel={cancel}
        />
      );
  }
}
