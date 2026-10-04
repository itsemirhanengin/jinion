import { usePanel } from '@jinion/tui';
import { ModelPanel } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import { useApi } from '../app/api.js';
import { modelsAtom, selectionAtom } from '../state/session.js';

export function ModelPicker() {
  const api = useApi();
  const { close } = usePanel();

  return (
    <ModelPanel
      models={useAtomValue(modelsAtom)}
      current={useAtomValue(selectionAtom)}
      subtitle={api.initialized.agent.name}
      onSelect={(selection) => {
        close();
        api.act(api.inSession('session/model', { selection }));
      }}
      onCancel={close}
    />
  );
}
