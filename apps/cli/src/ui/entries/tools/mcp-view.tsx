import { printable, Text, useTheme, type Status } from '@jinion/tui';
import { ToolLine } from '@jinion/tui/chat';
import type { ToolRun } from '../../../agent/tools.js';
import { previewTree } from './result-preview.js';

export function McpView({ run, status, output }: { run: Extract<ToolRun, { name: 'mcp' }>; status: Status; output: string[] }) {
  const theme = useTheme();

  const { server, tool, arguments: values } = run.input;

  return (
    <ToolLine
      status={status}
      name={`${server}:${tool}`}
      detail={
        <Text color={theme.muted}>
          (MCP){values && ` ${printable(values)}`}
        </Text>
      }
      tree={previewTree(output)}
    />
  );
}
