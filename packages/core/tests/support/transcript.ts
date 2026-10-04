import type { AgentEvent } from '../../src/agent/events.js';

/** Events as lines a snapshot can show, with tool call ids numbered in the order they come. */
export function transcript(events: AgentEvent[]) {
  const ids = new Map<string, string>();

  const id = (raw: string) => {
    if (!ids.has(raw)) ids.set(raw, `t${ids.size + 1}`);

    return ids.get(raw)!;
  };

  const lines: string[] = [];

  for (const event of events) {
    const last = lines.at(-1);

    switch (event.type) {
      case 'text':
      case 'thinking':
        if (last?.startsWith(`${event.type}: `)) lines[lines.length - 1] = last + event.delta;
        else lines.push(`${event.type}: ${event.delta}`);

        break;

      case 'tool-start':
        lines.push(`start ${id(event.id)} ${event.call.name} ${JSON.stringify(event.call.input)}${event.parent ? ` in ${id(event.parent)}` : ''}`);
        break;

      case 'tool-output':
        lines.push(`output ${id(event.id)} ${JSON.stringify(event.lines)}`);
        break;

      case 'tool-end': {
        // Durations differ from run to run.
        const result = event.result && 'wallMs' in event.result ? { ...event.result, wallMs: 0 } : event.result;

        lines.push(`end ${id(event.id)} ${event.ok ? 'ok' : 'failed'} ${JSON.stringify(result ?? {})}${event.parent ? ` in ${id(event.parent)}` : ''}`);
        break;
      }

      case 'usage': {
        const line = `usage ${event.usage.contextTokens}/${event.usage.contextWindow} $${event.usage.cost.toFixed(4)}`;

        if (line !== last) lines.push(line);
        break;
      }

      case 'limits':
        lines.push(`limits ${event.windows.map((window) => window.label).join(', ')}`);
        break;

      case 'session':
        lines.push('session');
        break;

      case 'mode':
        if (`mode ${event.mode}` !== last) lines.push(`mode ${event.mode}`);
        break;

      case 'tasks':
        lines.push(
          `tasks ${event.tasks.map((task) => `${task.kind}${task.foreground ? ' foreground' : ''} ${task.status} ${JSON.stringify(task.title)}`).join(', ')}`,
        );

        break;

      case 'task-end':
        lines.push(`task-end ${JSON.stringify(event.task.title)} ${event.task.status}: ${event.summary}`);
        break;

      case 'compaction':
        lines.push(
          event.state === 'done'
            ? `compaction ${event.trigger} ${event.before} -> ${event.after}: ${event.summary?.split('\n')[0]}`
            : `compaction ${event.state}`,
        );

        break;
    }
  }

  return lines;
}

export const started = (events: AgentEvent[]) =>
  events.flatMap((event) => (event.type === 'tool-start' ? [event.call] : []));
