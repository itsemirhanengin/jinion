import { ChoiceList, Panel, Text, useChoiceList, usePanel, useTheme } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import { useApi } from '../app/api.js';
import { modeAtom } from '../state/session.js';
import { modeColor } from '../ui/modes.js';

export function ModePicker() {
  const api = useApi();
  const theme = useTheme();
  const { close } = usePanel();
  const current = useAtomValue(modeAtom);

  const { modes: available, name } = api.initialized.agent;

  const list = useChoiceList({
    keys: available,
    mode: 'single',
    initialFocus: current,
    onCancel: close,
    onSubmit: ([mode]) => {
      close();
      if (mode) api.act(api.inSession('session/mode', { mode: mode as AgentMode }));
    },
  });

  return (
    <Panel
      title="Mode"
      subtitle={name}
      hints={[
        ['Enter', 'select'],
        ['Up/Down', 'move'],
        ['Esc', 'cancel'],
      ]}
    >
      <ChoiceList
        list={list}
        limit={available.length}
        choices={available.map((mode) => ({
          key: mode,
          label: <Text color={modeColor(theme, mode)}>{MODES[mode].name}</Text>,
          description: MODES[mode].description,
          aside: mode === current ? 'current' : undefined,
        }))}
      />
    </Panel>
  );
}
