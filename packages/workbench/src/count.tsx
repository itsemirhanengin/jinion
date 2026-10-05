import { classNames } from '@jinion/ui';

type Tone = 'primary' | 'warning';

const tones: Record<Tone, string> = { primary: 'bg-primary text-on-primary', warning: 'bg-warning text-white' };

/** A number beside a view's name, such as the problems found; nothing at zero. */
export function Count({ value, tone = 'primary' }: { value: number; tone?: Tone }) {
  if (value <= 0) return null;

  return (
    <span className={classNames('flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold tabular-nums', tones[tone])}>
      {value > 99 ? '99+' : value}
    </span>
  );
}

/** On an activity's icon: something there to look at, the number left to its sidebar. */
export function Dot({ tone = 'primary' }: { tone?: Tone }) {
  return <span className={classNames('block size-1.5 rounded-full', tone === 'primary' ? 'bg-primary' : 'bg-warning')} />;
}
