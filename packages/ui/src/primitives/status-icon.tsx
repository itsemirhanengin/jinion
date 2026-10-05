import { CircleAlert, CircleCheck, CircleDashed, CircleDot, LoaderCircle } from 'lucide-react';
import { classNames } from '../lib/class-names.js';

/** Where a conversation is: `waiting` is on the user, such as a permission to answer. */
export type Status = 'working' | 'waiting' | 'done' | 'idle' | 'failed';

const icons = {
  working: { Icon: LoaderCircle, className: 'animate-spin text-working' },
  waiting: { Icon: CircleDot, className: 'text-waiting' },
  done: { Icon: CircleCheck, className: 'text-accent' },
  idle: { Icon: CircleDashed, className: 'text-faint' },
  failed: { Icon: CircleAlert, className: 'text-removed' },
};

export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const { Icon, className: look } = icons[status];

  return <Icon aria-label={status} className={classNames('size-3.5 shrink-0', look, className)} />;
}
