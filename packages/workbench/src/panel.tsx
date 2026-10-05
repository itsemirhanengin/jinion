import { classNames } from '@jinion/ui';
import { X } from 'lucide-react';
import { useLayout, useWorkbench } from './context.js';
import { IconButton } from './icon-button.js';
import type { Place } from './layout.js';
import { Splitter } from './splitter.js';

const limits: Record<Place, { min: number; max: number }> = {
  right: { min: 280, max: 720 },
  bottom: { min: 120, max: 640 },
};

/** The right panel or the bottom one: a row of its views, and the one shown. */
export function Panel({ place }: { place: Place }) {
  const workbench = useWorkbench();
  const panel = useLayout((layout) => layout[place]);

  if (!panel.open) return null;

  const views = workbench.viewsAt(place);
  const shown = views.find((view) => view.id === panel.view) ?? views[0];

  return (
    <>
      <Splitter
        axis={place === 'right' ? 'x' : 'y'}
        size={panel.size}
        {...limits[place]}
        reversed
        onResize={(size) => workbench.resize(place, size)}
      />
      <aside style={place === 'right' ? { width: panel.size } : { height: panel.size }} className="flex shrink-0 flex-col bg-background">
        <header className="flex h-9 shrink-0 items-center gap-1 px-2">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => workbench.showView(place, view.id)}
              className={classNames(
                'hover-shade flex h-6 cursor-default items-center gap-1.5 rounded-full px-2.5 text-small transition-colors duration-120',
                view === shown ? 'bg-surface-neutral text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {view.title}
              {view.Badge && <view.Badge />}
            </button>
          ))}
          <div className="flex-1" />
          <IconButton label="Close the panel" onClick={() => workbench.togglePanel(place)}>
            <X />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{shown && <shown.Content />}</div>
      </aside>
    </>
  );
}
