import { Button } from '@jinion/ui';
import { TodoList } from '@jinion/ui/chat';
import { Bot, Square, Terminal } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Feature } from '@jinion/workbench';
import { useActiveSession, useCore } from '../state/session.js';

/** The bottom panel: the shown thread's todos, its commands in the background with their output, and its subagents. */
export function tasks(): Feature {
  return { id: 'tasks', views: [{ id: 'tasks', title: 'Tasks', place: 'bottom', Content: Tasks }] };
}

function Tasks() {
  const core = useCore();
  const session = useActiveSession();

  if (!session) return <p className="px-4 text-muted">Open a thread to see its tasks.</p>;

  const { state, fields } = session;
  const agents = state.entries.flatMap((entry) => (entry.kind === 'tool' && entry.run.name === 'agent' ? [entry] : []));

  if (state.todos.length === 0 && fields.tasks.length === 0 && agents.length === 0) {
    return (
      <p className="px-4 text-pretty text-muted">Todos, commands in the background and subagents show here.</p>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      {state.todos.length > 0 && (
        <Section title="Todos">
          <TodoList groups={state.todos} />
        </Section>
      )}
      {fields.tasks.length > 0 && (
        <Section title="In the background">
          {fields.tasks.map((task) => (
            <div key={task.id} className="overflow-hidden rounded-xl ring-1 ring-edge">
              <div className="flex h-9 items-center gap-2 border-b border-line bg-raised pr-1 pl-3">
                <Terminal className="size-4 shrink-0 text-faint" />
                <code className="min-w-0 flex-1 truncate font-mono text-mono">{task.title}</code>
                <span className="text-faint">{task.status}</span>
                {task.status === 'running' && (
                  <Button size="icon" aria-label="Stop" onClick={() => void core.stopTask(session.id, task.id)} className="[&_svg]:fill-current">
                    <Square />
                  </Button>
                )}
              </div>
              <pre className="max-h-60 overflow-auto px-3 py-2 font-mono text-mono whitespace-pre select-text">{task.output || ' '}</pre>
            </div>
          ))}
        </Section>
      )}
      {agents.length > 0 && (
        <Section title="Subagents">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-2">
              <Bot className="size-4 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate">{agent.run.name === 'agent' && agent.run.input.description}</span>
              <span className="text-faint tabular-nums">{agent.children?.length ?? 0} calls</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted">{title}</h2>
      {children}
    </section>
  );
}
