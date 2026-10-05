import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '../lib/class-names.js';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';

export type ButtonSize = 'small' | 'medium' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary font-medium text-on-primary hover:bg-primary/90',
  outline: 'bg-background font-medium text-ink shadow-xs ring-1 ring-edge hover:bg-raised',
  ghost: 'text-muted hover:bg-shade hover:text-ink',
};

const sizes: Record<ButtonSize, string> = {
  small: 'h-7 gap-1.5 rounded-lg px-2.5 [&_svg]:size-4',
  medium: 'h-8 gap-2 rounded-lg px-3 [&_svg]:size-4',
  icon: 'size-7 justify-center rounded-lg [&_svg]:size-4',
};

export function Button({ variant = 'ghost', size = 'medium', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(
        'inline-flex shrink-0 cursor-default items-center disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
