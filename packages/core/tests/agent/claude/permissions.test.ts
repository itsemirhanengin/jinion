import { describe, expect, it } from 'vitest';
import { toPermissionRequest } from '../../../src/agent/claude/permissions.js';

const cwd = '/work/project';

const request = (blockedPath: string) =>
  toPermissionRequest(
    'Bash',
    { command: 'pnpm build' },
    { signal: new AbortController().signal, toolUseID: 'tool', requestId: 'request', blockedPath },
    [],
    cwd,
  );

describe('toPermissionRequest', () => {
  it('says a blocked path is outside the project only when it is', () => {
    expect(request('/etc/hosts').description).toBe('Outside the project: /etc/hosts');
    expect(request('/work/project-other/a.ts').description).toBe('Outside the project: /work/project-other/a.ts');
    expect(request('/work/project/app/dist').description).toBe('Changes app/dist in the project');
    expect(request('/work/project').description).toBe('Changes . in the project');
  });
});
