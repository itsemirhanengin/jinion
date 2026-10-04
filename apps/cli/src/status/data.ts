import { useEffect, useState } from 'react';
import { useTheme } from '@jinion/tui';
import { atom, useAtomValue } from 'jotai';
import { useJinion } from '../app/context.js';
import { modeAtom, modelNameAtom, selectionAtom, sessionAtom } from '@jinion/core/state/active';
import { limitsKey } from '@jinion/core/settings/limits';
import { accountAtom, identityAtom, seenLimitsAtom } from '@jinion/core/state/agent';
import type { GitStatus } from '@jinion/core/git/status';
import type { StatusData } from './segment.js';

/** Set by the status line, which runs `git status` only while a shown segment needs it. */
export const gitStatusAtom = atom<GitStatus | undefined>(undefined);

export function useStatusData(now = Date.now()): StatusData {
  const { backend, info } = useJinion();
  const account = useAtomValue(accountAtom);
  const seen = useAtomValue(seenLimitsAtom);

  return {
    version: info.version,
    cwd: info.cwd,
    agent: backend.name,
    model: { name: useAtomValue(modelNameAtom), selection: useAtomValue(selectionAtom) },
    mode: useAtomValue(modeAtom),
    account: useAtomValue(identityAtom),
    session: useAtomValue(sessionAtom),
    git: useAtomValue(gitStatusAtom),
    limits: seen[limitsKey(backend.name, account)]?.windows,
    now,
    theme: useTheme(),
  };
}

export function useNow(active: boolean, interval = 15_000) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!active) return;

    setNow(Date.now());

    const timer = setInterval(() => setNow(Date.now()), interval);

    return () => clearInterval(timer);
  }, [active, interval]);

  return now;
}
