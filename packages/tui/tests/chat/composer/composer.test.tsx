import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { KEYS, renderTerminal, type TestTerminal } from '../../../src/testing/index.js';
import { darkTheme } from '../../../src/theme/themes.js';
import { namedMention } from '../../../src/chat/mentions.js';
import { Composer } from '../../../src/chat/composer/composer.js';
import type { CompletionSource } from '../../../src/chat/composer/use-completion.js';

const SKILLS = [
  { name: 'hello', group: 'Project' },
  { name: 'design', group: 'Yours' },
  { name: 'ideas', group: 'Yours' },
  { name: 'nextjs', group: 'vercel' },
];

const skills: CompletionSource = (value, cursor) => {
  const typed = /(?:^|\s)\$(\w*)$/.exec(value.slice(0, cursor));
  if (!typed) return undefined;

  const items = SKILLS.filter((skill) => skill.name.startsWith(typed[1]!)).map((skill) => ({
    key: skill.name,
    label: skill.name,
    group: skill.group,
    insert: `$${skill.name} `,
  }));

  return { from: cursor - typed[1]!.length - 1, to: cursor, items };
};

function Prompt({ onSubmit, onPasteKey }: { onSubmit: (text: string) => void; onPasteKey?: () => Promise<string | undefined> }) {
  const [value, setValue] = useState('');

  return (
    <Composer
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      onPasteKey={onPasteKey}
      completions={[skills]}
      mentions={[namedMention('$', SKILLS.map((skill) => skill.name))]}
    />
  );
}

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

describe('Composer', () => {
  it('shows grouped completions under their headers', async () => {
    terminal = renderTerminal(<Prompt onSubmit={() => {}} />, { columns: 60, rows: 16 });
    await terminal.type('$');
    const screen = await terminal.waitFor('vercel');
    const list = screen.split('\n').filter((line) => line.trim()).slice(-8, -1).map((line) => line.trimEnd());

    expect(list).toEqual(['   Project', ' >   hello', '   Yours', '     design', '     ideas', '   vercel', '     nextjs']);
  });

  it('puts an image pasted with ctrl+v where the cursor is, and the cursor right after it', async () => {
    const sent: string[] = [];
    const image = async () => '[Image #1]';

    terminal = renderTerminal(<Prompt onSubmit={(text) => sent.push(text)} onPasteKey={image} />, { columns: 60, rows: 16 });
    await terminal.type('compare  with the design');
    await terminal.press(...Array<string>(16).fill(KEYS.left));
    await terminal.press('\x16');
    await terminal.waitFor('[Image #1]');
    await terminal.type('closely');
    await terminal.press(KEYS.enter);

    expect(sent).toEqual(['compare [Image #1]closely with the design']);
  });

  it('inserts the picked item and highlights known mentions only', async () => {
    const sent: string[] = [];

    terminal = renderTerminal(<Prompt onSubmit={(text) => sent.push(text)} />, { columns: 60, rows: 16 });
    await terminal.type('fix it $de');
    await terminal.press(KEYS.tab);
    await terminal.type('and $HOME');
    await terminal.waitFor('fix it $design and $HOME');

    expect(await terminal.colorOf('$design')).toBe(darkTheme.code);
    expect(await terminal.colorOf('$HOME')).toBeUndefined();

    await terminal.press(KEYS.enter);
    expect(sent).toEqual(['fix it $design and $HOME']);
  });
});
