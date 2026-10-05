import { classNames } from '@jinion/ui';

/** A project's first letter in a small square, as it stands for the project in lists. */
export function ProjectInitial({ name, selected }: { name: string; selected?: boolean }) {
  return (
    <span
      className={classNames(
        'flex size-5 shrink-0 items-center justify-center rounded-md text-small font-semibold uppercase',
        selected ? 'bg-primary text-on-primary' : 'bg-shade text-muted',
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}
