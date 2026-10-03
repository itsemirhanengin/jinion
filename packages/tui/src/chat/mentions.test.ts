import { describe, expect, it } from 'vitest';
import { anyOf, MENTION, mention, namedMention } from './mentions.js';

const matches = (text: string, pattern: RegExp | undefined) => [...text.matchAll(pattern!)].map((match) => match[0]);

describe('MENTION', () => {
  it('finds paths at the start and after whitespace, quoted or not', () => {
    expect(matches('@src/app.tsx and @"docs/release notes.md"', MENTION)).toEqual([
      '@src/app.tsx',
      '@"docs/release notes.md"',
    ]);
  });

  it('leaves emails alone', () => {
    expect(matches('mail me@example.com', MENTION)).toEqual([]);
  });

  it('quotes paths with spaces', () => {
    expect(mention('a b.md')).toBe('@"a b.md"');
    expect(mention('a.md')).toBe('@a.md');
  });
});

describe('namedMention', () => {
  const skills = namedMention('$', ['design', 'design-system', 'vercel:nextjs']);

  it('finds known names only', () => {
    expect(matches('use $design and $vercel:nextjs, not $HOME', skills)).toEqual(['$design', '$vercel:nextjs']);
  });

  it('prefers the longest name', () => {
    expect(matches('$design-system', skills)).toEqual(['$design-system']);
  });

  it('leaves trailing punctuation out and needs a word boundary', () => {
    expect(matches('try $design. Or $designer', skills)).toEqual(['$design']);
  });

  it('is undefined without names', () => {
    expect(namedMention('$', [])).toBeUndefined();
  });
});

describe('anyOf', () => {
  it('matches what any pattern matches', () => {
    const pattern = anyOf([MENTION, namedMention('$', ['design']), undefined]);
    expect(matches('@a.ts with $design', pattern)).toEqual(['@a.ts', '$design']);
  });

  it('returns a single pattern as it is', () => {
    expect(anyOf([MENTION, undefined])).toBe(MENTION);
  });
});
