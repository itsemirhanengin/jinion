import { Popover as BasePopover } from '@base-ui/react/popover';
import type { ReactElement, ReactNode } from 'react';

export interface PopoverProps {
  /** What opens it, such as a `Button`. */
  trigger: ReactElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
  /** Whether focus goes back to the trigger on closing; off when picking in it takes the user elsewhere. */
  returnFocus?: boolean;
  children: ReactNode;
}

/** A floating surface under what opened it, for more than a menu holds, such as a search over a list. */
export function Popover({ trigger, open, onOpenChange, side = 'bottom', align = 'start', returnFocus = true, children }: PopoverProps) {
  return (
    <BasePopover.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner side={side} align={align} sideOffset={6} className="z-50 outline-none">
          <BasePopover.Popup
            finalFocus={returnFocus}
            className="flex max-h-[min(32rem,var(--available-height))] w-80 origin-(--transform-origin) flex-col overflow-hidden rounded-xl bg-floating text-ui text-ink shadow-lg ring-1 ring-edge transition-[opacity,scale] duration-150 ease-out outline-none data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0">
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
