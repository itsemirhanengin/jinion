import { useEffect, useRef, useState } from 'react';
import { useApi } from '../../app/api.js';

export interface Signing {
  name: string;
  link?: string;
  prompt?: { text: string; answer(text: string): void; problem?: string };
  code: string;
  sent: boolean;
}

/** Signing in runs in the core; its link and what to type come back as notifications while it waits. */
export function useSignIn(ended: (name: string, signedIn: boolean) => void) {
  const api = useApi();

  const [signing, setSigning] = useState<Signing>();
  const current = useRef<string>(undefined);

  const update = (name: string, patch: Partial<Signing>) => setSigning((now) => (now?.name === name ? { ...now, ...patch } : now));

  useEffect(() => {
    const stopLink = api.client.on('accounts/sign-in-link', ({ name, url }) => update(name, { link: url }));

    const stopPrompt = api.client.on('accounts/sign-in-prompt', ({ name, prompt, problem }) => {
      const answer = (text: string) => api.act(api.request('accounts/sign-in-answer', { name, text }));

      update(name, { prompt: { text: prompt, answer, problem }, code: '', sent: false });
    });

    return () => {
      stopLink();
      stopPrompt();
      if (current.current) api.act(api.request('accounts/sign-in-cancel', { name: current.current }));
    };
  }, []);

  const start = (name: string) => {
    current.current = name;
    setSigning({ name, code: '', sent: false });

    void api.request('accounts/sign-in', { name }).then(
      ({ signedIn }) => finish(name, signedIn),
      () => finish(name, false),
    );
  };

  const finish = (name: string, signedIn: boolean) => {
    if (current.current === name) current.current = undefined;

    setSigning(undefined);
    ended(name, signedIn);
  };

  return {
    signing,
    start,
    cancel: () => current.current && api.act(api.request('accounts/sign-in-cancel', { name: current.current })),
    type: (code: string) => signing && update(signing.name, { code }),
    send: (code: string) => {
      if (!code.trim() || !signing?.prompt) return;

      signing.prompt.answer(code);
      update(signing.name, { sent: true });
    },
  };
}
