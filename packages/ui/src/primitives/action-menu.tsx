import { Menu } from '@base-ui/react/menu';
import type { ReactElement } from 'react';
import { classNames } from '../lib/class-names.js';
import { MENU_MOTION } from './choice-menu.js';

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
          <Menu.Popup className={`float min-w-40 rounded-[10px] p-1 ${MENU_MOTION}`}>
            {actions.map((action) => (
              <Menu.Item
                key={action.label}
                disabled={action.disabled}
                onClick={action.onSelect}
                className={classNames('menu-row data-disabled:opacity-40 data-highlighted:bg-shade', action.destructive && 'text-error')}
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
