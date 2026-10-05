import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { classNames } from '../lib/class-names.js';

/** One line that fades out at its end when it runs longer than its room, instead of ending in an ellipsis. */
export function FadeText({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    if (!box.current || !text.current) return;

    const measure = () => setOverflows(Boolean(box.current && text.current && text.current.offsetWidth > box.current.clientWidth));
    const observer = new ResizeObserver(measure);

    // Both, since the text can grow while its box, already at its widest, stays the same.
    observer.observe(box.current);
    observer.observe(text.current);
    measure();

    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={box}
      className={classNames(
        'block min-w-0 overflow-hidden whitespace-nowrap',
        overflows && '[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]',
        className,
      )}
    >
      <span ref={text} className="inline-block">
        {children}
      </span>
    </span>
  );
}
