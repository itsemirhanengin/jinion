import { useRef, type RefObject } from 'react';
import type { DOMElement } from 'ink';
import { useMouse } from './context.js';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where `element` was last laid out on the screen, in cells from the top left. */
export function screenRect(element: DOMElement): Rect {
  let x = 0;
  let y = 0;
  for (let node: DOMElement | undefined = element; node; node = node.parentNode) {
    x += node.yogaNode?.getComputedLeft() ?? 0;
    y += node.yogaNode?.getComputedTop() ?? 0;
  }
  return { x, y, width: element.yogaNode?.getComputedWidth() ?? 0, height: element.yogaNode?.getComputedHeight() ?? 0 };
}

export const contains = (rect: Rect, x: number, y: number) =>
  x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;

export interface ClickOptions {
  /** The box that cuts `ref` off, such as a scrolling view: a click outside it is on whatever is drawn there instead. */
  clip?: RefObject<DOMElement | null>;
  isActive?: boolean;
}

/**
 * Calls `onClick` when the left button goes down and up again on the same cell of `ref`. A press that moves before it
 * is let go is a drag, which selects text instead.
 */
export function useClick(ref: RefObject<DOMElement | null>, onClick: () => void, { clip, isActive = true }: ClickOptions = {}) {
  const pressed = useRef<{ x: number; y: number }>(undefined);
  useMouse(
    (event) => {
      if ((event.type !== 'press' && event.type !== 'release') || event.button !== 0) return;
      if (event.type === 'press') {
        const inside =
          ref.current !== null &&
          contains(screenRect(ref.current), event.x, event.y) &&
          (!clip?.current || contains(screenRect(clip.current), event.x, event.y));
        pressed.current = inside ? { x: event.x, y: event.y } : undefined;
        return;
      }
      const at = pressed.current;
      pressed.current = undefined;
      if (at && at.x === event.x && at.y === event.y) onClick();
    },
    { isActive },
  );
}
