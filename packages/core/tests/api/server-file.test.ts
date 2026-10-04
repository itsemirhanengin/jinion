import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findServer, newToken, writeServerFile } from '../../src/api/server-file.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();

describe('server files', () => {
  it('keeps the token where only the user can read it, and finds the server of a project', () => {
    const server = { url: 'ws://127.0.0.1:4000', token: newToken(), cwd: box.project, pid: process.pid, version: '1.2.3' };
    const path = writeServerFile(server);

    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(findServer(box.project)).toEqual(server);
    expect(findServer('/somewhere/else')).toBeUndefined();
  });

  it('forgets a server that is gone', () => {
    const path = writeServerFile({ url: 'ws://127.0.0.1:4001', token: newToken(), cwd: box.project, pid: 2 ** 22 + 7, version: '1.2.3' });

    expect(findServer(box.project)).toBeUndefined();
    expect(existsSync(path)).toBe(false);
  });

  it('makes tokens no one guesses', () => {
    expect(newToken()).toMatch(/^[\w-]{43}$/);
    expect(newToken()).not.toBe(newToken());
  });
});
