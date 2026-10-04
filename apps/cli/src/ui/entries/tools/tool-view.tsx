import { Frame, Markdown, printable, Text, toneOf, useTheme, useView } from '@jinion/tui';
import { AskResult, EditBlock, ShellBlock, TodoBlock, ToolLine } from '@jinion/tui/chat';
import type { ToolEntry } from '@jinion/core/conversation/entries';
import { AgentView } from './agent-view.js';
import { MEMORY_VERBS } from './call-summary.js';
import { McpView } from './mcp-view.js';
import { GlobView, GrepView, ReadView } from './search.js';
import { ShellFooter } from './shell-footer.js';
import { FetchView, SearchView } from './web.js';

export function ToolView({ entry, live }: { entry: ToolEntry; live: boolean }) {
  const theme = useTheme();
  const { expanded } = useView();

  const { run, status } = entry;

  switch (run.name) {
    case 'read':
      return <ReadView run={run} status={status} />;

    case 'grep':
      return <GrepView run={run} status={status} />;

    case 'glob':
      return <GlobView run={run} status={status} />;

    case 'bash':
      return (
        <ShellBlock
          command={run.input.command}
          output={entry.output}
          status={status}
          footer={<ShellFooter entry={entry} />}
          // Open to follow while the turn runs, down to its line count once it is over.
          folded={!live && !expanded && status !== 'running'}
        />
      );

    case 'edit':
      return <EditBlock path={run.input.path} patch={run.result?.patch ?? run.input.patch} status={status} verb={run.input.created ? 'Write' : 'Edit'} />;

    case 'todo':
      return <TodoBlock groups={run.input.groups} status={status} />;

    case 'ask':
      return <AskResult questions={run.input.questions} answers={run.result?.answers ?? []} cancelled={status === 'cancelled'} />;

    case 'memory':
      return <ToolLine status={status} name={MEMORY_VERBS[run.input.action]} detail={<Text color={theme.muted}>{printable(run.input.detail)}</Text>} />;

    case 'plan':
      return (
        <Frame title={<Text bold>Plan</Text>} tone={toneOf(status)} lead={1}>
          <Markdown text={run.input.plan} />
        </Frame>
      );

    case 'fetch':
      return <FetchView run={run} status={status} output={entry.output} />;

    case 'search':
      return <SearchView run={run} status={status} />;

    case 'mcp':
      return <McpView run={run} status={status} output={entry.output} />;

    case 'other':
      return (
        <ToolLine
          status={status}
          name={run.input.title}
          detail={run.input.detail && <Text color={theme.muted}>{printable(run.input.detail)}</Text>}
        />
      );

    case 'agent':
      return <AgentView entry={entry} />;
  }
}
