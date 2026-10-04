import { useEffect, useState } from 'react';
import { Panel, Tabs, useInput, usePanel, useTabs, type KeyHint } from '@jinion/tui';
import type { AgentUsage, UsageHistory } from '@jinion/core/agent/usage';
import { errorMessage } from '@jinion/core/lib/errors';
import { useAtomValue } from 'jotai';
import { useApi } from '../../app/api.js';
import { agentAtom } from '../../state/session.js';
import { StatsView } from './stats-view.js';
import { UsageView } from './usage-view.js';

const TABS = ['Usage', 'Stats'] as const;
export type UsageTab = 'usage' | 'stats';

const HINTS: Record<UsageTab, KeyHint[]> = {
  usage: [
    ['Tab', 'stats'],
    ['d/w', 'last day or week'],
    ['Esc', 'close'],
  ],
  stats: [
    ['Tab', 'usage'],
    ['Arrows', 'pick a day'],
    ['r', 'range'],
    ['Esc', 'close'],
  ],
};

export function UsagePanel({ tab = 'usage' }: { tab?: UsageTab }) {
  const agent = useAtomValue(agentAtom);
  const { close } = usePanel();

  const [active] = useTabs(TABS.length, { initial: tab === 'stats' ? 1 : 0, arrows: false });
  const loaded = useUsage(agent.features);

  useInput((_, key) => {
    if (key.escape) close();
  });

  return (
    <Panel title="Usage" subtitle={agent.name} header={<Tabs tabs={[...TABS]} active={active} />} grow hints={HINTS[active === 0 ? 'usage' : 'stats']}>
      {active === 0 ? (
        <UsageView usage={loaded.usage} error={loaded.usageError} available={agent.features.usage} />
      ) : (
        <StatsView history={loaded.history} progress={loaded.progress} error={loaded.historyError} available={agent.features.history} />
      )}
    </Panel>
  );
}

/** Both tabs load at once, so switching shows what is already there. */
function useUsage(features: { usage: boolean; history: boolean }) {
  const api = useApi();

  const [usage, setUsage] = useState<AgentUsage>();
  const [usageError, setUsageError] = useState<string>();
  const [history, setHistory] = useState<UsageHistory>();
  const [progress, setProgress] = useState<[done: number, total: number]>();
  const [historyError, setHistoryError] = useState<string>();

  useEffect(() => {
    let open = true;
    const failed = (set: (message: string) => void) => (error: unknown) => open && set(errorMessage(error));

    // The limits come quickly; what adds to them takes a look through the week's conversations.
    if (features.usage) {
      api
        .request('usage/limits', { drivers: false })
        .then((quick) => {
          if (!open) return;

          setUsage(quick);

          return api.request('usage/limits', { drivers: true }).then((full) => open && setUsage(full));
        })
        .catch(failed(setUsageError));
    }

    const stopProgress = api.client.on('usage/history-progress', ({ done, total }) => open && setProgress([done, total]));

    if (features.history) api.request('usage/history', {}).then((days) => open && setHistory(days), failed(setHistoryError));

    return () => {
      open = false;
      stopProgress();
    };
  }, []);

  return { usage, usageError, history, progress, historyError };
}
