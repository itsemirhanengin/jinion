import { describe, expect, it } from 'vitest';
import { rangeText } from './cells.js';
import { Screen } from './screen.js';

const BEGIN = '\x1b[?2026h';
const END = '\x1b[?2026l';
const BLUE = '#264f78';
const ON = '\x1b[48;2;38;79;120m';

describe('Screen', () => {
  it('paints the selection into the frames on their way out, and drops it once the text under it changes', () => {
    const out: string[] = [];
    const screen = new Screen((data) => out.push(data));
    screen.write(`\x1b]22;pointer\x07${BEGIN}`);
    screen.write('hello\nworld');
    screen.write(END);
    expect(out).toEqual(['\x1b]22;pointer\x07', `${BEGIN}hello\nworld${END}`]);

    const range = { from: { x: 0, y: 1 }, to: { x: 4, y: 1 } };
    let dropped = 0;
    screen.onDrop(() => dropped++);
    screen.select({ range, background: BLUE, text: 'world' });
    expect(out.at(-1)).toContain(`${ON}world`);

    screen.write(`${BEGIN}hello\nworld${END}`);
    expect(out.at(-1)).toBe(`${BEGIN}hello\n${ON}world\x1b[49m${END}`);
    screen.write(`${BEGIN}world\nagain${END}`);
    expect(out.at(-1)).toBe(`${BEGIN}world\nagain${END}`);
    expect(dropped).toBe(1);
  });

  it('keeps the last frame when only the cursor moves', () => {
    const screen = new Screen(() => {});
    screen.write(`${BEGIN}hello${END}`);
    screen.write(`${BEGIN}\x1b[2;3H\x1b[?25h${END}`);
    expect(rangeText(screen.cells(), { from: { x: 0, y: 0 }, to: { x: 9, y: 0 } })).toBe('hello');
  });
});
