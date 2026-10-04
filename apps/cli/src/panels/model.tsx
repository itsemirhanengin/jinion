import { usePanel } from '@jinion/tui';
import { ModelPanel } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import { useJinion } from '../app/context.js';
import { modelsAtom, selectionAtom } from '@jinion/core/state/agent';

export function ModelPicker() {
  const jinion = useJinion();
  const { close } = usePanel();

  return (
    <ModelPanel
      models={useAtomValue(modelsAtom)}
      current={useAtomValue(selectionAtom)}
      subtitle={jinion.agent.name}
      onSelect={(selection) => {
        close();
        jinion.models.select(selection);
      }}
      onCancel={close}
    />
  );
}
