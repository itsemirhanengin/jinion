const tones = {
  neutral: 'bg-neutral-950/6 text-neutral-700',
  green: 'bg-green-300/80 text-green-950',
  amber: 'bg-amber-200/80 text-amber-950',
  red: 'bg-red-200/80 text-red-950',
  sky: 'bg-sky-200/80 text-sky-950',
};

export type Tone = keyof typeof tones;

export function StatusBadge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-md px-1.5 text-xs/5 font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}
