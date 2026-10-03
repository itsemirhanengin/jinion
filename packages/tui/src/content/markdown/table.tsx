import { Box, Text } from 'ink';
import type { Tokens } from 'marked';
import stringWidth from 'string-width';
import { useTheme } from '../../runtime/theme.js';
import { useContentWidth } from '../../runtime/width.js';
import { Inline, plainText } from './inline.js';

export const LEFT_PIPE = {
  left: '|',
  right: '',
  top: '',
  topLeft: '',
  topRight: '',
  bottom: '',
  bottomLeft: '',
  bottomRight: '',
};

export function Table({ token }: { token: Tokens.Table }) {
  const theme = useTheme();
  const width = useContentWidth();

  const rows = [token.header, ...token.rows];

  const natural = token.header.map((_, column) =>
    Math.max(3, ...rows.map((row) => stringWidth(plainText(row[column]?.tokens ?? [])))),
  );

  const widths = fitColumns(natural, width - (3 * natural.length + 1));
  const separator = `+${widths.map((columnWidth) => '-'.repeat(columnWidth + 2)).join('+')}+`;

  return (
    <Box flexDirection="column">
      <Text color={theme.border}>{separator}</Text>
      <TableRow cells={token.header} widths={widths} header />
      <Text color={theme.border}>{separator}</Text>
      {token.rows.map((row, index) => (
        <TableRow key={index} cells={row} widths={widths} />
      ))}
      <Text color={theme.border}>{separator}</Text>
    </Box>
  );
}

function TableRow({ cells, widths, header = false }: { cells: Tokens.TableCell[]; widths: number[]; header?: boolean }) {
  const theme = useTheme();

  const pipe = {
    borderStyle: LEFT_PIPE,
    borderTop: false,
    borderBottom: false,
    borderRight: false,
    borderColor: theme.border,
  } as const;

  const justify = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

  return (
    <Box>
      {widths.map((columnWidth, index) => {
        const cell = cells[index];

        return (
          <Box key={index} {...pipe} width={columnWidth + 3} paddingX={1} justifyContent={justify[cell?.align ?? 'left']}>
            <Text bold={header}>{cell && <Inline tokens={cell.tokens} />}</Text>
          </Box>
        );
      })}
      <Box {...pipe} width={1} />
    </Box>
  );
}

function fitColumns(natural: number[], available: number) {
  const widths = [...natural];
  let total = widths.reduce((sum, value) => sum + value, 0);

  while (total > available) {
    const widest = Math.max(...widths);
    if (widest <= 3) break;

    widths[widths.indexOf(widest)] = widest - 1;
    total -= 1;
  }

  return widths;
}
