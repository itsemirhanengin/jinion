import { describe, expect, it } from 'vitest';
import { PastedTexts } from './pasted-texts.js';

describe('PastedTexts', () => {
  it('keeps short pastes as they are', () => {
    expect(new PastedTexts().add('one line')).toBe('one line');
  });

  it('keeps a short paste with a tab or a control character exact behind a placeholder', () => {
    const pastes = new PastedTexts();
    expect(pastes.add('id\tname')).toBe('[Pasted text #1 7 chars]');
    expect(pastes.expand('see [Pasted text #1 7 chars]')).toBe('see id\tname');
  });

  it('turns pastes of several lines or long ones into placeholders', () => {
    const pastes = new PastedTexts();
    expect(pastes.add('a\nb\nc')).toBe('[Pasted text #1 +3 lines]');
    expect(pastes.add('x'.repeat(800))).toBe('[Pasted text #2 800 chars]');
  });

  it('expands placeholders, also in text recalled later, and leaves unknown ones', () => {
    const pastes = new PastedTexts();
    const placeholder = pastes.add('a\nb');
    expect(pastes.expand(`see ${placeholder} and [Pasted text #9 +2 lines]`)).toBe(
      'see a\nb and [Pasted text #9 +2 lines]',
    );
    expect(pastes.expand(placeholder)).toBe('a\nb');
  });
});
