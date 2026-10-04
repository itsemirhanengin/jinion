import { useEffect, useState } from 'react';
import { Box, ChoiceList, choiceIndent, Panel, PromptInput, Text, useChoiceList, useInput, usePanel, useTheme, type Choice } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import type { AgentAccount, AgentAccounts } from '../../agent/accounts.js';
import { useJinion } from '../../app/context.js';
import { limitsKey } from '../../settings/limits.js';
import { accountAtom, seenLimitsAtom } from '../../state/agent.js';
import { describeAccount } from './describe.js';
import { SignInView } from './sign-in-view.js';
import { useSignIn } from './use-sign-in.js';

const ADD = '+add';

type Removing = { name: string; refused?: string; running?: boolean };

export function AccountPicker({ accounts, signIn: initial }: { accounts: AgentAccounts; signIn?: string }) {
  const jinion = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const current = useAtomValue(accountAtom);
  const seen = useAtomValue(seenLimitsAtom);

  const [list, setList] = useState<AgentAccount[]>();
  const [naming, setNaming] = useState<string>();
  const [removing, setRemoving] = useState<Removing>();

  const refresh = () => accounts.list().then(setList, () => setList([]));

  const login = useSignIn((name, signedIn) => {
    if (signedIn) choices.setFocus(name);
    void refresh();
  });

  useEffect(() => {
    void refresh();
    if (initial) login.start(initial);
  }, []);

  const choices = useChoiceList({
    keys: [...(list ?? []).map((account) => account.name), ADD],
    mode: 'single',
    initialFocus: current,
    isActive: !login.signing && naming === undefined,
    onCancel: close,
    onSubmit: ([name]) => {
      if (name === ADD) return setNaming('');

      const account = list?.find((candidate) => candidate.name === name);
      if (!account) return;
      if (!account.signedIn) return login.start(account.name);

      close();
      if (account.name !== current) jinion.accounts.select(account.name);
    },
  });

  useInput(
    (input) => {
      const account = list?.find((candidate) => candidate.name === choices.focus);
      if (!account || removing?.running) return;

      const { name } = account;
      if (input === 'l') return login.start(name);
      if (input !== 'd') return setRemoving(undefined);

      const refused = account.own
        ? `${jinion.agent.name}'s own login stays; l signs in again`
        : name === current
          ? 'in use; switch to another account first'
          : undefined;
      if (refused || removing?.name !== name) return setRemoving({ name, refused });

      setRemoving({ name, running: true });

      void jinion.accounts.remove(name).then(async () => {
        await refresh();
        setRemoving(undefined);
      });
    },
    { isActive: !login.signing && naming === undefined },
  );

  useInput(
    (_, key) => {
      if (!key.escape) return;

      if (login.signing) login.cancel();
      else setNaming(undefined);
    },
    { isActive: login.signing !== undefined || naming !== undefined },
  );

  if (login.signing) return <SignInView signing={login.signing} onType={login.type} onSend={login.send} />;

  const rows: Choice[] = [
    ...(list ?? []).map((account) => ({
      key: account.name,
      label: account.name,
      description: describeAccount(account, seen[limitsKey(jinion.agent.name, account.name)]),
      aside:
        removing?.name === account.name ? (
          <Text color={removing.refused ? theme.warning : theme.error}>
            {removing.refused ?? (removing.running ? 'signing out…' : 'press d again to remove')}
          </Text>
        ) : account.name === current ? (
          'current'
        ) : undefined,
    })),
    {
      key: ADD,
      label: 'Add an account',
      description: 'Signs another login in, in the browser',
      editor:
        naming !== undefined ? (
          <Box paddingLeft={choiceIndent(choices)}>
            <Text color={theme.muted}>name: </Text>
            <PromptInput
              value={naming}
              onChange={setNaming}
              onSubmit={(value) => {
                const name = value.trim();

                setNaming(undefined);
                if (name) login.start(name);
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
      subtitle={jinion.agent.name}
      hints={
        naming !== undefined
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
      {list === undefined ? <Text color={theme.muted}>Asking who is signed in…</Text> : <ChoiceList list={choices} choices={rows} limit={6} />}
    </Panel>
  );
}
