import { join } from 'node:path';
import { readJson, writeJson } from '@jinion/core/lib/json-file';
import { jinionHome } from '@jinion/core/lib/paths';

export type StatusSide = 'left' | 'right';

/** A segment of the status line, where it sits and how it looks. */
export interface StatusItem {
  id: string;
  side: StatusSide;
  style?: string;
}

/** The layout is this app's own, kept in the user's settings file beside what the core keeps there. */
const file = () => join(jinionHome(), 'settings.json');

export const loadStatusLine = () => readJson<{ statusLine?: StatusItem[] }>(file(), {}).statusLine;

export const saveStatusLine = (statusLine: StatusItem[]) => writeJson(file(), { ...readJson<object>(file(), {}), statusLine });
