import { classNames } from '../lib/class-names.js';
import { Spinner, Waiting } from './spinner.js';

/** Where a conversation is: `waiting` is on the user, such as a permission to answer. */
export type Status = 'working' | 'waiting' | 'done' | 'idle' | 'failed';

/** A thread's mark before its title: the spinner while it works, `?` while it waits, a dot otherwise. */
export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  if (status === 'working') return <Spinner className={className} />;
  if (status === 'waiting') return <Waiting className={className} />;

  return (
    <span
      role="img"
      aria-label={status}
      className={classNames('size-1.5 shrink-0 rounded-full', status === 'failed' ? 'bg-error' : 'bg-faint/60', className)}
    />
  );
}
