import { classNames } from '@jinion/ui';
import type { ReactNode } from 'react';

export interface IconButtonProps {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}

export function IconButton({ label, onClick, pressed, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={classNames(
        'hover-shade flex size-6 shrink-0 cursor-default items-center justify-center rounded-full transition-colors duration-120 hover:text-ink [&_svg]:size-3.5',
        pressed ? 'text-ink' : 'text-muted',
      )}
    >
      {children}
    </button>
  );
}
