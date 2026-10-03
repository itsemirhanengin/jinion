import { expect, it } from 'vitest';
import { darkTheme, hoverColor, lightTheme, shade } from '../../src/theme/themes.js';

it('shades a color toward black on a light background and toward white on a dark one', () => {
  expect(shade(lightTheme, '#ffffff', 0.5)).toBe('#808080');
  expect(shade(darkTheme, '#000000', 0.5)).toBe('#808080');
  expect(shade(darkTheme, '#1b261d', 0)).toBe('#1b261d');
});

it('lights up a tinted surface a touch in its own color, and a plain one from the terminal’s background', () => {
  expect(hoverColor(darkTheme, darkTheme.surface.success)).toBe('#242f26');
  expect(hoverColor(lightTheme, lightTheme.surface.success)).toBe('#d8e3d3');
  expect(hoverColor({ ...lightTheme, background: '#f7f7f7' })).toBe('#ededed');
  expect(hoverColor(lightTheme)).toBe('#f5f5f5');
});
