import { useEffect, useRef } from 'react';
import { classNames } from '../lib/class-names.js';
import type { Completion } from './completion.js';

export interface CompletionListProps {
  /** The list's id; each option's is the list's with its index, for the text's `aria-activedescendant`. */
  id: string;
  completion: Completion;
  selected: number;
  onSelect: (index: number) => void;
  onPick: () => void;
  /** From the composer's top, when there is no room over it: under the line the caret is on. */
  top?: number;
}

/** What can go at the cursor, over the composer, in the rows of a `ChoiceMenu`. */
export function CompletionList({ id, completion, selected, onSelect, onPick, top }: CompletionListProps) {
  const list = useRef<HTMLDivElement>(null);

  // Scrolled by hand: `scrollIntoView` would scroll the conversation around the list too.
  useEffect(() => {
    const box = list.current;
    const row = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !row) return;

    const header = row.previousElementSibling as HTMLElement | null;
    const start = selected === 0 ? 0 : (header?.offsetTop ?? row.offsetTop) - 4;
    const end = row.offsetTop + row.offsetHeight + 4 - box.clientHeight;

    if (box.scrollTop > start) box.scrollTop = start;
    else if (box.scrollTop < end) box.scrollTop = end;
  }, [selected, completion]);

  return (
    <div
      ref={list}
      id={id}
      role="listbox"
      aria-label="Completions"
      style={{ top }}
      className={classNames(
        'float absolute inset-x-0 z-20 max-h-72 overflow-x-hidden overflow-y-auto rounded-[10px] p-1',
        top === undefined && 'bottom-full mb-2',
      )}
    >
      {completion.items.map((item, index) => (
        <div key={item.key} className="flex flex-col">
          {item.group && item.group !== completion.items[index - 1]?.group && <div className="menu-label">{item.group}</div>}
          <button
            type="button"
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === selected}
            // The text keeps the focus, so typing goes on after a click.
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={() => index !== selected && onSelect(index)}
            onClick={onPick}
            title={[item.label, item.hint, item.description].filter(Boolean).join(' ')}
            className={classNames('menu-row w-full text-left', index === selected && 'bg-shade')}
          >
            <span className="max-w-[60%] shrink-0 truncate">{item.label}</span>
            <span className="min-w-0 flex-1 truncate text-faint">{item.description}</span>
            {(item.hint ?? item.tag) && <span className="max-w-40 shrink-0 truncate text-small text-faint">{(item.hint ?? item.tag)!.replace(/^[[<]([^[\]<>]*)[\]>]$/, '$1')}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}
