import { useEffect, useState } from 'react';
import { Panel, Tabs, useInput, usePanel, useTabs, type KeyHint } from '@jinion/tui';
import type { AgentUsage, UsageHistory } from '../../agent/usage.js';
import { useJinion } from '../../app/context.js';
import { errorMessage } from '../../lib/errors.js';
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
  const { agent } = useJinion();
  const { close } = usePanel();

  const [active] = useTabs(TABS.length, { initial: tab === 'stats' ? 1 : 0, arrows: false });
  const loaded = useUsage();

  useInput((_, key) => {
    if (key.escape) close();
  });

  return (
    <Panel title="Usage" subtitle={agent.name} header={<Tabs tabs={[...TABS]} active={active} />} grow hints={HINTS[active === 0 ? 'usage' : 'stats']}>
      {active === 0 ? (
        <UsageView usage={loaded.usage} error={loaded.usageError} available={agent.usage !== undefined} />
      ) : (
        <StatsView history={loaded.history} progress={loaded.progress} error={loaded.historyError} available={agent.history !== undefined} />
      )}
    </Panel>
  );
}

/** Both tabs load at once, so switching shows what is already there. */
function useUsage() {
  const { agent } = useJinion();

  const [usage, setUsage] = useState<AgentUsage>();
  const [usageError, setUsageError] = useState<string>();
  const [history, setHistory] = useState<UsageHistory>();
  const [progress, setProgress] = useState<[done: number, total: number]>();
  const [historyError, setHistoryError] = useState<string>();

  useEffect(() => {
    let open = true;
    const failed = (set: (message: string) => void) => (error: unknown) => open && set(errorMessage(error));
    const current = agent.usage?.bind(agent);

    // The limits come quickly; what adds to them takes a look through the week's conversations.
    current?.({ drivers: false })
      .then((quick) => {
        if (!open) return;

        setUsage(quick);

        return current({ drivers: true }).then((full) => open && setUsage(full));
      })
      .catch(failed(setUsageError));

    agent.history
      ?.((done, total) => open && setProgress([done, total]))
      .then((days) => open && setHistory(days), failed(setHistoryError));

    return () => {
      open = false;
    };
  }, []);

  return { usage, usageError, history, progress, historyError };
}
