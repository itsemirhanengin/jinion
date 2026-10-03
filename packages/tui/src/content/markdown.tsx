import { useMemo, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { lexer, type Token, type Tokens } from 'marked';
import { printable } from '../utils/printable.js';
import stringWidth from 'string-width';
import { Inset, useContentWidth, useTheme } from '../runtime/context.js';
import { Frame } from '../primitives/frame.js';
import { Prose } from '../primitives/prose.js';
import { Rule } from '../primitives/rule.js';

const LEFT_PIPE = {
  left: '|',
  right: '',
  top: '',
  topLeft: '',
  topRight: '',
  bottom: '',
  bottomLeft: '',
  bottomRight: '',
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

export interface MarkdownProps {
  text: string;
}

export function Markdown({ text }: MarkdownProps) {
  const tokens = useMemo(() => lexer(printable(text), { gfm: true }), [text]);
  return <Blocks tokens={tokens} />;
}

function Blocks({ tokens, tight = false }: { tokens: Token[]; tight?: boolean }) {
  const blocks = tokens.filter((token) => token.type !== 'space' && token.type !== 'def' && token.type !== 'checkbox');
  return (
    <Box flexDirection="column">
      {blocks.map((token, index) => (
        <Box key={index} flexDirection="column" marginTop={index === 0 || tight ? 0 : 1}>
          <Block token={token} />
        </Box>
      ))}
    </Box>
  );
}

function Block({ token }: { token: Token }) {
  const theme = useTheme();

  switch (token.type) {
    case 'heading': {
      const { depth, tokens } = token as Tokens.Heading;
      return (
        <Prose bold={depth <= 2} color={theme.heading}>
          <Inline tokens={tokens} />
        </Prose>
      );
    }
    case 'paragraph':
      return (
        <Prose>
          <Inline tokens={(token as Tokens.Paragraph).tokens} />
        </Prose>
      );
    case 'text': {
      const { tokens, text } = token as Tokens.Text;
      return <Prose>{tokens ? <Inline tokens={tokens} /> : decode(text)}</Prose>;
    }
    case 'code': {
      const { lang, text } = token as Tokens.Code;
      return (
        <Frame title={lang ? <Text color={theme.muted}>{lang}</Text> : undefined}>
          <Text>{text}</Text>
        </Frame>
      );
    }
    case 'blockquote':
      return (
        <Box
          borderStyle={LEFT_PIPE}
          borderTop={false}
          borderBottom={false}
          borderRight={false}
          borderColor={theme.muted}
          paddingLeft={1}
        >
          <Inset by={2}>
            <Blocks tokens={(token as Tokens.Blockquote).tokens} />
          </Inset>
        </Box>
      );
    case 'list':
      return <List token={token as Tokens.List} />;
    case 'table':
      return <Table token={token as Tokens.Table} />;
    case 'hr':
      return <Rule />;
    case 'html':
      return <Text color={theme.muted}>{(token as Tokens.HTML).text.trimEnd()}</Text>;
    default:
      return <Text>{token.raw.trimEnd()}</Text>;
  }
}

function List({ token }: { token: Tokens.List }) {
  const theme = useTheme();
  const start = token.start === '' ? 1 : token.start;
  const markers = token.items.map((item, index) => {
    if (item.task) return item.checked ? '[x] ' : '[ ] ';
    return token.ordered ? `${start + index}. ` : '- ';
  });
  const markerWidth = Math.max(...markers.map((marker) => marker.length));

  return (
    <Box flexDirection="column">
      {token.items.map((item, index) => (
        <Box key={index} marginTop={index > 0 && token.loose ? 1 : 0}>
          <Box flexShrink={0}>
            <Text color={token.ordered ? undefined : theme.muted}>{markers[index]!.padEnd(markerWidth)}</Text>
          </Box>
          <Box flexDirection="column" flexShrink={1}>
            <Inset by={markerWidth}>
              <Blocks tokens={item.tokens} tight={!item.loose} />
            </Inset>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function Table({ token }: { token: Tokens.Table }) {
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

function Inline({ tokens }: { tokens: Token[] }): ReactNode {
  const theme = useTheme();

  return tokens.map((token, index) => {
    switch (token.type) {
      case 'text': {
        const { tokens: children, text } = token as Tokens.Text;
        return children ? <Inline key={index} tokens={children} /> : decode(text);
      }
      case 'strong':
        return (
          <Text key={index} bold>
            <Inline tokens={(token as Tokens.Strong).tokens} />
          </Text>
        );
      case 'em':
        return (
          <Text key={index} italic>
            <Inline tokens={(token as Tokens.Em).tokens} />
          </Text>
        );
      case 'del':
        return (
          <Text key={index} strikethrough>
            <Inline tokens={(token as Tokens.Del).tokens} />
          </Text>
        );
      case 'codespan':
        return (
          <Text key={index} color={theme.code}>
            {decode((token as Tokens.Codespan).text)}
          </Text>
        );
      case 'link': {
        const link = token as Tokens.Link;
        const label = plainText(link.tokens);
        return (
          <Text key={index} color={theme.link}>
            <Text underline>
              <Inline tokens={link.tokens} />
            </Text>
            {label !== link.href && <Text color={theme.muted}> ({link.href})</Text>}
          </Text>
        );
      }
      case 'image':
        return (
          <Text key={index} color={theme.muted}>
            [image: {(token as Tokens.Image).text}]
          </Text>
        );
      case 'br':
        return '\n';
      case 'checkbox':
        return null;
      case 'escape':
      case 'html':
        return decode((token as Tokens.Escape).text);
      default:
        return token.raw;
    }
  });
}

function plainText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if ('tokens' in token && token.tokens) return plainText(token.tokens);
      return 'text' in token && typeof token.text === 'string' ? decode(token.text) : token.raw;
    })
    .join('');
}

function decode(text: string) {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity: string) => ENTITIES[entity] ?? _);
}

/** Shrinks the widest columns first until the table fits. */
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
