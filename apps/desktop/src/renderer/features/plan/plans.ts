import type { Entry } from '@jinion/core/conversation/entries';
import type { Workbench } from '@jinion/workbench';

export interface PlanEntry {
  id: string;
  plan: string;
}

/** The thread's plans, oldest first, as the agent wrote them. */
export function plansOf(entries: Entry[]): PlanEntry[] {
  return entries.flatMap((entry) => (entry.kind === 'tool' && entry.run.name === 'plan' ? [{ id: entry.id, plan: entry.run.input.plan }] : []));
}

/** The plan's first heading, or its first line, as its tab names it. */
export function planTitle(plan: string) {
  const lines = plan.split('\n').map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => line.startsWith('#'));

  return (heading ?? lines[0] ?? 'Plan').replace(/^#+\s*/, '').replace(/^Plan:\s*/i, '');
}

/** The plan's tab: the one `entry` names, or the thread's latest. */
export function openPlan(workbench: Workbench, session: string, entry: string) {
  workbench.open({ kind: 'plan', id: `${session}|${entry}` });
}

export function planTab(id: string) {
  const [session = '', entry = ''] = id.split('|');

  return { session, entry };
}
