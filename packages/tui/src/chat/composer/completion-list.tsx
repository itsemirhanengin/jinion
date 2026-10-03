import { Box, Text } from 'ink';
import { useTheme } from '../../runtime/theme.js';
import { Highlight } from '../../primitives/highlight.js';
import { KeyHints } from '../../primitives/panel.js';
import { ListRow, SelectList } from '../../primitives/select-list.js';
import type { Completion } from './use-completion.js';

interface CompletionListProps {
  completion: Completion;
  selected: number;
  limit: number;
  submits: boolean;
}

const GROUP_INDENT = 2;

export function CompletionList({ completion, selected, limit, submits }: CompletionListProps) {
  const theme = useTheme();
  const { items } = completion;
  const indent = items.some((item) => item.group !== undefined) ? GROUP_INDENT : 0;
  const labelWidth = Math.min(
    32,
    Math.max(...items.map((item) => indent + item.label.length + (item.hint ? item.hint.length + 1 : 0))),
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      <SelectList
        items={items}
        selected={selected}
        limit={limit}
        renderItem={(item, state) => (
          <>
            {/* The first item in view repeats its group's header, so a scrolled list still says where it is. */}
            {item.group !== undefined && (state.first || items[state.index - 1]?.group !== item.group) && (
              <Text color={theme.muted}>{`  ${item.group}`}</Text>
            )}
            <ListRow
              selected={state.selected}
              labelWidth={labelWidth}
              label={
                <Text>
                  {' '.repeat(indent)}
                  <Highlight text={item.label} positions={item.positions} />
                  {item.hint && <Text color={theme.muted}> {item.hint}</Text>}
                </Text>
              }
              description={item.description}
              aside={item.tag}
            />
          </>
        )}
      />
      <Box paddingLeft={2}>
        <KeyHints
          hints={[
            ['Tab', 'complete'],
            ['Enter', submits ? 'run' : 'insert'],
            ['Esc', 'dismiss'],
          ]}
        />
      </Box>
    </Box>
  );
}
