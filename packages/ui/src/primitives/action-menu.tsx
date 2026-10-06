import { Menu } from '@base-ui/react/menu';
import type { ReactElement } from 'react';
import { classNames } from '../lib/class-names.js';

export interface Action {
  label: string;
  onSelect: () => void;
  /** Drawn in the error color, such as Remove. */
  destructive?: boolean;
  disabled?: boolean;
}

export interface ActionMenuProps {
  /** What opens the menu, such as a `⋯` button. */
  trigger: ReactElement;
  actions: Action[];
  align?: 'start' | 'end';
}

/** A short menu of things to do, as the choice menu draws its own. */
export function ActionMenu({ trigger, actions, align = 'end' }: ActionMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align={align} sideOffset={6} className="z-50 outline-none">
          <Menu.Popup className="min-w-44 origin-(--transform-origin) rounded-xl bg-floating p-1 text-ui text-ink shadow-lg ring-1 ring-edge transition-[opacity,scale] duration-150 ease-out outline-none data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0">
            {actions.map((action) => (
              <Menu.Item
                key={action.label}
                disabled={action.disabled}
                onClick={action.onSelect}
                className={classNames(
                  'flex cursor-default items-center rounded-lg px-2 py-1.5 outline-none data-disabled:opacity-40 data-highlighted:bg-shade',
                  action.destructive && 'text-error',
                )}
              >
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
