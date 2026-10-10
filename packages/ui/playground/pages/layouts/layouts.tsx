import { classNames } from '@jinion/ui';
import { useState } from 'react';
import { accents } from './accents.js';
import { type SwitchLook, Workspace } from './workspace.js';

const looks: { name: string; look: SwitchLook; idea: string }[] = [
  { name: 'Words', look: 'words', idea: 'Agent and Code as two words beside the project, the shown one underlined.' },
  { name: 'Pills', look: 'pills', idea: 'Agent and Code as two pills with icons and no track; the shown one is a white card, like a picked thread.' },
  { name: 'Sidebar icons', look: 'sidebar', idea: 'No switch in the title bar: Threads, Files, Search and Git as icons atop the sidebar, Threads being Agent and the rest Code.' },
];

/** The desktop app's window in one layout, with its Agent and Code switch drawn three ways under the ui.sh picker. */
export function Layouts() {
  const [accent, setAccent] = useState(accents[0]!);

  return (
    <div className="flex h-[calc(100dvh-2rem)] min-h-180 flex-col gap-3">
      <div className="flex items-center gap-1">
        <span className="pr-2 text-muted">Color</span>
        {accents.map((each) => (
          <button
            key={each.name}
            type="button"
            onClick={() => setAccent(each)}
            className={classNames(
              'flex h-7 items-center gap-2 rounded-full pr-3 pl-1.5',
              each === accent ? 'bg-background text-ink shadow-xs ring-1 ring-edge' : 'text-muted hover:text-ink',
            )}
          >
            <span className="flex size-4.5 items-center justify-center rounded-full" style={{ backgroundColor: each.palette['--chrome'] }}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: each.palette['--primary'] }} />
            </span>
            {each.name}
          </button>
        ))}
      </div>
      <div data-uidotsh-pick="Agent and Code switch" className="contents">
        {looks.map(({ name, look, idea }, index) => (
          <div key={look} data-uidotsh-option={name} className="contents" hidden={index > 0}>
            <p className="max-w-240 px-1 text-pretty">
              <span className="font-semibold">{name}</span> <span className="text-muted">{idea}</span>
            </p>
            <Workspace palette={accent.palette} look={look} />
          </div>
        ))}
      </div>
    </div>
  );
}
