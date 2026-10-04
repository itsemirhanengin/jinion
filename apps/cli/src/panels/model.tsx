import { usePanel } from '@jinion/tui';
import { ModelPanel } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import { useApi } from '../app/api.js';
import { agentAtom, agentsAtom, allModelsAtom, selectionAtom } from '../state/session.js';

/** Every backend's models, under its name; one of another backend moves the conversation there. */
export function ModelPicker() {
  const api = useApi();
  const { close } = usePanel();
  const agents = useAtomValue(agentsAtom);
  const models = useAtomValue(allModelsAtom);
  const agent = useAtomValue(agentAtom);
  const selection = useAtomValue(selectionAtom);

  return (
    <ModelPanel
      groups={agents.map(({ name }) => ({ name, models: models[name] }))}
      current={{ ...selection, group: agent.name }}
      subtitle={agents.length > 1 ? undefined : agent.name}
      onSelect={(next, group) => {
        close();
        api.act(api.inSession('session/model', { selection: next, agent: group }));
      }}
      onCancel={close}
    />
  );
}
