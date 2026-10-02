import { useEffect, useState } from 'react';
import { ChoiceList, Panel, Text, useChoiceList, useInput, usePanel, useTheme, type Choice } from '@jinion/tui';
import { useJinion } from '../context.js';
import { DEFAULT_STATUS_LINE, styleOf, type StatusItem, type StatusSide } from '../status/line.js';
import { findSegment, SEGMENTS } from '../status/segments.js';

const VISIBLE = 6;
const NAME_WIDTH = 13;

type Look = Omit<StatusItem, 'id'>;

/** The shown segments in their order, then the rest in the order `SEGMENTS` lists them. */
const orderOf = (items: StatusItem[]) => [
  ...items.map((item) => item.id),
  ...SEGMENTS.filter((segment) => !items.some((item) => item.id === segment.id)).map((segment) => segment.id),
];

const looksOf = (items: StatusItem[]): Record<string, Look> =>
  Object.fromEntries(
    SEGMENTS.map((segment) => {
      const item = items.find((candidate) => candidate.id === segment.id);
      return [segment.id, item ? { side: item.side, style: item.style } : { side: 'left' as StatusSide }];
    }),
  );

/**
 * `/statusline`: every segment, checked when shown. The list's order is the line's order, and the status line
 * below shows the draft as it changes.
 */
export function StatusLinePanel() {
  const app = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const [order, setOrder] = useState(() => orderOf(app.status.items));
  const [looks, setLooks] = useState(() => looksOf(app.status.items));

  const itemsOf = (checked: string[]): StatusItem[] =>
    order.filter((id) => checked.includes(id)).map((id) => ({ id, ...looks[id]! }));

  const list = useChoiceList({
    keys: order,
    mode: 'multiple',
    initialChecked: app.status.items.map((item) => item.id),
    onCancel: close,
    onSubmit: (checked) => {
      app.actions.saveStatusLine(itemsOf(checked));
      close();
    },
  });

  const draft = itemsOf(list.checked);
  const draftKey = JSON.stringify(draft);
  useEffect(() => app.actions.previewStatusLine(draft), [draftKey]);
  // However the panel closes, the line goes back to what is saved.
  useEffect(() => () => app.actions.previewStatusLine(undefined), []);

  useInput((input, key) => {
    const id = list.focus;
    const look = looks[id]!;
    const styles = findSegment(id)?.styles ?? [];
    const restyle = (next: Partial<Look>) => setLooks({ ...looks, [id]: { ...look, ...next } });

    if ((key.upArrow || key.downArrow) && key.shift) {
      const index = order.indexOf(id);
      const target = index + (key.upArrow ? -1 : 1);
      if (target < 0 || target >= order.length) return;
      const moved = [...order];
      moved[index] = moved[target]!;
      moved[target] = id;
      return setOrder(moved);
    }
    if (key.tab) return restyle({ side: look.side === 'left' ? 'right' : 'left' });
    if ((key.leftArrow || key.rightArrow) && styles.length > 1) {
      const index = styles.findIndex((style) => style.id === styleOf({ id, ...look }));
      return restyle({ style: styles[(index + (key.rightArrow ? 1 : -1) + styles.length) % styles.length]!.id });
    }
    if (input === 'r') {
      setOrder(orderOf(DEFAULT_STATUS_LINE));
      setLooks(looksOf(DEFAULT_STATUS_LINE));
      for (const segment of SEGMENTS) {
        list.setChecked(segment.id, DEFAULT_STATUS_LINE.some((item) => item.id === segment.id));
      }
    }
  });

  const choices: Choice[] = order.map((id) => {
    const segment = findSegment(id)!;
    const look = looks[id]!;
    const shown = list.isChecked(id);
    const style = segment.styles?.find((candidate) => candidate.id === styleOf({ id, ...look }));
    const sample = segment.render(app.status.data, styleOf({ id, ...look }));
    return {
      key: id,
      label: (
        <Text>
          {segment.name.padEnd(NAME_WIDTH)}
          <Text dimColor={!shown}>{sample ?? <Text color={theme.muted}>nothing to show yet</Text>}</Text>
        </Text>
      ),
      description: style ? `${segment.description} · ${style.name}` : segment.description,
      aside: shown ? look.side : undefined,
    };
  });

  return (
    <Panel
      title="Status line"
      subtitle={`${list.checked.length} of ${SEGMENTS.length} shown`}
      header={
        <Text color={theme.muted}>Checked items show in the status line below, in this order. Changes show as you make them.</Text>
      }
      hints={[
        ['Space', 'select'],
        ['Shift+Up/Down', 'move'],
        ['Tab', 'side'],
        ['Left/Right', 'style'],
        ['r', 'reset'],
        ['Enter', 'save'],
        ['Esc', 'cancel'],
      ]}
    >
      <ChoiceList list={list} choices={choices} limit={VISIBLE} />
    </Panel>
  );
}
