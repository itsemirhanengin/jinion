import { ChoiceList, Panel, Text, useChoiceList, usePanel, useTheme } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import { useJinion } from '../app/context.js';
import { modeAtom } from '@jinion/core/state/agent';
import { modeColor } from '../ui/modes.js';

export function ModePicker() {
  const jinion = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const current = useAtomValue(modeAtom);

  const available = jinion.agent.modes;

  const list = useChoiceList({
    keys: available,
    mode: 'single',
    initialFocus: current,
    onCancel: close,
    onSubmit: ([mode]) => {
      close();
      if (mode) jinion.modes.select(mode as AgentMode);
    },
  });

  return (
    <Panel
      title="Mode"
      subtitle={jinion.agent.name}
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
