import { ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '../lib/class-names.js';

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  /** `accent` marks what the whole window is about, such as the project. */
  tone?: 'plain' | 'soft' | 'accent';
  chevron?: 'down' | 'up-down' | false;
}

const tones = {
  plain: 'text-ink/80 hover:bg-hover hover:text-ink',
  soft: 'bg-hover/70 text-ink hover:bg-hover',
  accent: 'bg-accent-soft text-accent hover:bg-accent-soft/80',
};

/** What opens a choice: the mode, the model, the project. */
export function Pill({ icon, tone = 'plain', chevron = 'down', className, children, type = 'button', ...props }: PillProps) {
  const Chevron = chevron === 'up-down' ? ChevronsUpDown : ChevronDown;

  return (
    <button
      type={type}
      className={classNames(
        'inline-flex h-7 shrink-0 cursor-default items-center gap-1.5 rounded-full px-2.5 font-medium transition-colors [&_svg]:size-3.5',
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
      {chevron && <Chevron className="opacity-60" />}
    </button>
  );
}
