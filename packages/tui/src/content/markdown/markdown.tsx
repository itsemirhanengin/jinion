import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { lexer, type Token, type Tokens } from 'marked';
import { useTheme } from '../../runtime/theme.js';
import { Inset } from '../../runtime/width.js';
import { Frame } from '../../primitives/frame.js';
import { Prose } from '../../primitives/prose.js';
import { Rule } from '../../primitives/rule.js';
import { printable } from '../../utils/printable.js';
import { decode, Inline } from './inline.js';
import { LEFT_PIPE, Table } from './table.js';

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
