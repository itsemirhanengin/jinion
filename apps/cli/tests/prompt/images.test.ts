import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sandbox, type Sandbox } from '@jinion/core/testing/sandbox';
import { imageFromPaste } from '../../src/prompt/images.js';

let box: Sandbox;

beforeEach(() => {
  box = sandbox();
});

afterEach(() => box.restore());

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('imageFromPaste', () => {
  it('reads an image file whose path was pasted, the ways terminals paste dragged files', () => {
    const path = box.write(join(box.home, 'Screen Shot.png'), PNG);
    const expected = { mediaType: 'image/png', data: PNG.toString('base64') };

    for (const pasted of [path, `'${path}'`, path.replace(' ', '\\ '), `file://${encodeURI(path)}`, '~/Screen Shot.png', ` ${path}\n`]) {
      expect(imageFromPaste(pasted), pasted).toEqual(expected);
    }
  });

  it('leaves other text alone', () => {
    const notes = box.write(join(box.home, 'notes.txt'), 'hello');

    for (const pasted of ['hello world', notes, join(box.home, 'missing.png'), 'images/a.png', `${notes}\n${notes}`]) {
      expect(imageFromPaste(pasted), pasted).toBeUndefined();
    }
  });
});
