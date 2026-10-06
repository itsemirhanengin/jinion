import { classNames } from '@jinion/ui';
import { X } from 'lucide-react';
import { useLayout, useWorkbench } from './context.js';
import { IconButton } from './icon-button.js';
import type { View } from './feature.js';
import type { Place } from './layout.js';
import { Splitter } from './splitter.js';

const limits: Record<Place, { min: number; max: number }> = {
  right: { min: 200, max: 560 },
  bottom: { min: 120, max: 640 },
};

/** The bottom panel, in the sheet under the tabs, or the right one, on the chrome beside the sheet. */
export function Panel({ place }: { place: Place }) {
  const workbench = useWorkbench();
  const panel = useLayout((layout) => layout[place]);
  const views = useVisibleViews(workbench.viewsAt(place));

  if (!panel.open) return place === 'right' ? <div className="w-2 shrink-0" /> : null;

  const shown = views.find((view) => view.id === panel.view) ?? views[0];
  const right = place === 'right';

  return (
    <>
      <Splitter axis={right ? 'x' : 'y'} size={panel.size} {...limits[place]} reversed visible={!right} onResize={(size) => workbench.resize(place, size)} />
      <aside style={right ? { width: panel.size } : { height: panel.size }} className={classNames('flex shrink-0 flex-col', right && 'pt-1 pr-2 pb-3')}>
        {(!right || views.length > 1) && (
          <header className={classNames('flex h-10 shrink-0 items-center gap-1', !right && 'px-3')}>
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => workbench.showView(place, view.id)}
                className={classNames(
                  'flex h-7 cursor-default items-center gap-1.5 rounded-lg px-2.5',
                  view === shown ? 'bg-shade text-ink' : 'text-muted hover:bg-shade hover:text-ink',
                )}
              >
                {view.title}
                {view.Badge && <view.Badge />}
              </button>
            ))}
            <div className="flex-1" />
            {shown?.Actions && <shown.Actions />}
            {!right && (
              <IconButton label="Close the panel" onClick={() => workbench.togglePanel(place)}>
                <X />
              </IconButton>
            )}
          </header>
        )}
        <div key={shown?.id} className="min-h-0 flex-1 animate-fade overflow-auto">
          {shown && <shown.Content />}
        </div>
      </aside>
    </>
  );
}

function useVisibleViews(views: View[]) {
  // biome-ignore lint/correctness/useHookAtTopLevel: a workbench's views are set once it is made, so each one's hook runs in the same place on every render
  return views.filter((view) => view.useVisible?.() ?? true);
}
