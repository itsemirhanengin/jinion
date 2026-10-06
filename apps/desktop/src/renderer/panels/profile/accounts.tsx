import { type AgentAccount, accountLabel } from '@jinion/core/agent/accounts';
import { ActionMenu, Button, classNames } from '@jinion/ui';
import { useAtomValue } from 'jotai';
import { Ellipsis, ExternalLink, LoaderCircle, Plus } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useCore } from '../../state/session.js';

interface Signing {
  agent: string;
  name: string;
  link?: string;
  prompt?: string;
  problem?: string;
}

/**
 * Every backend's accounts in one list, Claude's and Codex's alike: the one each uses marked, the rest a click away in
 * a row's menu; a new one connects from the button under them.
 */
export function Accounts() {
  const core = useCore();
  const app = useAtomValue(core.appAtom);

  const [lists, setLists] = useState<Record<string, AgentAccount[]>>({});
  const [signing, setSigning] = useState<Signing>();
  const [naming, setNaming] = useState<{ agent: string; name: string }>();
  const [code, setCode] = useState('');
  const started = useRef<Signing>(undefined);

  const agents = app?.agents.filter((agent) => agent.features.accounts).map((agent) => agent.name) ?? [];

  const refresh = () =>
    Promise.all(agents.map(async (agent) => [agent, await core.client.request('accounts/list', { agent }).catch(() => [])] as const)).then((all) =>
      setLists(Object.fromEntries(all)),
    );

  useEffect(() => {
    void refresh();
  }, [agents.join()]);

  useEffect(() => {
    const update = (agent: string | undefined, name: string, patch: Partial<Signing>) =>
      setSigning((now) => (now?.name === name && now.agent === agent ? { ...now, ...patch } : now));

    const stopLink = core.client.on('accounts/sign-in-link', ({ agent, name, url }) => update(agent, name, { link: url }));
    const stopPrompt = core.client.on('accounts/sign-in-prompt', ({ agent, name, prompt, problem }) => update(agent, name, { prompt, problem }));

    return () => {
      stopLink();
      stopPrompt();

      // A sign-in left half done stops with the page.
      if (started.current) void core.client.request('accounts/sign-in-cancel', { name: started.current.name, agent: started.current.agent });
    };
  }, []);

  const signIn = async (agent: string, name: string) => {
    started.current = { agent, name };
    setSigning({ agent, name });
    setCode('');

    await core.client.request('accounts/sign-in', { name, agent }).catch(() => undefined);

    started.current = undefined;
    setSigning(undefined);
    await refresh();
  };

  const act = (call: Promise<unknown>) => void call.then(refresh, refresh);

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    if (!signing || !code.trim()) return;

    void core.client.request('accounts/sign-in-answer', { name: signing.name, agent: signing.agent, text: code.trim() });
    setSigning({ ...signing, prompt: undefined, problem: undefined });
  };

  const rows = agents.flatMap((agent) => (lists[agent] ?? []).map((account) => ({ agent, account, current: app?.accounts[agent] === account.name })));

  if (agents.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Accounts</h2>
      {rows.length > 0 && (
        <div className="flex flex-col divide-y divide-line rounded-xl ring-1 ring-edge">
          {rows.map(({ agent, account, current }) => (
            <div key={`${agent}/${account.name}`} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{account.name}</span>
                  {current && <span className="shrink-0 rounded-full bg-shade px-2 text-small text-muted">In use</span>}
                </span>
                <span className={classNames('truncate', account.signedIn ? 'text-muted' : 'text-faint')}>
                  {account.signedIn ? accountLabel(account) || 'Signed in' : 'Not signed in'}
                </span>
              </span>
              <span className="shrink-0 text-faint">{agent}</span>
              <ActionMenu
                trigger={
                  <Button size="icon" aria-label={`What to do with ${account.name}`} disabled={signing !== undefined}>
                    <Ellipsis />
                  </Button>
                }
                actions={[
                  ...(account.signedIn && !current ? [{ label: 'Use', onSelect: () => act(core.client.request('accounts/select', { name: account.name, agent })) }] : []),
                  { label: account.signedIn ? 'Sign in again' : 'Sign in', onSelect: () => void signIn(agent, account.name) },
                  ...(!account.own && !current
                    ? [{ label: 'Remove', destructive: true, onSelect: () => act(core.client.request('accounts/remove', { name: account.name, agent })) }]
                    : []),
                ]}
              />
            </div>
          ))}
        </div>
      )}
      {signing && (
        <div className="flex flex-col gap-3 rounded-xl bg-raised p-4 ring-1 ring-edge">
          <div className="flex items-center gap-2 font-medium">
            <LoaderCircle className="size-4 animate-spin text-muted" />
            Signing in to {signing.agent} as {signing.name}
          </div>
          {signing.link && (
            <div className="flex items-center gap-2 text-muted">
              Continue in your browser.
              <Button variant="outline" size="small" onClick={() => window.open(signing.link)}>
                <ExternalLink />
                Open the page again
              </Button>
            </div>
          )}
          {signing.prompt && (
            <form onSubmit={sendCode} className="flex flex-col gap-2">
              <span>{signing.prompt}</span>
              {signing.problem && <span className="text-error">{signing.problem}</span>}
              <div className="flex gap-2">
                <input
                  ref={(field) => field?.focus()}
                  name="code"
                  aria-label="The code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-lg bg-background px-3 font-mono text-mono ring-1 ring-edge outline-none focus:ring-primary/40"
                />
                <Button type="submit" variant="primary" size="small">
                  Send
                </Button>
              </div>
            </form>
          )}
          <div>
            <Button size="small" onClick={() => void core.client.request('accounts/sign-in-cancel', { name: signing.name, agent: signing.agent })}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {naming ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!naming.name.trim()) return;

            void signIn(naming.agent, naming.name.trim());
            setNaming(undefined);
          }}
        >
          <input
            ref={(field) => field?.focus()}
            name="account"
            aria-label={`A name for the ${naming.agent} account`}
            value={naming.name}
            onChange={(event) => setNaming({ ...naming, name: event.target.value })}
            placeholder={`A name for the ${naming.agent} account, such as work`}
            className="h-8 min-w-0 flex-1 rounded-lg bg-shade px-3 outline-none placeholder:text-faint"
          />
          <Button type="submit" variant="primary" size="small">
            Sign in
          </Button>
          <Button size="small" onClick={() => setNaming(undefined)}>
            Cancel
          </Button>
        </form>
      ) : (
        agents.length > 0 && (
          <div>
            <ActionMenu
              align="start"
              trigger={
                <Button variant="outline" size="small" disabled={signing !== undefined}>
                  <Plus />
                  Connect an account
                </Button>
              }
              actions={agents.map((agent) => ({ label: `${agent} account`, onSelect: () => setNaming({ agent, name: '' }) }))}
            />
          </div>
        )
      )}
    </section>
  );
}
