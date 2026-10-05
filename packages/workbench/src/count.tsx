import { classNames } from '@jinion/ui';

/** A number on an activity or a view, such as the threads waiting on the user; nothing at zero. */
export function Count({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'warning' }) {
  if (value <= 0) return null;

  return (
    <span
      className={classNames(
        'flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none font-semibold text-background',
        tone === 'accent' ? 'bg-accent' : 'bg-warning',
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}
