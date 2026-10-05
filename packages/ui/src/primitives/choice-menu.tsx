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
}

/** A menu that picks one value, checked where it is. */
export function ChoiceMenu({ trigger, groups, value, onChange, side = 'bottom' }: ChoiceMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner side={side} align="start" sideOffset={6} className="z-50 outline-none">
          <Menu.Popup className="max-h-[min(28rem,var(--available-height))] min-w-60 origin-(--transform-origin) overflow-y-auto rounded-xl bg-floating p-1 text-ui text-ink shadow-lg ring-1 ring-edge transition-[opacity,scale] duration-150 ease-out outline-none data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0">
            <Menu.RadioGroup value={value} onValueChange={(next: string) => onChange(next)}>
              {groups.map((group, index) => (
                <Menu.Group key={group.label ?? index} className="flex flex-col py-0.5">
                  {group.label && <Menu.GroupLabel className="px-2 pt-1.5 pb-1 text-muted">{group.label}</Menu.GroupLabel>}
                  {group.choices.map((choice) => (
                    <Menu.RadioItem
                      key={choice.value}
                      value={choice.value}
                      className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 outline-none data-highlighted:bg-shade"
                    >
                      <span className="flex size-4 shrink-0">
                        <Menu.RadioItemIndicator>
                          <Check className="size-4 text-ink" />
                        </Menu.RadioItemIndicator>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{choice.label}</span>
                        {choice.description && <span className="truncate text-small text-muted">{choice.description}</span>}
                      </span>
                      {choice.hint && <span className="shrink-0 text-small text-faint">{choice.hint}</span>}
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
