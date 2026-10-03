import type { ReactNode } from 'react';
import { markText, marks, styleOf } from '@/lib/terminal';

/**
 * A screen of Jinion as text, in the TUI's colors. Pages write it as a ```terminal code block, which
 * `lib/remark-terminal.ts` turns into this component.
 */
export function Terminal({ title, screen }: { title?: string; screen: string }) {
  return (
    <figure className="terminal not-prose">
      {title && <figcaption className="terminal-title">{title}</figcaption>}
      <pre className="terminal-screen">{render(screen.trimEnd())}</pre>
    </figure>
  );
}

function render(screen: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of screen.matchAll(marks)) {
    const [whole, names = '', text = ''] = match;
    const style = styleOf(names);
    if (!style) continue;
    parts.push(
      screen.slice(last, match.index),
      <span key={match.index} style={style}>
        {markText(text)}
      </span>,
    );
    last = match.index + whole.length;
  }
  parts.push(screen.slice(last));
  return parts;
}
