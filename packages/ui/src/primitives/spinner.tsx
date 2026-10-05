import { useEffect, useState } from 'react';
import { classNames } from '../lib/class-names.js';

const FRAMES = ['|', '/', '-', '\\'];

/** Something at work, drawn as the terminal draws it. */
export function Spinner({ className }: { className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => (current + 1) % FRAMES.length), 120);

    return () => clearInterval(timer);
  }, []);

  return (
    <span role="img" aria-label="Working" className={classNames('inline-block w-[1ch] shrink-0 text-center font-mono text-mono text-primary', className)}>
      {FRAMES[frame]}
    </span>
  );
}

/** Something that waits on the user. */
export function Waiting({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Waiting on you" className={classNames('inline-block w-[1ch] shrink-0 text-center font-mono text-mono font-bold text-warning', className)}>
      ?
    </span>
  );
}
