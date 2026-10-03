import { describe, expect, it } from 'vitest';
import { Virtualizer } from './virtualizer.js';

const keys = (count: number) => Array.from({ length: count }, (_, index) => `item-${index}`);
const laidOut = (slots: { key: string | number }[], height: (key: string) => number) =>
  new Map(slots.map((slot) => [slot.key, height(String(slot.key))]));

describe('Virtualizer', () => {
  it('following the newest row, mounts the items of the view and a screen above it, the rest as empty space', () => {
    const virtualizer = new Virtualizer({ estimate: 2 });
    const window = virtualizer.window(keys(100), { height: 10 });
    expect(window).toMatchObject({ total: 200, follows: true, first: 190, maxTop: 190, after: 0 });
    expect(window.slots.map((slot) => slot.index)).toEqual(Array.from({ length: 10 }, (_, at) => 90 + at));
    expect(window.before).toBe(180);
    expect(window.slots.every((slot) => slot.ready)).toBe(true);
  });

  it('takes measured heights from then on, at the same width', () => {
    const virtualizer = new Virtualizer({ estimate: 2 });
    const window = virtualizer.window(keys(100), { height: 10 });
    expect(virtualizer.measure(window, laidOut(window.slots, () => 5), 40)).toEqual({ changed: true, shift: 0 });
    expect(virtualizer.measure(window, laidOut(window.slots, () => 5), 40)).toEqual({ changed: false, shift: 0 });

    const after = virtualizer.window(keys(100), { height: 10 });
    expect(after.total).toBe(90 * 2 + 10 * 5);
    expect(after.slots.map((slot) => slot.index)).toEqual([96, 97, 98, 99]);

    virtualizer.measure(after, new Map(), 60);
    expect(virtualizer.window(keys(100), { height: 10 }).total).toBe(200);
  });

  it('while scrolled, mounts a screen below the view too, and has items never measured laid out out of sight first', () => {
    const virtualizer = new Virtualizer({ estimate: 2 });
    const bottom = virtualizer.window(keys(100), { height: 10 });
    virtualizer.measure(bottom, laidOut(bottom.slots, () => 2), 40);

    const scrolled = virtualizer.window(keys(100), { height: 10, top: 170 });
    expect(scrolled).toMatchObject({ follows: false, first: 170, before: 160, after: 10 });
    expect(scrolled.slots.map((slot) => [slot.index, slot.ready])).toEqual([
      ...Array.from({ length: 10 }, (_, at) => [80 + at, false]),
      ...Array.from({ length: 5 }, (_, at) => [90 + at, true]),
    ]);
  });

  it('moves a scrolled view by what items above it turned out to differ by, and nothing for items in or below it', () => {
    const virtualizer = new Virtualizer({ estimate: 2 });
    virtualizer.measure(virtualizer.window(keys(100), { height: 10 }), new Map(), 40);
    const scrolled = virtualizer.window(keys(100), { height: 10, top: 100 });
    const { shift } = virtualizer.measure(scrolled, laidOut(scrolled.slots, () => 3), 40);
    expect(shift).toBe(5);

    const following = virtualizer.window(keys(100), { height: 10 });
    expect(virtualizer.measure(following, laidOut(following.slots, () => 1), 40).shift).toBe(0);
  });

  it('keeps a view past the end within bounds', () => {
    const window = new Virtualizer({ estimate: 2 }).window(keys(3), { height: 10, top: 50 });
    expect(window).toMatchObject({ total: 6, first: 0, maxTop: 0, before: 0, after: 0 });
    expect(window.slots).toHaveLength(3);
  });
});
