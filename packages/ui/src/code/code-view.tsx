import { classNames } from '../lib/class-names.js';
import { languageOf, type Token, useTokens } from './highlight.js';

export interface CodeViewProps {
  code: string;
  /** Picks the language by its extension. */
  path: string;
  /** Lines to mark, counted from 1, such as the one a link pointed at. */
  marked?: number[];
}

/** A file, read-only, with line numbers and colors. */
export function CodeView({ code, path, marked = [] }: CodeViewProps) {
  const tokens = useTokens(code, languageOf(path));
  const lines = code.split('\n');

  return (
    <pre className="min-w-fit py-2 font-mono text-code select-text">
      {lines.map((text, index) => (
        <div key={index} className={classNames('flex pr-4', marked.includes(index + 1) && 'bg-waiting/10')}>
          <span className="w-12 shrink-0 pr-4 text-right text-faint select-none">{index + 1}</span>
          <span className="whitespace-pre">
            <Line tokens={tokens?.[index]} text={text} />
          </span>
        </div>
      ))}
    </pre>
  );
}

/** An empty line keeps a space, so it keeps its height. */
export function Line({ tokens, text }: { tokens: Token[] | undefined; text: string }) {
  if (!tokens || tokens.length === 0) return text || ' ';

  return tokens.map((token, index) => (
    <span key={index} style={token.style}>
      {token.content}
    </span>
  ));
}
