import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

/**
 * The box a tooltip is placed in lets the pointer through as the tooltip does, so an element under it can still be
 * hovered, such as the square above the one the tooltip is about.
 */
const POSITIONER = 'pointer-events-none z-50';

/** As the app's menus look; with no fade when it opens at once, as when the pointer moves on from another. */
const POPUP =
  'float pointer-events-none rounded-lg px-2 py-1 text-small transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 data-instant:transition-none';

/**
 * Tooltips that share their wait: the first opens after `delay`, and moving on to another while one shows opens it at
 * once.
 */
export function TooltipGroup({ delay = 400, children }: { delay?: number; children: ReactNode }) {
  return (
    <BaseTooltip.Provider delay={delay} closeDelay={0}>
      {children}
    </BaseTooltip.Provider>
  );
}

export interface TooltipProps {
  /** What it says, a line or two. */
  content: ReactNode;
  /** What it is about, the element the pointer rests on. */
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/** A small floating note over an element, drawn as the app's menus are rather than as the browser's own. */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} className="z-50">
          <BaseTooltip.Popup className={POPUP}>{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

export type TooltipHandle<Payload> = BaseTooltip.Handle<Payload>;

/** What ties a `SharedTooltip` to its triggers; made once, as with `useMemo`. */
export function tooltipHandle<Payload>(): TooltipHandle<Payload> {
  return BaseTooltip.createHandle<Payload>();
}

/**
 * One tooltip for many elements, such as a heatmap's squares: as the pointer moves from one to the next it stays open
 * and jumps there with the next one's note, rather than closing and opening again.
 */
export function SharedTooltip<Payload>({ handle, render, side = 'top' }: { handle: TooltipHandle<Payload>; render: (payload: Payload) => ReactNode; side?: TooltipProps['side'] }) {
  return (
    <BaseTooltip.Root handle={handle}>
      {({ payload }) =>
        payload !== undefined && (
          <BaseTooltip.Portal>
            <BaseTooltip.Positioner side={side} sideOffset={6} className={POSITIONER}>
              <BaseTooltip.Popup className={POPUP}>{render(payload)}</BaseTooltip.Popup>
            </BaseTooltip.Positioner>
          </BaseTooltip.Portal>
        )
      }
    </BaseTooltip.Root>
  );
}

/** An element that shows the shared tooltip with its own `payload`, after `delay` for the first. */
export function TooltipTrigger<Payload>({ handle, payload, delay = 400, children }: { handle: TooltipHandle<Payload>; payload: Payload; delay?: number; children: ReactElement }) {
  return <BaseTooltip.Trigger handle={handle} payload={payload} delay={delay} closeDelay={0} render={children} />;
}
