import { describe, expect, it } from 'vitest';
import { PastedImages } from '../../src/chat/pasted-images.js';

describe('PastedImages', () => {
  it('numbers images and finds the ones a text refers to, once each, in order', () => {
    const images = new PastedImages();
    const first = { mediaType: 'image/png', data: 'one' };
    const second = { mediaType: 'image/jpeg', data: 'two' };

    expect(images.add(first)).toBe('[Image #1]');
    expect(images.add(second)).toBe('[Image #2]');
    expect(images.in('compare [Image #2] with [Image #1], and [Image #2] again; [Image #9] is gone')).toEqual([second, first]);
    expect(images.in('no images')).toEqual([]);
  });
});
