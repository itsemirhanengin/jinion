import { Menu } from '@base-ui/react/menu';
import { Check } from 'lucide-react';
import type { ReactElement } from 'react';

export interface Choice {
  value: string;
  label: string;
  description?: string;
  /** Shown at the end of the row, such as `⇧Tab`. */
  hint?: string;
}

export interface ChoiceGroup {
  label?: string;
  choices: Choice[];
}

export interface ChoiceMenuProps {
  /** What opens the menu, such as a `Pill`. */
  trigger: ReactElement;
  groups: ChoiceGroup[];
  value: string;
  onChange: (value: string) => void;
  side?: 'top' | 'bottom';
  /** Given to open it from elsewhere, such as a command; otherwise it keeps its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const MENU_MOTION =
  'origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out outline-none data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0';

/** A menu that picks one value, checked where it is; a choice's description sits faint beside its name. */
export function ChoiceMenu({ trigger, groups, value, onChange, side = 'bottom', open, onOpenChange }: ChoiceMenuProps) {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange && ((next) => onOpenChange(next))}>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner side={side} align="start" sideOffset={6} className="z-50 outline-none">
          <Menu.Popup className={`float rounded-[10px] p-1 max-h-[min(28rem,var(--available-height))] max-w-[min(28rem,var(--available-width))] min-w-48 overflow-x-hidden overflow-y-auto ${MENU_MOTION}`}>
            <Menu.RadioGroup value={value} onValueChange={(next: string) => onChange(next)}>
              {groups.map((group, index) => (
                <Menu.Group key={group.label ?? index} className="flex flex-col">
                  {group.label && <Menu.GroupLabel className="menu-label">{group.label}</Menu.GroupLabel>}
                  {group.choices.map((choice) => (
                    <Menu.RadioItem key={choice.value} value={choice.value} title={choice.description} className="menu-row data-highlighted:bg-shade">
                      <span className="max-w-[60%] shrink-0 truncate">{choice.label}</span>
                      <span className="min-w-0 flex-1 truncate text-faint">{choice.description}</span>
                      {choice.hint && <span className="max-w-40 shrink-0 truncate text-small text-faint">{choice.hint}</span>}
                      <Menu.RadioItemIndicator className="flex shrink-0">
                        <Check className="size-3.5" />
                      </Menu.RadioItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.Group>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
