import { createContext, useContext } from 'react';
import type { JinionClient } from '@jinion/core/api/client';
import type { Initialized, ServerContract } from '@jinion/core/api/protocol';
import type { Params, Result } from '@jinion/core/api/rpc';
import { errorMessage } from '@jinion/core/lib/errors';

type Method = keyof ServerContract['requests'];

type SessionMethod = { [M in Method]: Params<ServerContract, M> extends { session: string } ? M : never }[Method];

type WithoutSession<T> = T extends unknown ? Omit<T, 'session'> : never;

/** The app's way to the core: its client, what `initialize` told it, and calls on the session it shows. */
export interface Api {
  client: JinionClient;
  initialized: Initialized;
  request<M extends Method>(method: M, params: Params<ServerContract, M>): Promise<Result<ServerContract, M>>;
  /** For the session shown when it is called, which may have changed since the caller was drawn. */
  inSession<M extends SessionMethod>(method: M, params: WithoutSession<Params<ServerContract, M>>): Promise<Result<ServerContract, M>>;
  /** For a call nothing waits on: a failure shows in the conversation instead of going unhandled. */
  act(call: Promise<unknown>): void;
  /** Quits the core, or only leaves it for a client attached to one that serves others. */
  quit(): void;
}

/** `leave` is how an attached client goes, leaving the core running; without it, quitting quits the core. */
export function createApi(client: JinionClient, initialized: Initialized, leave?: () => void): Api {
  const shown = () => {
    const id = client.store.get(client.shownAtom);
    if (id === undefined) throw new Error('No session is shown yet.');

    return id;
  };

  const request: Api['request'] = (method, params) => client.request(method, params);

  const inSession: Api['inSession'] = (method, params) =>
    client.request(method, { ...params, session: shown() } as unknown as Params<ServerContract, typeof method>);

  const act: Api['act'] = (call) => {
    call.catch((error: unknown) => inSession('session/notice', { text: errorMessage(error), tone: 'error' }).catch(() => {}));
  };

  return { client, initialized, request, inSession, act, quit: leave ?? (() => act(request('app/quit', {}))) };
}

export const ApiContext = createContext<Api | undefined>(undefined);

/** Stable for the life of the app, so reading it never redraws; what changes comes from atoms. */
export function useApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi() must be called inside <App>.');

  return api;
}
