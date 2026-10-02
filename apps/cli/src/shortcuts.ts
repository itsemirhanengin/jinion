/** The keys jinion understands, as listed in `/help`. Keep in sync with the handlers that implement them. */
export const SHORTCUTS: [keys: string, action: string][] = [
  ['/', 'commands, skills, MCP'],
  ['enter', 'send'],
  ['shift+enter', 'new line'],
  ['up/down', 'prompt history'],
  ['esc', 'interrupt the turn'],
  ['ctrl+c', 'interrupt, clear, quit'],
  ['ctrl+o', 'expand output'],
  ['wheel', 'scroll the conversation'],
  ['pgup/pgdn', 'scroll by page'],
  ['shift+drag', 'select text'],
  ['ctrl+a/e', 'line start/end'],
  ['alt+left/right', 'move by word'],
  ['ctrl+w', 'delete word'],
  ['ctrl+u/k', 'delete to start/end'],
];
