import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';

export interface TreeNode {
  label: ReactNode;
  children?: TreeNode[];
}

export interface TreeProps {
  nodes: TreeNode[];
}

export function Tree({ nodes }: TreeProps) {
  return (
    <Box flexDirection="column">
      {flatten(nodes, '').map((row, index) => (
        <TreeRow key={index} prefix={row.prefix} label={row.label} />
      ))}
    </Box>
  );
}

export function TreeRow({ prefix, label }: { prefix: string; label: ReactNode }) {
  const theme = useTheme();
  return (
    <Box>
      <Box flexShrink={0}>
        <Text color={theme.border}>{prefix}</Text>
      </Box>
      <Box flexShrink={1} flexDirection="column">
        {typeof label === 'string' ? <Text>{label}</Text> : label}
      </Box>
    </Box>
  );
}

function flatten(nodes: TreeNode[], indent: string): { prefix: string; label: ReactNode }[] {
  return nodes.flatMap((node, index) => {
    const last = index === nodes.length - 1;
    const row = { prefix: `${indent}${last ? "'-- " : '|-- '}`, label: node.label };
    const children = node.children ? flatten(node.children, `${indent}${last ? '    ' : '|   '}`) : [];
    return [row, ...children];
  });
}
