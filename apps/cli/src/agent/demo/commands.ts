import type { AgentCommand } from '../agent.js';

export const demoCommands: AgentCommand[] = [
  { name: 'review', description: 'Review the current changes for bugs and risky patterns', source: 'skill', group: 'project' },
  { name: 'commit', description: 'Write a commit message for the staged changes', source: 'skill', group: 'user' },
  { name: 'explain', description: 'Explain how a piece of code works', source: 'skill', group: 'user', argumentHint: '<path>' },
  { name: 'pr-summary', description: 'Summarize a pull request', source: 'mcp', group: 'github', argumentHint: '<number>' },
  { name: 'create-issue', description: 'Turn this conversation into a Linear issue', source: 'mcp', group: 'Linear' },
];
