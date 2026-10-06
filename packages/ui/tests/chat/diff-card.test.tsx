import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { DiffCard, type DiffLine } from '../../src/chat/diff-card.js';

const lines = (count: number): DiffLine[] => Array.from({ length: count }, (_, index) => ({ kind: index % 3 === 0 ? 'removed' : 'added', text: `line ${index}` }));

test('counts the lines added and removed', () => {
  const html = renderToStaticMarkup(<DiffCard path="src/server.ts" lines={lines(6)} />);

  expect(html).toContain('+4');
  expect(html).toContain('-2');
  expect(html).not.toContain('Show all');
});

test('shows the first lines of a long change until opened', () => {
  const html = renderToStaticMarkup(<DiffCard path="src/server.ts" lines={lines(20)} folded={5} defaultOpen />);

  expect(html).toContain('line 4');
  expect(html).not.toContain('line 5');
  expect(html).toContain('Show all');
});
