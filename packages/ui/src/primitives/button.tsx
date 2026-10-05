import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '../lib/class-names.js';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';

export type ButtonSize = 'small' | 'medium' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary/90',
  outline: 'border border-line bg-raised text-ink hover:bg-hover',
  ghost: 'text-muted hover:bg-hover hover:text-ink',
};

const sizes: Record<ButtonSize, string> = {
  small: 'h-7 gap-1.5 rounded-full px-3 text-small',
  medium: 'h-8 gap-2 rounded-lg px-3',
  icon: 'size-7 justify-center rounded-full',
};

export function Button({ variant = 'ghost', size = 'medium', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(
        'inline-flex shrink-0 cursor-default items-center font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
