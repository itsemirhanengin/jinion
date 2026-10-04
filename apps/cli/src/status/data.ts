import { useEffect, useState } from 'react';
import { useTheme } from '@jinion/tui';
import { atom, useAtomValue } from 'jotai';
import type { GitStatus } from '@jinion/core/api/protocol';
import { limitsKey } from '@jinion/core/agent/usage';
import { useApi } from '../app/api.js';
import { accountAtom, identityAtom, modeAtom, modelNameAtom, seenLimitsAtom, selectionAtom, sessionAtom } from '../state/session.js';
import type { StatusData } from './segment.js';

/** Set by the status line, which runs `git status` only while a shown segment needs it. */
export const gitStatusAtom = atom<GitStatus | undefined>(undefined);

export function useStatusData(now = Date.now()): StatusData {
  const { agent, info } = useApi().initialized;
  const account = useAtomValue(accountAtom);
  const seen = useAtomValue(seenLimitsAtom);

  return {
    version: info.version,
    cwd: info.cwd,
    agent: agent.name,
    model: { name: useAtomValue(modelNameAtom), selection: useAtomValue(selectionAtom) },
    mode: useAtomValue(modeAtom),
    account: useAtomValue(identityAtom),
    session: useAtomValue(sessionAtom),
    git: useAtomValue(gitStatusAtom),
    limits: seen[limitsKey(agent.name, account)]?.windows,
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
