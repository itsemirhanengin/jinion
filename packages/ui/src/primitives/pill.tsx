import { ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '../lib/class-names.js';

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  chevron?: 'down' | 'up-down' | false;
}

/** What opens a choice: the mode, the model, the branch. */
export function Pill({ icon, chevron = 'down', className, children, type = 'button', ...props }: PillProps) {
  const Chevron = chevron === 'up-down' ? ChevronsUpDown : ChevronDown;

  return (
    <button
      type={type}
      className={classNames(
        'inline-flex h-7 shrink-0 cursor-default items-center gap-1.5 rounded-lg pl-2 text-ink/70 hover:bg-shade hover:text-ink data-popup-open:bg-shade data-popup-open:text-ink',
        chevron ? 'pr-1.5' : 'pr-2',
        className,
      )}
      {...props}
    >
      {icon && <span className="flex shrink-0 [&_svg]:size-4">{icon}</span>}
      <span className="flex items-center gap-1.5 truncate">{children}</span>
      {chevron && <Chevron className="size-3.5 shrink-0 text-faint" />}
    </button>
  );
}
