import { useEffect, useState } from 'react';
import { ChoiceList, Panel, Text, useChoiceList, useInput, usePanel, useTheme, type Choice } from '@jinion/tui';
import { useAtom, useSetAtom } from 'jotai';
import { statusItemsAtom, statusPreviewAtom } from '../status/items.js';
import { useStatusData } from '../status/data.js';
import type { StatusItem, StatusSide } from '@jinion/core/settings/user';
import { DEFAULT_STATUS_LINE, styleOf } from '../status/line.js';
import { findSegment, SEGMENTS } from '../status/segments/index.js';

const VISIBLE = 6;
const NAME_WIDTH = 13;

type Look = Omit<StatusItem, 'id'>;

export function StatusLinePanel() {
  const theme = useTheme();
  const { close } = usePanel();
  const data = useStatusData();
  const [saved, save] = useAtom(statusItemsAtom);
  const preview = useSetAtom(statusPreviewAtom);

  const [order, setOrder] = useState(() => orderOf(saved));
  const [looks, setLooks] = useState(() => looksOf(saved));

  const itemsOf = (checked: string[]): StatusItem[] => order.filter((id) => checked.includes(id)).map((id) => ({ id, ...looks[id]! }));

  const list = useChoiceList({
    keys: order,
    mode: 'multiple',
    initialChecked: saved.map((item) => item.id),
    onCancel: close,
    onSubmit: (checked) => {
      save(itemsOf(checked));
      close();
    },
  });

  const draft = itemsOf(list.checked);
  const draftKey = JSON.stringify(draft);

  const choices: Choice[] = order.map((id) => {
    const segment = findSegment(id)!;
    const look = looks[id]!;
    const shown = list.isChecked(id);
    const style = styleOf({ id, ...look });
    const sample = segment.render(data, style);

    return {
      key: id,
      label: (
        <Text>
          {segment.name.padEnd(NAME_WIDTH)}
          <Text dimColor={!shown}>{sample ?? <Text color={theme.muted}>nothing to show yet</Text>}</Text>
        </Text>
      ),
      description: [segment.description, segment.styles?.find((candidate) => candidate.id === style)?.name].filter(Boolean).join(' · '),
      aside: shown ? look.side : undefined,
    };
  });

  useEffect(() => preview(draft), [draftKey]);
  // However the panel closes, the line goes back to what is saved.
  useEffect(() => () => preview(undefined), []);

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
      for (const segment of SEGMENTS) list.setChecked(segment.id, DEFAULT_STATUS_LINE.some((item) => item.id === segment.id));
    }
  });

  return (
    <Panel
      title="Status line"
      subtitle={`${list.checked.length} of ${SEGMENTS.length} shown`}
      header={<Text color={theme.muted}>Checked items show in the status line below, in this order. Changes show as you make them.</Text>}
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
