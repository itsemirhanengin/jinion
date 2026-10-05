import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Prose } from '../../src/chat/prose.js';

test('draws markdown, with tables from GitHub', () => {
  const html = renderToStaticMarkup(<Prose text={'**limit** `100`\n\n| a | b |\n| - | - |\n| 1 | 2 |'} />);

  expect(html).toContain('<strong>limit</strong>');
  expect(html).toContain('<code>100</code>');
  expect(html).toContain('<table>');
});

test('keeps raw HTML a model writes as text', () => {
  const html = renderToStaticMarkup(<Prose text={'<img src=x onerror="alert(1)"> and <script>alert(2)</script>'} />);

  expect(html).not.toContain('<img');
  expect(html).not.toContain('<script');
});
