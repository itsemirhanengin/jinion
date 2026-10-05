import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { Button, Empty } from '@jinion/ui';
import { TodoList } from '@jinion/ui/chat';
import { Bot, Square, Terminal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCore } from '../../state/session.js';

/** The thread's todos, its commands in the background with their output, and its subagents. */
export function Tasks({ session }: { session: SessionSnapshot & { id: string } }) {
  const core = useCore();

  const { state, fields } = session;
  const agents = state.entries.flatMap((entry) => (entry.kind === 'tool' && entry.run.name === 'agent' ? [entry] : []));

  if (state.todos.length === 0 && fields.tasks.length === 0 && agents.length === 0) {
    return (
      <div className="p-4">
        <Empty>Todos, commands in the background and subagents show here.</Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {state.todos.length > 0 && (
        <Section title="Todos">
          <TodoList groups={state.todos} />
        </Section>
      )}
      {fields.tasks.length > 0 && (
        <Section title="In the background">
          {fields.tasks.map((task) => (
            <div key={task.id} className="overflow-hidden rounded-xl border border-line">
              <div className="flex h-9 items-center gap-2 border-b border-line pr-1.5 pl-3">
                <Terminal className="size-3.5 text-muted" />
                <code className="min-w-0 flex-1 truncate font-mono text-mono">{task.title}</code>
                <span className={task.status === 'running' ? 'text-small text-working' : 'text-small text-faint'}>{task.status}</span>
                {task.status === 'running' && (
                  <Button size="icon" aria-label="Stop" onClick={() => void core.stopTask(session.id, task.id)} className="[&_svg]:size-3 [&_svg]:fill-current">
                    <Square />
                  </Button>
                )}
              </div>
              <pre className="max-h-60 overflow-auto bg-sidebar px-3 py-2 font-mono text-mono whitespace-pre select-text">{task.output || ' '}</pre>
            </div>
          ))}
        </Section>
      )}
      {agents.length > 0 && (
        <Section title="Subagents">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-2">
              <Bot className="size-3.5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{agent.run.name === 'agent' && agent.run.input.description}</span>
              <span className="text-small text-faint">{agent.children?.length ?? 0} calls</span>
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
      <h2 className="text-small font-medium text-muted">{title}</h2>
      {children}
    </section>
  );
}
