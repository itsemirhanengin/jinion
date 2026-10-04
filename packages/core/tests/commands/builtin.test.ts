import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { builtinCommands } from '../../src/commands/builtin.js';

const PAGE = join(import.meta.dirname, '../../../../apps/docs/content/docs/reference/(commands)/commands.mdx');

describe('builtinCommands', () => {
  it('are all on the docs’ commands page, with their aliases', () => {
    const page = readFileSync(PAGE, 'utf8');
    const names = builtinCommands.flatMap((command) => [command.name, ...(command.aliases ?? [])]);

    expect(names.filter((name) => !new RegExp(`\`/${name}[\` ]`).test(page))).toEqual([]);
  });
});
