import { ChoiceList, Panel, Text, useChoiceList, usePanel, useTheme } from '@jinion/tui';
import { useJinion } from '../context.js';
import { modeColor, MODES } from '../modes.js';

/** `/mode`: the agent's modes, the current one marked. */
export function ModePicker() {
  const app = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const { current, available } = app.modes;

  const list = useChoiceList({
    keys: available,
    mode: 'single',
    initialFocus: current,
    onCancel: close,
    onSubmit: ([mode]) => {
      close();
      if (mode) app.actions.selectMode(mode as (typeof available)[number]);
    },
  });

  return (
    <Panel
      title="Mode"
      subtitle={app.model.agent}
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
