import { useEffect, useRef, useState } from 'react';
import { useJinion } from '../../app/context.js';

export interface Signing {
  name: string;
  link?: string;
  prompt?: { text: string; answer(text: string): void; problem?: string };
  code: string;
  sent: boolean;
}

export function useSignIn(ended: (name: string, signedIn: boolean) => void) {
  const jinion = useJinion();

  const [signing, setSigning] = useState<Signing>();
  const login = useRef<AbortController>(undefined);

  useEffect(() => () => login.current?.abort(), []);

  const update = (patch: Partial<Signing>) => setSigning((now) => now && { ...now, ...patch });

  const start = (name: string) => {
    const abort = new AbortController();

    login.current = abort;
    setSigning({ name, code: '', sent: false });

    void jinion.accounts
      .signIn(name, {
        signal: abort.signal,
        onLink: (link) => update({ link }),
        onPrompt: (text, answer, problem) => update({ prompt: { text, answer, problem }, code: '', sent: false }),
      })
      .then((signedIn) => {
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
