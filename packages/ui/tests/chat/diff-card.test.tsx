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

test('offers a comment only on lines with a number', () => {
  const numbered: DiffLine[] = [
    { kind: 'context', text: 'one', number: 1 },
    { kind: 'context', text: '' },
    { kind: 'added', text: 'two', number: 9 },
  ];

  const html = renderToStaticMarkup(<DiffCard path="a.ts" lines={numbered} bare onComment={() => {}} />);

  expect(html).toContain('Comment on line 1');
  expect(html).toContain('Comment on line 9');
  expect(html.match(/Comment on line/g)).toHaveLength(2);
});

test('draws a comment under the last line it is on, and one whose lines are gone above them all', () => {
  const numbered: DiffLine[] = [
    { kind: 'context', text: 'first', number: 4 },
    { kind: 'added', text: 'second', number: 5 },
    { kind: 'added', text: 'third', number: 6 },
  ];

  const html = renderToStaticMarkup(
    <DiffCard
      path="a.ts"
      lines={numbered}
      bare
      comments={[
        { id: 'a', text: 'Rename this', from: 0, to: 1 },
        { id: 'b', text: 'Gone', from: undefined, to: undefined },
      ]}
    />,
  );

  expect(html).toContain('Lines 4-5');
  expect(html.indexOf('Gone')).toBeLessThan(html.indexOf('first'));
  expect(html.indexOf('second')).toBeLessThan(html.indexOf('Rename this'));
  expect(html.indexOf('Rename this')).toBeLessThan(html.indexOf('third'));
  expect(html).toContain('Outdated');
});

test('shows the first lines of a long change until opened', () => {
  const html = renderToStaticMarkup(<DiffCard path="src/server.ts" lines={lines(20)} folded={5} defaultOpen />);

  expect(html).toContain('line 4');
  expect(html).not.toContain('line 5');
  expect(html).toContain('Show all');
});
