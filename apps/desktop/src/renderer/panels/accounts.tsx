import { type AgentAccount, accountLabel } from '@jinion/core/agent/accounts';
import { Button, Empty, List, Page } from '@jinion/ui';
import { useAtomValue } from 'jotai';
import { CircleCheck, ExternalLink, LoaderCircle } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useActiveSession, useCore } from '../state/session.js';

interface Signing {
  name: string;
  link?: string;
  prompt?: string;
  problem?: string;
}

/**
 * Signing in with Claude or with ChatGPT for Codex. Accounts are those of the backend the thread shown runs on, as the
 * API has them; another backend's are a click away, which moves the thread there.
 */
export function Accounts() {
  const core = useCore();
  const session = useActiveSession();
  const app = useAtomValue(core.appAtom);
  const [list, setList] = useState<AgentAccount[]>();
  const [signing, setSigning] = useState<Signing>();
  const [code, setCode] = useState('');
  const [naming, setNaming] = useState<string>();
  const signingName = useRef<string>(undefined);

  const agent = session?.fields.agent;
  const current = agent ? app?.accounts[agent] : undefined;
  const others = app?.agents.filter((each) => each.name !== agent && each.features.accounts) ?? [];

  const refresh = () => core.client.request('accounts/list', {}).then(setList, () => setList([]));

  useEffect(() => {
    void refresh();
  }, [agent]);

  useEffect(() => {
    const update = (name: string, patch: Partial<Signing>) => setSigning((now) => (now?.name === name ? { ...now, ...patch } : now));
    const stopLink = core.client.on('accounts/sign-in-link', ({ name, url }) => update(name, { link: url }));
    const stopPrompt = core.client.on('accounts/sign-in-prompt', ({ name, prompt, problem }) => update(name, { prompt, problem }));

    return () => {
      stopLink();
      stopPrompt();
      if (signingName.current) void core.client.request('accounts/sign-in-cancel', { name: signingName.current });
    };
  }, []);

  const signIn = async (name: string) => {
    signingName.current = name;
    setSigning({ name });
    setCode('');

    await core.client.request('accounts/sign-in', { name }).catch(() => undefined);

    signingName.current = undefined;
    setSigning(undefined);
    await refresh();
  };

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    if (!signing || !code.trim()) return;

    void core.client.request('accounts/sign-in-answer', { name: signing.name, text: code.trim() });
    setSigning({ ...signing, prompt: undefined, problem: undefined });
  };

  const cancel = () => signing && void core.client.request('accounts/sign-in-cancel', { name: signing.name });

  if (!session || !agent) {
    return (
      <Page title="Accounts">
        <Empty>Open a thread first: accounts are those of the backend it runs on.</Empty>
      </Page>
    );
  }

  if (app?.agents.find((each) => each.name === agent)?.features.accounts === false) {
    return (
      <Page title="Accounts">
        <Empty>{agent} signs in with no account.</Empty>
      </Page>
    );
  }

  return (
    <Page title="Accounts" description={`The accounts ${agent} signs in with in this project. The one in use is used from the next message.`}>
      {signing && (
        <div className="flex flex-col gap-3 rounded-xl border border-working/40 bg-raised p-4">
          <div className="flex items-center gap-2 font-medium">
            <LoaderCircle className="size-4 animate-spin text-working" />
            Signing in as {signing.name}
          </div>
          {signing.link && (
            <div className="flex items-center gap-2 text-muted">
              Continue in your browser.
              <Button variant="outline" size="small" onClick={() => window.open(signing.link)} className="[&_svg]:size-3.5">
                <ExternalLink />
                Open the page again
              </Button>
            </div>
          )}
          {signing.prompt && (
            <form onSubmit={sendCode} className="flex flex-col gap-2">
              <span>{signing.prompt}</span>
              {signing.problem && <span className="text-small text-removed">{signing.problem}</span>}
              <div className="flex gap-2">
                <input
                  ref={(field) => field?.focus()}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 font-mono text-code outline-none focus:border-ink/30"
                />
                <Button type="submit" variant="primary" size="small">
                  Send
                </Button>
              </div>
            </form>
          )}
          <div>
            <Button size="small" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {!list && <LoaderCircle className="size-4 animate-spin text-faint" />}
      {list && (
        <List>
          {list.map((account) => (
            <div key={account.name} className="flex items-center gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 font-medium">
                  {account.name}
                  {account.name === current && <CircleCheck className="size-3.5 text-accent" aria-label="In use" />}
                </span>
                <span className="truncate text-muted">{account.signedIn ? accountLabel(account) || 'Signed in' : 'Not signed in'}</span>
              </span>
              {account.signedIn && account.name !== current && (
                <Button variant="outline" size="small" onClick={() => void core.client.request('accounts/select', { name: account.name })}>
                  Use
                </Button>
              )}
              <Button size="small" disabled={signing !== undefined} onClick={() => void signIn(account.name)}>
                {account.signedIn ? 'Sign in again' : 'Sign in'}
              </Button>
              {!account.own && account.name !== current && (
                <Button size="small" onClick={() => void core.client.request('accounts/remove', { name: account.name }).then(refresh)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
        </List>
      )}
      {naming === undefined ? (
        <div>
          <Button variant="outline" size="small" disabled={signing !== undefined} onClick={() => setNaming('')}>
            Add an account
          </Button>
        </div>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!naming.trim()) return;

            void signIn(naming.trim());
            setNaming(undefined);
          }}
        >
          <input
            ref={(field) => field?.focus()}
            value={naming}
            onChange={(event) => setNaming(event.target.value)}
            placeholder="A name for it, such as work"
            className="h-8 w-64 rounded-lg border border-line bg-canvas px-3 outline-none focus:border-ink/30"
          />
          <Button type="submit" variant="primary" size="small">
            Sign in
          </Button>
          <Button size="small" onClick={() => setNaming(undefined)}>
            Cancel
          </Button>
        </form>
      )}
      {others.length > 0 && (
        <section className="flex flex-col gap-2 pt-4">
          <h2 className="text-small font-medium text-muted">Other backends</h2>
          <List>
            {others.map((other) => {
              const identity = app?.identities[other.name];
              const model = app?.models[other.name]?.[0];

              return (
                <div key={other.name} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{other.name}</span>
                    <span className="truncate text-muted">{identity?.signedIn ? accountLabel(identity) || 'Signed in' : 'Its accounts show once this thread uses it'}</span>
                  </span>
                  {model && (
                    <Button variant="outline" size="small" onClick={() => void core.setModel(session.id, { model: model.id }, other.name)}>
                      Use {other.name} in this thread
                    </Button>
                  )}
                </div>
              );
            })}
          </List>
        </section>
      )}
    </Page>
  );
}
