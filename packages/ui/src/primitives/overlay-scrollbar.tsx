import { type PointerEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { classNames } from '../lib/class-names.js';

/** The thumb's least height, so a very long box still has one to take hold of. */
const LEAST = 24;

/** How long after the box stops scrolling the thumb fades. */
const LINGER = 900;

/**
 * A scrollbar drawn over the box's right edge instead of beside it, so what the box holds keeps its width whether it
 * scrolls or not. As macOS draws one, it shows while the box scrolls or the pointer is over its strip, and it drags.
 * The box hides its own scrollbar.
 */
export function OverlayScrollbar({ target }: { target: RefObject<HTMLElement | null> }) {
  const [thumb, setThumb] = useState<{ size: number; offset: number }>();
  const [scrolling, setScrolling] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fade = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const box = target.current;
    if (!box) return;

    const place = () => {
      const { scrollHeight, clientHeight, scrollTop } = box;
      if (scrollHeight <= clientHeight + 1) return setThumb(undefined);

      const size = Math.max(LEAST, (clientHeight / scrollHeight) * clientHeight);

      setThumb({ size, offset: (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - size) });
    };

    const scrolled = () => {
      place();
      setScrolling(true);
      clearTimeout(fade.current);
      fade.current = setTimeout(() => setScrolling(false), LINGER);
    };

    // The box for its own height, what it holds for the height to scroll.
    const observer = new ResizeObserver(place);

    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    box.addEventListener('scroll', scrolled, { passive: true });
    place();

    return () => {
      observer.disconnect();
      box.removeEventListener('scroll', scrolled);
      clearTimeout(fade.current);
    };
  }, [target]);

  if (!thumb) return null;

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const box = target.current;
    if (!box || event.button !== 0) return;

    event.preventDefault();

    const handle = event.currentTarget;
    const start = event.clientY;
    const from = box.scrollTop;
    const ratio = (box.scrollHeight - box.clientHeight) / Math.max(1, box.clientHeight - thumb.size);

    handle.setPointerCapture(event.pointerId);
    setDragging(true);

    const move = (moved: globalThis.PointerEvent) => {
      box.scrollTop = from + (moved.clientY - start) * ratio;
    };

    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      setDragging(false);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  return (
    <div aria-hidden onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} className="absolute top-0 right-0 bottom-0 z-10 w-2.5">
      <div
        onPointerDown={drag}
        style={{ height: thumb.size, transform: `translateY(${thumb.offset}px)` }}
        className={classNames(
          'absolute right-0.5 w-1.5 rounded-full transition-[opacity,background-color] duration-200',
          dragging ? 'bg-ink/40' : 'bg-ink/20 hover:bg-ink/30',
          scrolling || hovered || dragging ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
