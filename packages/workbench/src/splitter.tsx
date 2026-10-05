import { classNames } from '@jinion/ui';
import type { PointerEvent } from 'react';

export interface SplitterProps {
  axis: 'x' | 'y';
  size: number;
  min: number;
  max: number;
  /** Whether dragging toward the end of the axis makes the part smaller, as for a panel on the right or at the bottom. */
  reversed?: boolean;
  onResize: (size: number) => void;
}

/** The line between two parts, dragged to resize the one it belongs to. */
export function Splitter({ axis, size, min, max, reversed, onResize }: SplitterProps) {
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const start = axis === 'x' ? event.clientX : event.clientY;
    const target = event.currentTarget;

    target.setPointerCapture(event.pointerId);

    const move = (moved: globalThis.PointerEvent) => {
      const distance = (axis === 'x' ? moved.clientX : moved.clientY) - start;

      onResize(Math.round(Math.min(max, Math.max(min, size + (reversed ? -distance : distance)))));
    };

    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };

    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  return (
    <div
      aria-hidden
      onPointerDown={pointerDown}
      className={classNames(
        'relative z-10 shrink-0 bg-line',
        axis === 'x' ? 'w-px cursor-col-resize before:absolute before:inset-y-0 before:-inset-x-1' : 'h-px cursor-row-resize before:absolute before:inset-x-0 before:-inset-y-1',
        'before:content-[""] hover:bg-frame',
      )}
    />
  );
}
