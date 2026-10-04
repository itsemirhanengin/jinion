import type { PanelSpec } from '@jinion/tui';
import type { View } from '@jinion/core/controllers/context';
import { AccountPicker } from '../panels/account/account-picker.js';
import { ContextPanel } from '../panels/context.js';
import { DiffPanel } from '../panels/diff/diff-panel.js';
import { HelpPanel } from '../panels/help.js';
import { McpPanel } from '../panels/mcp.js';
import { MemoryPanel } from '../panels/memory.js';
import { ModePicker } from '../panels/mode.js';
import { ModelPicker } from '../panels/model.js';
import { ResumePanel } from '../panels/resume.js';
import { RewindPanel } from '../panels/rewind/rewind-panel.js';
import { StatusLinePanel } from '../panels/statusline.js';
import { TasksPanel } from '../panels/tasks/tasks-panel.js';
import { UsagePanel } from '../panels/usage/usage-panel.js';
import { useJinion } from './context.js';

const FULLSCREEN = new Set<View['id']>(['resume', 'diff', 'usage']);

export const viewPanel = (view: View): PanelSpec => ({
  id: view.id,
  placement: FULLSCREEN.has(view.id) ? 'fullscreen' : 'bottom',
  element: <ViewPanel view={view} />,
});

function ViewPanel({ view }: { view: View }) {
  const jinion = useJinion();

  switch (view.id) {
    case 'help':
      return <HelpPanel topic={view.topic} />;

    case 'model':
      return <ModelPicker />;

    case 'mode':
      return <ModePicker />;

    case 'account':
      return <AccountPicker accounts={jinion.backend.accounts!} signIn={view.signIn} />;

    case 'mcp':
      return <McpPanel mcp={jinion.backend.mcp!} />;

    case 'resume':
      return <ResumePanel query={view.query} />;

    case 'memory':
      return <MemoryPanel />;

    case 'rewind':
      return (
        <RewindPanel
          points={view.points}
          preview={(point) => jinion.agent.rewindPreview?.(point.promptId) ?? Promise.resolve(undefined)}
          onRewind={(point, scope) => void jinion.conversation.rewindTo(point, scope)}
        />
      );

    case 'diff':
      return <DiffPanel turn={view.turn} file={view.file} />;

    case 'context':
      return <ContextPanel />;

    case 'usage':
      return <UsagePanel tab={view.tab} />;

    case 'tasks':
      return <TasksPanel />;

    case 'statusline':
      return <StatusLinePanel />;
  }
}
