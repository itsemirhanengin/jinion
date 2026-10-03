import { afterEach, describe, expect, it } from 'vitest';
import { StatGrid } from '../primitives/stat-grid.js';
import { renderTerminal, type TestTerminal } from '../testing/index.js';
import { darkTheme } from '../theme/themes.js';
import { BarList } from './bar-list.js';
import { addDays, dayKey, Heatmap, heatLevels } from './heatmap.js';

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

/** A Saturday, so the last week is whole. */
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
    // Friday had a little, Saturday the most.
    expect(await terminal.colorOf('Fri ■', 4)).toBe(darkTheme.heat[1]);
    expect(await terminal.colorOf('Mon ■', 4)).toBe(darkTheme.heat[0]);
  });

  it('marks the selected day with a square like the rest, in the accent color', async () => {
    terminal = renderTerminal(<Heatmap values={{}} end={END} weeks={2} selected={addDays(dayKey(END), -1)} />, {
      columns: 20,
      rows: 10,
      theme: darkTheme,
    });
    // Friday's row: the same squares, the last one marked.
    expect(await lines(terminal.screen())).toContain('Fri ■ ■');
    expect(await terminal.colorOf('Fri ■ ■', 6)).toBe(darkTheme.accent);
    expect(await terminal.colorOf('Fri ■ ■', 4)).toBe(darkTheme.heat[0]);
    // The busiest day is the last level; the theme's shades go from nothing to the most.
    expect(heatLevels([1, 2, 3, 4, 100])(100)).toBe(4);
    expect(heatLevels([1, 2, 3, 4, 100])(1)).toBe(1);
    expect(heatLevels([1, 2, 3, 4, 100])(0)).toBe(0);
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
});
