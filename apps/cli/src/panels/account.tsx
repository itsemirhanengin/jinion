import { useEffect, useRef, useState } from 'react';
import {
  Box,
  ChoiceList,
  choiceIndent,
  Panel,
  PromptInput,
  Text,
  useChoiceList,
  useInput,
  usePanel,
  useTheme,
  type Choice,
} from '@jinion/tui';
import { accountLabel, type AgentAccount } from '../agent/types.js';
import { useJinion } from '../context.js';
import { limitsKey } from '../settings.js';

const ADD = '+add';

interface CodePrompt {
  text: string;
  answer(text: string): void;
  problem?: string;
}

type Step =
  | { kind: 'list' }
  | { kind: 'naming'; value: string }
  | { kind: 'signing'; name: string; link?: string; prompt?: CodePrompt; code: string; sent: boolean };

/**
 * `/account`: the agent's logins with who is signed in and how much of each plan was used when last seen. Enter
 * switches to one, `l` signs it in again, `d` twice signs it out and removes it; "Add an account" signs a new one in, in
 * the browser.
 */
export function AccountPicker({ signIn: initial }: { signIn?: string }) {
  const app = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const manager = app.accounts.manager!;
  const [accounts, setAccounts] = useState<AgentAccount[]>();
  const [step, setStep] = useState<Step>({ kind: 'list' });
  /** The account `d` was pressed on once, and why it can't go when it can't. */
  const [removing, setRemoving] = useState<{ name: string; refused?: string; running?: boolean }>();
  const login = useRef<AbortController>(undefined);

  const refresh = () => manager.list().then(setAccounts, () => setAccounts([]));

  const signIn = (name: string) => {
    const abort = new AbortController();
    login.current = abort;
    setStep({ kind: 'signing', name, code: '', sent: false });
    const update = (patch: Partial<Extract<Step, { kind: 'signing' }>>) =>
      setStep((current) => (current.kind === 'signing' ? { ...current, ...patch } : current));
    manager
      .signIn(name, {
        signal: abort.signal,
        onLink: (link) => update({ link }),
        onPrompt: (text, answer, problem) => update({ prompt: { text, answer, problem }, code: '', sent: false }),
      })
      .then(
        (account) => {
          const inUse = name === app.accounts.current;
          const as = account.email ? ` as ${account.email}` : '';
          app.actions.notice(
            !account.signedIn
              ? `${name} isn't signed in yet. Try again from /account.`
              : inUse
                ? `Signed in to ${name} again${as}. The conversation carries on with the new login.`
                : `Signed in to ${name}${as}. Pick it here to switch.`,
            account.signedIn ? 'success' : 'warning',
          );
          if (account.signedIn) app.actions.accountSignedIn(name);
          list.setFocus(name);
        },
        (error: unknown) => {
          if (!abort.signal.aborted) {
            app.actions.notice(`Couldn't sign in to ${name}: ${error instanceof Error ? error.message : error}`, 'error');
          }
        },
      )
      .finally(() => {
        login.current = undefined;
        setStep({ kind: 'list' });
        void refresh();
      });
  };

  useEffect(() => {
    void refresh();
    if (initial) signIn(initial);
    // Closing the panel stops a sign-in in progress.
    return () => login.current?.abort();
  }, []);

  const list = useChoiceList({
    keys: [...(accounts ?? []).map((account) => account.name), ADD],
    mode: 'single',
    initialFocus: app.accounts.current,
    isActive: step.kind === 'list',
    onCancel: close,
    onSubmit: ([name]) => {
      if (name === ADD) return setStep({ kind: 'naming', value: '' });
      const account = accounts?.find((candidate) => candidate.name === name);
      if (!account) return;
      if (!account.signedIn) return signIn(account.name);
      close();
      if (account.name !== app.accounts.current) app.actions.selectAccount(account.name);
    },
  });

  useInput(
    (input) => {
      const account = accounts?.find((candidate) => candidate.name === list.focus);
      if (!account || removing?.running) return;
      const { name } = account;
      if (input === 'l') return signIn(name);
      if (input !== 'd') return setRemoving(undefined);
      const refused = account.own
        ? `${app.model.agent}'s own login stays; l signs in again`
        : name === app.accounts.current
            ? 'in use; switch to another account first'
            : undefined;
      if (refused || removing?.name !== name) return setRemoving({ name, refused });
      setRemoving({ name, running: true });
      void app.actions.removeAccount(name).then(async () => {
        await refresh();
        setRemoving(undefined);
      });
    },
    { isActive: step.kind === 'list' },
  );

  useInput(
    (_, key) => {
      if (!key.escape) return;
      if (step.kind === 'signing') login.current?.abort();
      else setStep({ kind: 'list' });
    },
    { isActive: step.kind !== 'list' },
  );

  if (step.kind === 'signing') {
    const { prompt } = step;
    return (
      <Panel
        title="Account"
        subtitle={step.name}
        hints={prompt && !step.sent ? [['Enter', 'send'], ['Esc', 'cancel']] : [['Esc', 'cancel']]}
      >
        <Text>
          Signing in to <Text bold>{step.name}</Text>. Finish it in your browser.
        </Text>
        {step.link && (
          <Text>
            <Text color={theme.muted}>If the browser didn't open: </Text>
            <Text color={theme.code}>{step.link}</Text>
          </Text>
        )}
        {prompt && (
          <Box flexDirection="column" marginTop={1}>
            {prompt.problem && <Text color={theme.error}>{prompt.problem}</Text>}
            {step.sent ? (
              <Text color={theme.muted}>Checking the code…</Text>
            ) : (
              <Box>
                <Text color={theme.muted}>{prompt.text}: </Text>
                <PromptInput
                  value={step.code}
                  onChange={(code) => setStep({ ...step, code })}
                  onSubmit={(code) => {
                    if (!code.trim()) return;
                    prompt.answer(code);
                    setStep({ ...step, sent: true });
                  }}
                  placeholder="code"
                  paddingX={0}
                />
              </Box>
            )}
          </Box>
        )}
      </Panel>
    );
  }

  const choices: Choice[] = [
    ...(accounts ?? []).map((account) => ({
      key: account.name,
      label: account.name,
      description: describe(account, app.accounts.seen[limitsKey(app.model.agent, account.name)]),
      aside:
        removing?.name === account.name ? (
          <Text color={removing.refused ? theme.warning : theme.error}>
            {removing.refused ?? (removing.running ? 'signing out…' : 'press d again to remove')}
          </Text>
        ) : account.name === app.accounts.current ? (
          'current'
        ) : undefined,
    })),
    {
      key: ADD,
      label: 'Add an account',
      description: 'Signs another login in, in the browser',
      editor:
        step.kind === 'naming' ? (
          <Box paddingLeft={choiceIndent(list)}>
            <Text color={theme.muted}>name: </Text>
            <PromptInput
              value={step.value}
              onChange={(value) => setStep({ kind: 'naming', value })}
              onSubmit={(value) => {
                const name = value.trim();
                if (name) signIn(name);
                else setStep({ kind: 'list' });
              }}
              placeholder="e.g. work or personal"
              paddingX={0}
            />
          </Box>
        ) : undefined,
    },
  ];

  return (
    <Panel
      title="Account"
      subtitle={app.model.agent}
      hints={
        step.kind === 'naming'
          ? [
              ['Enter', 'sign in'],
              ['Esc', 'back'],
            ]
          : [
              ['Enter', 'switch'],
              ['l', 'sign in again'],
              ['d', 'remove'],
              ['Up/Down', 'move'],
              ['Esc', 'close'],
            ]
      }
    >
      {accounts === undefined ? (
        <Text color={theme.muted}>Asking who is signed in…</Text>
      ) : (
        <ChoiceList list={list} choices={choices} limit={6} />
      )}
    </Panel>
  );
}

function describe(account: AgentAccount, seen: { windows: { label: string; used: number }[]; at: number } | undefined) {
  if (!account.signedIn) return 'Not signed in; press enter to sign in';
  // The email is in the label for a personal plan; a shared one shows it next to the organization.
  const shared = account.plan === 'Team' || account.plan === 'Enterprise';
  const who = [accountLabel(account), shared ? account.email : undefined].filter(Boolean).join(' · ');
  if (!seen) return who;
  const usage = seen.windows.map((window) => `${window.label} ${Math.round(window.used * 100)}%`).join(' · ');
  return `${who} · ${usage} ${ago(seen.at)}`;
}

function ago(at: number) {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}
