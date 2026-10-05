import { classNames } from '../lib/class-names.js';

export type NoticeTone = 'muted' | 'success' | 'warning' | 'error';

const tones: Record<NoticeTone, string> = {
  muted: 'text-muted',
  success: 'text-accent',
  warning: 'text-waiting',
  error: 'text-removed',
};

export function Notice({ text, tone = 'muted' }: { text: string; tone?: NoticeTone }) {
  return <div className={classNames('text-small', tones[tone])}>{text}</div>;
}
