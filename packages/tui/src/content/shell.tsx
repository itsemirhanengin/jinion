import { Text } from 'ink';
import { useTheme } from '../runtime/context.js';
import type { Theme } from '../theme/themes.js';
import { printable } from '../utils/printable.js';

type ShellTokenKind = 'space' | 'command' | 'argument' | 'flag' | 'string' | 'operator' | 'variable';

const SHELL_TOKEN =
  /(\s+)|('(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?)|(&&|\|\||[|;&]|\d*>>?&?\d*|<)|(\$\{?\w+\}?)|([^\s'"|;&<>]+)/g;
const COMMAND_SEPARATORS = new Set(['&&', '||', '|', ';', '&']);

export function tokenizeShell(command: string) {
  const tokens: { kind: ShellTokenKind; text: string }[] = [];
  let expectCommand = true;

  for (const [text, space, string, operator, variable] of command.matchAll(SHELL_TOKEN)) {
    let kind: ShellTokenKind;
    if (space) kind = 'space';
    else if (string) kind = 'string';
    else if (operator) kind = 'operator';
    else if (variable) kind = 'variable';
    else if (expectCommand && !text.includes('=')) kind = 'command';
    else kind = text.startsWith('-') ? 'flag' : 'argument';

    if (kind === 'operator') expectCommand = COMMAND_SEPARATORS.has(text);
    else if (kind === 'command') expectCommand = false;

    tokens.push({ kind, text });
  }
  return tokens;
}

function colorOf(kind: ShellTokenKind, theme: Theme) {
  switch (kind) {
    case 'command':
      return theme.syntax.command;
    case 'string':
      return theme.syntax.string;
    case 'operator':
      return theme.syntax.operator;
    case 'flag':
      return theme.syntax.flag;
    case 'variable':
      return theme.syntax.variable;
    default:
      return undefined;
  }
}

/** A highlighted `$ command` line. */
export function ShellCommand({ command }: { command: string }) {
  const theme = useTheme();
  return (
    <Text>
      <Text color={theme.muted}>$ </Text>
      {tokenizeShell(printable(command)).map((token, index) => (
        <Text key={index} color={colorOf(token.kind, theme)}>
          {token.text}
        </Text>
      ))}
    </Text>
  );
}
