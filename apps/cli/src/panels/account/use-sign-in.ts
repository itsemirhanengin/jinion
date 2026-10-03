import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { AgentAccounts } from '../../agent/accounts.js';
import { useJinion } from '../../app/context.js';
import { errorMessage } from '../../lib/errors.js';
import { accountAtom } from '../../state/agent.js';

export interface Signing {
  name: string;
  link?: string;
  prompt?: { text: string; answer(text: string): void; problem?: string };
  code: string;
  sent: boolean;
}

export function useSignIn(accounts: AgentAccounts, ended: (name: string, signedIn: boolean) => void) {
  const jinion = useJinion();
  const current = useAtomValue(accountAtom);

  const [signing, setSigning] = useState<Signing>();
  const login = useRef<AbortController>(undefined);

  useEffect(() => () => login.current?.abort(), []);

  const update = (patch: Partial<Signing>) => setSigning((now) => now && { ...now, ...patch });

  const start = (name: string) => {
    const abort = new AbortController();
    let signedIn = false;

    login.current = abort;
    setSigning({ name, code: '', sent: false });

    accounts
      .signIn(name, {
        signal: abort.signal,
        onLink: (link) => update({ link }),
        onPrompt: (text, answer, problem) => update({ prompt: { text, answer, problem }, code: '', sent: false }),
      })
      .then(
        (account) => {
          signedIn = account.signedIn;

          const as = account.email ? ` as ${account.email}` : '';

          jinion.notice(
            !account.signedIn
              ? `${name} isn't signed in yet. Try again from /account.`
              : name === current
                ? `Signed in to ${name} again${as}. The conversation carries on with the new login.`
                : `Signed in to ${name}${as}. Pick it here to switch.`,
            account.signedIn ? 'success' : 'warning',
          );

          if (account.signedIn) jinion.accounts.signedIn(name);
        },
        (error: unknown) => {
          if (!abort.signal.aborted) jinion.notice(`Couldn't sign in to ${name}: ${errorMessage(error)}`, 'error');
        },
      )
      .finally(() => {
        login.current = undefined;
        setSigning(undefined);
        ended(name, signedIn);
      });
  };

  return {
    signing,
    start,
    cancel: () => login.current?.abort(),
    type: (code: string) => update({ code }),
    send: (code: string) => {
      if (!code.trim() || !signing?.prompt) return;

      signing.prompt.answer(code);
      update({ sent: true });
    },
  };
}
