import { classNames } from '../lib/class-names.js';

export type NoticeTone = 'muted' | 'success' | 'warning' | 'error';

const tones: Record<NoticeTone, string> = {
  muted: 'text-muted',
  success: 'text-added',
  warning: 'text-warning',
  error: 'text-error',
};

export function Notice({ text, tone = 'muted' }: { text: string; tone?: NoticeTone }) {
  return <p className={classNames('text-pretty', tones[tone])}>{text}</p>;
}
