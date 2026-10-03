import type { ReactNode } from 'react';
import { Text } from 'ink';
import type { Token, Tokens } from 'marked';
import { useTheme } from '../../runtime/theme.js';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

export function Inline({ tokens }: { tokens: Token[] }): ReactNode {
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

export function plainText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if ('tokens' in token && token.tokens) return plainText(token.tokens);
      return 'text' in token && typeof token.text === 'string' ? decode(token.text) : token.raw;
    })
    .join('');
}

export function decode(text: string) {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity: string) => ENTITIES[entity] ?? _);
}
