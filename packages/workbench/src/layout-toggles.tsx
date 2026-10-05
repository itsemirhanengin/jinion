import { PanelBottom, PanelLeft, PanelRight } from 'lucide-react';
import { useLayout, useWorkbench } from './context.js';
import { IconButton } from './icon-button.js';

/** The buttons that open and close the sidebar and the panels, for the window's top row. */
export function LayoutToggles() {
  const workbench = useWorkbench();
  const sidebar = useLayout((layout) => layout.activity !== undefined);
  const bottom = useLayout((layout) => layout.bottom.open);
  const right = useLayout((layout) => layout.right.open);

  return (
    <div className="flex items-center gap-0.5">
      <IconButton label="Toggle the sidebar" pressed={sidebar} onClick={() => workbench.toggleSidebar()}>
        <PanelLeft />
      </IconButton>
      <IconButton label="Toggle the bottom panel" pressed={bottom} onClick={() => workbench.togglePanel('bottom')}>
        <PanelBottom />
      </IconButton>
      <IconButton label="Toggle the right panel" pressed={right} onClick={() => workbench.togglePanel('right')}>
        <PanelRight />
      </IconButton>
    </div>
  );
}
