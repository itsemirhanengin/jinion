import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createInput } from '../../src/runtime/input.js';

describe('createInput', () => {
  it('takes focus reports out of the keys', async () => {
    const source = Object.assign(new PassThrough(), { isTTY: true }) as unknown as NodeJS.ReadStream;
    const focus: boolean[] = [];
    const { stdin, close } = createInput(source, () => {}, (focused) => focus.push(focused));
    const keys: string[] = [];

    stdin.on('data', (chunk: Buffer) => keys.push(chunk.toString()));
    source.write('a\x1b[Ob\x1b[I');
    await new Promise((resolve) => setImmediate(resolve));
    close();
    expect(focus).toEqual([false, true]);
    expect(keys.join('')).toBe('ab');
  });
});
