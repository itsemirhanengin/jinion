import type { Methods } from '../connection.js';
import { supported } from './supported.js';

interface Signing {
  abort: AbortController;
  /** Set while the backend waits for what the user types, such as a code from the browser. */
  answer?(text: string): void;
}

/** The backend's accounts. Signing in is a flow: its link and what to type go to the client that started it. */
export const accountMethods: Methods = (connection) => {
  const { app } = connection;
  const { backend } = app;
  const signing = new Map<string, Signing>();

  connection.peer.onClose(() => {
    for (const { abort } of signing.values()) abort.abort();
  });

  connection.answer('accounts/list', () => supported(backend.accounts, backend.name, 'switch accounts').list());
  connection.answer('accounts/select', ({ name }) => app.accounts.select(name));
  connection.answer('accounts/remove', ({ name }) => app.accounts.remove(name));

  connection.answer('accounts/sign-in', async ({ name }) => {
    supported(backend.accounts, backend.name, 'sign in');
    signing.get(name)?.abort.abort();

    const flow: Signing = { abort: new AbortController() };

    signing.set(name, flow);

    try {
      const signedIn = await app.accounts.signIn(name, {
        signal: flow.abort.signal,
        onLink: (url) => connection.peer.notify('accounts/sign-in-link', { name, url }),
        onPrompt: (prompt, answer, problem) => {
          flow.answer = answer;
          connection.peer.notify('accounts/sign-in-prompt', { name, prompt, problem });
        },
      });

      return { signedIn };
    } finally {
      if (signing.get(name) === flow) signing.delete(name);
    }
  });

  connection.answer('accounts/sign-in-answer', ({ name, text }) => signing.get(name)?.answer?.(text));
  connection.answer('accounts/sign-in-cancel', ({ name }) => signing.get(name)?.abort.abort());
};
