import { busyAtom } from '../state/session.js';
import { useEffect } from 'react';
import { StatusBar } from '@jinion/tui/chat';
import { useAtomValue, useSetAtom } from 'jotai';
import { shownStatusItemsAtom } from '../status/items.js';
import { gitStatusAtom, useNow, useStatusData } from '../status/data.js';
import { useGitStatus } from '../status/git.js';
import { renderStatusLine } from '../status/line.js';
import { findSegment } from '../status/segments/index.js';
import { useWorkdir } from '../ui/use-workdir.js';

export function StatusLine() {
  const items = useAtomValue(shownStatusItemsAtom);
  const busy = useAtomValue(busyAtom);
  const setGit = useSetAtom(gitStatusAtom);

  const segments = items.map((item) => findSegment(item.id));
  const git = useGitStatus(useWorkdir(), segments.some((segment) => segment?.git), busy);

  useEffect(() => setGit(git), [git]);

  const data = useStatusData(useNow(segments.some((segment) => segment?.ticks)));
  const line = renderStatusLine(items, data);

  return <StatusBar items={line.left} right={line.right} />;
}
