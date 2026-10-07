import { useEffect } from 'react';
import type { Command } from './feature.js';
import { activeTab, keyOf } from './layout.js';
import type { Workbench } from './workbench.js';

const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

/** What the window does by itself, before the features' own commands. */
export const layoutCommands: Command[] = [
  { id: 'workbench.sidebar', title: 'Toggle the sidebar', keys: 'mod+b', run: (workbench) => workbench.toggleSidebar() },
  { id: 'workbench.bottom', title: 'Toggle the bottom panel', keys: 'mod+j', run: (workbench) => workbench.togglePanel('bottom') },
  { id: 'workbench.right', title: 'Toggle the right panel', keys: 'mod+alt+b', run: (workbench) => workbench.togglePanel('right') },
  { id: 'workbench.close', title: 'Close the tab', keys: 'mod+w', run: (workbench) => workbench.closeActive() },
  {
    id: 'workbench.split',
    title: 'Split the tab',
    keys: 'mod+\\',
    run: (workbench) => {
      const tab = activeTab(workbench.getLayout());

      if (tab) workbench.split(keyOf(tab));
    },
  },
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `workbench.tab${index + 1}`,
    title: `Go to tab ${index + 1}`,
    keys: `mod+${index + 1}`,
    run: (workbench: Workbench) => {
      const layout = workbench.getLayout();
      const tab = layout.groups[layout.focused]?.tabs[index];

      if (tab) workbench.open(tab);
    },
  })),
];

export function useShortcuts(workbench: Workbench) {
  useEffect(() => {
    const commands = [...workbench.commands, ...layoutCommands].filter((command) => command.keys);

    const keyDown = (event: KeyboardEvent) => {
      const command = commands.find((candidate) => matches(candidate.keys!, event) && (candidate.when?.(workbench) ?? true));
      if (!command) return;

      event.preventDefault();
      event.stopPropagation();
      command.run(workbench);
    };

    addEventListener('keydown', keyDown, true);

    return () => removeEventListener('keydown', keyDown, true);
  }, [workbench]);
}

function matches(keys: string, event: KeyboardEvent) {
  const parts = keys.toLowerCase().split('+');
  const key = parts.pop();
  const mod = parts.includes('mod');

  return (
    key === keyName(event) &&
    (mac ? event.metaKey : event.ctrlKey) === mod &&
    event.shiftKey === parts.includes('shift') &&
    event.altKey === parts.includes('alt')
  );
}

// With Alt held, a Mac's event.key is the character Alt makes (⌘⌥B gives "∫"), so the physical key is read instead.
function keyName(event: KeyboardEvent) {
  if (event.code.startsWith('Key')) return event.code.slice(3).toLowerCase();
  if (event.code.startsWith('Digit')) return event.code.slice(5);
  if (event.code === 'Backslash') return '\\';

  return event.key.toLowerCase();
}
