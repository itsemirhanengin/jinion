import type { Methods } from '../connection.js';
import { supported } from './supported.js';

interface Signing {
  abort: AbortController;
  /** Set while the backend waits for what the user types, such as a code from the browser. */
  answer?(text: string): void;
}

/**
 * The accounts of the backend the user looks at, or of the one a call names. Signing in is a flow: its link and what to
 * type go to the client that started it.
 */
export const accountMethods: Methods = (connection) => {
  const { app } = connection;
  // By backend and name, since two backends can each have an account of the same name.
  const signing = new Map<string, Signing>();

  const backendOf = (agent?: string) => (agent ? app.named(agent) : app.backend);
  const keyOf = (name: string, agent?: string) => `${backendOf(agent).name}/${name}`;

  connection.peer.onClose(() => {
    for (const { abort } of signing.values()) abort.abort();
  });

  connection.answer('accounts/list', ({ agent }) => {
    const backend = backendOf(agent);

    return supported(backend.accounts, backend.name, 'switch accounts').list();
  });

  connection.answer('accounts/select', ({ name, agent }) => app.accounts.select(name, backendOf(agent)));
  connection.answer('accounts/remove', ({ name, agent }) => app.accounts.remove(name, backendOf(agent)));

  connection.answer('accounts/sign-in', async ({ name, agent }) => {
    const backend = backendOf(agent);
    const key = keyOf(name, agent);

    supported(backend.accounts, backend.name, 'sign in');
    signing.get(key)?.abort.abort();

    const flow: Signing = { abort: new AbortController() };

    signing.set(key, flow);

    try {
      const signedIn = await app.accounts.signIn(
        name,
        {
          signal: flow.abort.signal,
          onLink: (url) => connection.peer.notify('accounts/sign-in-link', { name, agent, url }),
          onPrompt: (prompt, answer, problem) => {
            flow.answer = answer;
            connection.peer.notify('accounts/sign-in-prompt', { name, agent, prompt, problem });
          },
        },
        backend,
      );

      return { signedIn };
    } finally {
      if (signing.get(key) === flow) signing.delete(key);
    }
  });

  connection.answer('accounts/sign-in-answer', ({ name, agent, text }) => signing.get(keyOf(name, agent))?.answer?.(text));
  connection.answer('accounts/sign-in-cancel', ({ name, agent }) => signing.get(keyOf(name, agent))?.abort.abort());
};
