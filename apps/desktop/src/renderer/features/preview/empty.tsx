import type { DevScript, DevServer } from '@jinion/core/api/protocol';
import { Button, FadeText, Spinner } from '@jinion/ui';
import { useWorkbench } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { Bot, Play, SquareTerminal } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useCore } from '../../state/session.js';
import { openTerminal } from '../terminal/use-terminals.js';

/**
 * No page yet, or one that didn't answer: the servers running in the terminals, then the scripts that start one; an
 * address goes in the bar above.
 */
export function Empty({ problem, onOpen }: { problem?: string | false; onOpen: (url: string) => void }) {
  const core = useCore();
  const workbench = useWorkbench();
  const terminals = useAtomValue(core.terminalsAtom);
  const shown = useAtomValue(core.client.shownAtom);

  const [servers, setServers] = useState<DevServer[]>();
  const [scripts, setScripts] = useState<DevScript[]>();
  const [started, setStarted] = useState<string>();

  const agents = new Set(terminals.filter((terminal) => terminal.agent).map((terminal) => terminal.id));

  useEffect(() => {
    void core.devServers().then(setServers, () => setServers([]));
  }, [terminals]);

  useEffect(() => {
    void core.devScripts(shown).then(setScripts, () => setScripts([]));
  }, [shown]);

  // A script started here opens its page here once its terminal prints where.
  useEffect(() => {
    const url = terminals.find((terminal) => terminal.id === started)?.urls?.[0];

    if (url) onOpen(url);
  }, [terminals, started]);

  const run = async (script: DevScript) => {
    const terminal = await openTerminal(core);

    await core.typeInTerminal(terminal, `${script.command}\r`);
    workbench.showView('bottom', 'terminal');
    setStarted(terminal);
  };

  if (!servers || !scripts) return <div className="flex-1" />;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-120 flex-col gap-6 px-6 pt-8 pb-10">
        {problem && <p className="px-2.5 text-pretty text-muted">{problem}</p>}
        {servers.length > 0 && (
          <Group title="Running in the terminals">
            {servers.map((server) => (
              <Row
                key={server.url}
                icon={agents.has(server.terminal) ? <Bot /> : <SquareTerminal />}
                title={server.url.replace(/^https?:\/\//, '')}
                detail={server.title}
                action="Open"
                onAction={() => onOpen(server.url)}
              />
            ))}
          </Group>
        )}
        {scripts.length > 0 && (
          <Group title="Start one">
            {scripts.map((script) => (
              <Row
                key={script.name}
                icon={<Play />}
                title={script.command}
                detail={script.script}
                action="Run"
                busy={started !== undefined}
                onAction={() => core.act(run(script))}
              />
            ))}
          </Group>
        )}
        {started && (
          <p className="flex items-center gap-2 px-2.5 text-muted">
            <Spinner className="shrink-0 text-primary" />
            Waiting for the server to say where it runs
          </p>
        )}
        {servers.length === 0 && scripts.length === 0 && (
          <p className="px-2.5 text-pretty text-muted">
            No server runs in the terminals, and package.json has no script that starts one. Start yours in a terminal, or type its address above.
          </p>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="px-2.5 pb-1 text-small text-faint">{title}</h3>
      {children}
    </div>
  );
}

function Row({ icon, title, detail, action, busy, onAction }: { icon?: ReactNode; title: string; detail: string; action: string; busy?: boolean; onAction: () => void }) {
  return (
    <div className="group menu-row text-ink hover:bg-shade [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-faint">
      {icon}
      <span className="shrink-0 font-mono text-mono">{title}</span>
      <FadeText className="text-faint">{detail}</FadeText>
      <Button size="small" disabled={busy} onClick={onAction} className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
        {action}
      </Button>
    </div>
  );
}
