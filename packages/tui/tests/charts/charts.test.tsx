import { afterEach, describe, expect, it } from 'vitest';
import { StatGrid } from '../../src/primitives/stat-grid.js';
import { renderTerminal, type TestTerminal } from '../../src/testing/index.js';
import { darkTheme } from '../../src/theme/themes.js';
import { BarList } from '../../src/charts/bar-list.js';
import { addDays, dayKey } from '../../src/utils/dates.js';
import { Heatmap, heatLevels } from '../../src/charts/heatmap.js';
import { Waffle, waffleCells } from '../../src/charts/waffle.js';

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

// A Saturday, so the last week is whole.
const END = new Date(2026, 9, 3);

const lines = async (screen: Promise<string>) => (await screen).split('\n').filter(Boolean);

describe('Heatmap', () => {
  it('draws a square per day, a column per week, with the months over the weeks they start in', async () => {
    terminal = renderTerminal(<Heatmap values={{}} end={END} weeks={8} legend />, { columns: 60, rows: 12 });

    expect(await lines(terminal.screen())).toEqual([
      '          Sep     Oct',
      '    ■ ■ ■ ■ ■ ■ ■ ■',
      'Mon ■ ■ ■ ■ ■ ■ ■ ■',
      '    ■ ■ ■ ■ ■ ■ ■ ■',
      'Wed ■ ■ ■ ■ ■ ■ ■ ■',
      '    ■ ■ ■ ■ ■ ■ ■ ■',
      'Fri ■ ■ ■ ■ ■ ■ ■ ■',
      '    ■ ■ ■ ■ ■ ■ ■ ■',
      'Less ■ ■ ■ ■ ■ More',
    ]);
  });

  it('leaves out the days after the last one, and the weeks that don’t fit, oldest first', async () => {
    // A Thursday: Friday and Saturday of its week are still to come.
    terminal = renderTerminal(<Heatmap values={{}} end={new Date(2026, 9, 1)} />, { columns: 25, rows: 10 });
    const rows = await lines(terminal.screen());

    expect(rows[1]).toBe('    ■ ■ ■ ■ ■ ■ ■ ■ ■ ■');
    expect(rows[6]).toBe('Fri ■ ■ ■ ■ ■ ■ ■ ■ ■');
  });

  it('shades each day by the quartile it falls in', async () => {
    const values = { [dayKey(END)]: 100, [addDays(dayKey(END), -1)]: 1 };

    terminal = renderTerminal(<Heatmap values={values} end={END} weeks={1} />, { columns: 20, rows: 10, theme: darkTheme });

    expect(await lines(terminal.screen())).toEqual(['    Oct', '    ■', 'Mon ■', '    ■', 'Wed ■', '    ■', 'Fri ■', '    ■']);
    expect(await terminal.colorOf('Fri ■', 4)).toBe(darkTheme.heat[1]);
    expect(await terminal.colorOf('Mon ■', 4)).toBe(darkTheme.heat[0]);
  });

  it('marks the selected day with a square like the rest, in the accent color', async () => {
    terminal = renderTerminal(<Heatmap values={{}} end={END} weeks={2} selected={addDays(dayKey(END), -1)} />, {
      columns: 20,
      rows: 10,
      theme: darkTheme,
    });

    expect(await lines(terminal.screen())).toContain('Fri ■ ■');
    expect(await terminal.colorOf('Fri ■ ■', 6)).toBe(darkTheme.accent);
    expect(await terminal.colorOf('Fri ■ ■', 4)).toBe(darkTheme.heat[0]);

    expect(heatLevels([1, 2, 3, 4, 100])(100)).toBe(4);
    expect(heatLevels([1, 2, 3, 4, 100])(1)).toBe(1);
    expect(heatLevels([1, 2, 3, 4, 100])(0)).toBe(0);
  });
});

describe('Waffle', () => {
  it('shares the squares out in proportion, at least one for anything there, all of them used', () => {
    expect(waffleCells([50, 30, 20], 10)).toEqual([5, 3, 2]);
    expect(waffleCells([1, 9_000, 999], 100)).toEqual([1, 90, 9]);
    expect(waffleCells([0, 0], 4)).toEqual([0, 0]);
    expect(waffleCells([1, 0, 3], 4).reduce((a, b) => a + b)).toBe(4);
  });

  it('fills the grid part by part, with the legend beside it', async () => {
    terminal = renderTerminal(
      <Waffle
        columns={4}
        rows={2}
        legend
        parts={[
          { label: 'Messages', value: 3, color: darkTheme.accent, text: '3 tokens' },
          { label: 'Free space', value: 5, color: darkTheme.heat[0] },
        ]}
      />,
      { columns: 40, rows: 3, theme: darkTheme },
    );

    expect(await lines(terminal.screen())).toEqual(['■ ■ ■ ■   ■ Messages    3 tokens', '■ ■ ■ ■   ■ Free space']);
    expect(await terminal.colorOf('■ ■ ■ ■   ■ Messages', 4)).toBe(darkTheme.accent);
    expect(await terminal.colorOf('■ ■ ■ ■   ■ Messages', 6)).toBe(darkTheme.heat[0]);
  });
});

describe('StatGrid', () => {
  it('lines up the labels of each column', async () => {
    terminal = renderTerminal(
      <StatGrid
        stats={[
          { label: 'Sessions', value: '435' },
          { label: 'Longest session', value: '7d 2h' },
          { label: 'Active days', value: '61', detail: 'of 76' },
          { label: 'Streak', value: '21 days' },
        ]}
      />,
      { columns: 60, rows: 4 },
    );

    expect(await lines(terminal.screen())).toEqual([
      'Sessions     435              Longest session  7d 2h',
      'Active days  61 of 76         Streak           21 days',
    ]);
  });
});

describe('BarList', () => {
  it('lines up bars of shares after their labels, with a line of detail under', async () => {
    terminal = renderTerminal(
      <BarList
        width={10}
        bars={[
          { label: 'Opus 5.5', value: 0.5, text: '50%', detail: 'in 12k · out 1.4M' },
          { label: 'Haiku 4.5', value: 0.1, text: '10%' },
        ]}
      />,
      { columns: 40, rows: 4 },
    );

    expect(await lines(terminal.screen())).toEqual([
      'Opus 5.5   [=====-----] 50%',
      '           in 12k · out 1.4M',
      'Haiku 4.5  [=---------] 10%',
    ]);
  });

  it('keeps a bar whole on one line and cuts the text after it short when the line is too narrow', async () => {
    terminal = renderTerminal(
      <BarList width={10} bars={[{ label: 'Long context', value: 0.4, text: '40% sessions that went past 200k tokens of context' }]} />,
      { columns: 40, rows: 3 },
    );

    expect(await lines(terminal.screen())).toEqual(['Long context  [====------] 40% sessions…']);
  });
});
