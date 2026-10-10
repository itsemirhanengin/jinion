import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { classNames } from '../lib/class-names.js';
import { MOTION, reducedMotion } from '../lib/motion.js';

export interface PillTab {
  id: string;
  label: string;
  icon: ReactNode;
  /** At the icon's corner, such as a dot for something waiting. */
  badge?: ReactNode;
  /** After the label in the tooltip, such as `⌘E`. */
  hint?: string;
}

export interface PillTabsProps {
  tabs: PillTab[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * The shown tab a pill with its name, the others their icons alone. Picking another slides the pill over to it while its
 * name opens and the last one's closes, each pushing the tabs beside it.
 */
export function PillTabs({ tabs, value, onChange }: PillTabsProps) {
  const list = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const shown = useRef<string>(undefined);
  const settled = useRef(new Map<string, number>());

  // Every render: the pill sits on the shown tab, and moves there from wherever it is when the shown tab changes.
  useLayoutEffect(() => {
    const box = list.current;
    const mark = pill.current;
    const tab = box?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(value)}"]`);
    if (!box || !mark || !tab) return;

    const names = [...box.querySelectorAll<HTMLElement>('[data-name]')];
    const moved = shown.current !== undefined && shown.current !== value;

    // The names' widths once nothing moves, for the next move to start from.
    const settle = () => {
      for (const name of names) settled.current.set(name.dataset.name!, name.getBoundingClientRect().width);
    };

    shown.current = value;

    if (!moved) {
      if (mark.getAnimations().length > 0) return;

      place(mark, tab);
      settle();

      return;
    }

    // The names already have their new widths here, so a move starts from where they last settled, or from where they
    // are halfway through the last move, as the pill does.
    const from = { left: mark.offsetLeft, width: mark.offsetWidth };

    const widths = names.map((name) =>
      name.getAnimations().length > 0 ? name.getBoundingClientRect().width : (settled.current.get(name.dataset.name!) ?? name.getBoundingClientRect().width),
    );

    for (const animation of [mark, ...names].flatMap((each) => each.getAnimations())) animation.cancel();

    place(mark, tab);
    settle();
    if (reducedMotion()) return;

    mark.animate(
      [
        { left: `${from.left}px`, width: `${from.width}px` },
        { left: `${tab.offsetLeft}px`, width: `${tab.offsetWidth}px` },
      ],
      MOTION,
    );

    names.forEach((name, index) => {
      const start = widths[index]!;
      const end = name.getBoundingClientRect().width;

      if (start !== end) {
        name.animate(
          [
            { width: `${start}px`, opacity: start > end ? 1 : 0 },
            { width: `${end}px`, opacity: end > start ? 1 : 0 },
          ],
          MOTION,
        );
      }
    });
  });

  return (
    <div ref={list} className="relative flex shrink-0 items-center gap-0.5">
      <span ref={pill} aria-hidden className="absolute inset-y-0 rounded-full bg-floating shadow-xs ring-1 ring-edge" />
      {tabs.map((tab) => {
        const active = tab.id === value;

        return (
          <button
            key={tab.id}
            type="button"
            data-tab={tab.id}
            aria-pressed={active}
            title={tab.hint ? `${tab.label} (${tab.hint})` : tab.label}
            onClick={() => onChange(tab.id)}
            className={classNames(
              'relative flex h-7 cursor-default items-center rounded-full px-2 [&_svg]:size-3.5 [&_svg]:shrink-0',
              active ? 'text-ink' : 'text-muted hover:bg-shade hover:text-ink',
            )}
          >
            <span className="relative flex">
              {tab.icon}
              {tab.badge && <span className="absolute -top-1 -right-1">{tab.badge}</span>}
            </span>
            <span data-name={tab.id} className={classNames('block overflow-hidden whitespace-nowrap', !active && 'w-0 opacity-0')}>
              <span className="block pr-1 pl-1.5">{tab.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function place(pill: HTMLElement, tab: HTMLElement) {
  pill.style.left = `${tab.offsetLeft}px`;
  pill.style.width = `${tab.offsetWidth}px`;
}
