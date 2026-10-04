import { usePanel } from '@jinion/tui';
import { ModelPanel } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import { useJinion } from '../app/context.js';
import { selectionAtom } from '@jinion/core/state/active';
import { modelsAtom } from '@jinion/core/state/agent';

export function ModelPicker() {
  const jinion = useJinion();
  const { close } = usePanel();

  return (
    <ModelPanel
      models={useAtomValue(modelsAtom)}
      current={useAtomValue(selectionAtom)}
      subtitle={jinion.backend.name}
      onSelect={(selection) => {
        close();
        jinion.session.models.select(selection);
      }}
      onCancel={close}
    />
  );
}
