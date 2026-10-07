import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import type { Entry } from '@jinion/core/conversation/entries';
import { keyOf, type Workbench } from '@jinion/workbench';
import { counted } from '../../lib/numbers.js';

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

/**
 * What the plan reaches, as its row in the conversation says it: `3 steps · 3 files · a diagram`. Steps are its numbered
 * items, files the items under a heading that names them; what the plan doesn't have is left out.
 */
export function planReach(plan: string) {
  let section = '';
  let steps = 0;
  let files = 0;
  let diagrams = 0;
  let fenced = false;

  for (const line of plan.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      if (!fenced && /^\s*```mermaid/.test(line)) diagrams++;
      fenced = !fenced;
    } else if (fenced) {
      // What a code block holds is code, not steps or files.
    } else if (/^#{1,6}\s/.test(line)) {
      section = line.replace(/^#+\s*/, '').toLowerCase();
    } else if (/^\s*\d+[.)]\s/.test(line)) {
      steps++;
    } else if (/^\s*[-*]\s/.test(line) && section.includes('file')) {
      files++;
    }
  }

  return [
    steps > 0 && counted(steps, 'step'),
    files > 0 && counted(files, 'file'),
    diagrams === 1 ? 'a diagram' : diagrams > 1 && counted(diagrams, 'diagram'),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The modes a plan can be built in, as its answer offers them. */
export const planOptions = (modes: AgentMode[]) => modes.map((mode) => ({ id: mode, label: MODES[mode].name, description: MODES[mode].description }));

/** The plan's tab: the one `entry` names, or the thread's latest. */
export function openPlan(workbench: Workbench, session: string, entry: string) {
  workbench.open({ kind: 'plan', id: `${session}|${entry}` });
}

/** The thread's share of the room once its plan opens beside it. */
const THREAD_SHARE = 0.7;

const shownBeside = new Set<string>();

/**
 * A new plan beside its thread, in a group of its own on the right, a third of the room, the keys left with the thread;
 * once for each plan, so one the user closed stays closed.
 */
export function showPlanBeside(workbench: Workbench, session: string, entry: string) {
  if (shownBeside.has(entry)) return;

  shownBeside.add(entry);

  const plan = { kind: 'plan', id: `${session}|${entry}` };
  const thread = `thread:${session}`;
  const threadGroup = () => workbench.getLayout().groups.findIndex((group) => group.tabs.some((tab) => keyOf(tab) === thread));

  if (workbench.getLayout().groups.length > 1) {
    workbench.open(plan, { group: threadGroup() === 0 ? 1 : 0 });
  } else {
    workbench.open(plan);
    workbench.splitTo(keyOf(plan), 'right');
    workbench.resizeSplit(THREAD_SHARE);
  }

  workbench.focusGroup(Math.max(0, threadGroup()));
}

export function planTab(id: string) {
  const [session = '', entry = ''] = id.split('|');

  return { session, entry };
}
