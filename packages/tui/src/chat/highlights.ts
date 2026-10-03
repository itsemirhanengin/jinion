import { useMemo } from 'react';
import { anyOf, MENTION } from './mentions.js';
import { PASTED_IMAGE } from './pasted-images.js';
import { PASTED_TEXT } from './pasted-texts.js';

export const PLACEHOLDERS = anyOf([PASTED_TEXT, PASTED_IMAGE])!;

export function useMentions(mentions: (RegExp | undefined)[]) {
  const patterns = mentions.map((pattern) => pattern?.source ?? '').join('\n');
  return useMemo(() => anyOf([MENTION, ...mentions])!, [patterns]);
}
