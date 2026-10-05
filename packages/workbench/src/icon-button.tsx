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
        'flex size-7 shrink-0 cursor-default items-center justify-center rounded-lg hover:bg-shade hover:text-ink [&_svg]:size-4 [&_svg]:shrink-0',
        pressed ? 'text-ink' : 'text-muted',
      )}
    >
      {children}
    </button>
  );
}
