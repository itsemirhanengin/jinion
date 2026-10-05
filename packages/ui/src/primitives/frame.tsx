import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../lib/class-names.js';

export type FrameTone = 'neutral' | 'pending' | 'success' | 'error';

export interface FrameProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  tone?: FrameTone;
}

const tints: Record<FrameTone, string> = {
  neutral: '[--tint:var(--surface-neutral)]',
  pending: '[--tint:var(--surface-pending)]',
  success: '[--tint:var(--surface-success)]',
  error: '[--tint:var(--surface-error)]',
};

/** The card the agent answers with: a diff, what a turn changed, a command. */
export function Frame({ title, tone = 'neutral', className, children, ...props }: FrameProps) {
  return (
    <section className={classNames('tinted rounded-surface px-[2ch] py-2 font-mono text-mono', tints[tone], className)} {...props}>
      {title && <header className="truncate">{title}</header>}
      {children}
    </section>
  );
}
