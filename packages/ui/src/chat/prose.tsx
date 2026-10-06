import type { ComponentProps, ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CopyButton } from '../primitives/copy-button.js';

const plugins = [remarkGfm];

export interface ProseProps {
  text: string;
  /** What inline code opens when clicked, such as the file it names; nothing makes it plain code. */
  onCode?: (code: string) => (() => void) | undefined;
}

/** The agent's markdown. Raw HTML in it stays text, so what a model writes can't run in the app. */
export function Prose({ text, onCode }: ProseProps) {
  const components: Components = {
    pre: Block,
    code: ({ node: _, children, className, ...props }) => {
      const code = String(children);
      const open = !className && !code.includes('\n') ? onCode?.(code) : undefined;

      if (!open) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }

      return (
        <button type="button" onClick={open} title={`Open ${code}`} className="cursor-default align-baseline [&>code]:text-accent [&>code]:hover:underline">
          <code>{children}</code>
        </button>
      );
    },
  };

  return (
    <div className="prose">
      <Markdown remarkPlugins={plugins} components={components}>
        {text}
      </Markdown>
    </div>
  );
}

/** A code block, with a button that copies it. */
function Block({ node: _, children, ...props }: ComponentProps<'pre'> & { node?: unknown }) {
  return (
    <div className="group relative">
      <pre {...props}>{children}</pre>
      <CopyButton text={textOf(children)} className="absolute top-1.5 right-1.5 bg-raised opacity-0 group-hover:opacity-100 focus-visible:opacity-100" />
    </div>
  );
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) return textOf((node.props as { children?: ReactNode }).children);

  return '';
}
