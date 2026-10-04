import type { Atom, ExtractAtomValue, Store } from 'jotai/vanilla';
import { accountAtom, identityAtom, modelsAtom, skillsAtom } from '../state/agent.js';
import type { SessionAtoms } from '../state/session.js';

type Fields = Record<string, Atom<unknown>>;

export type FieldValues<F extends Fields> = { [K in keyof F]: ExtractAtomValue<F[K]> };

/** One field's new value, named, since a value gone to `undefined` would vanish from an object sent as JSON. */
export type FieldChange<V> = { [K in keyof V]: { name: K; value: V[K] } }[keyof V];

/** What every session shares that a client shows. */
export const appFields = { models: modelsAtom, account: accountAtom, identity: identityAtom, skills: skillsAtom };

export type AppFields = FieldValues<typeof appFields>;

/** What a client shows of a session besides its conversation, which it follows action by action instead. */
export const sessionFields = ({ selection, mode, tasks, dialog, queue, wantsWorktree, working }: SessionAtoms) => ({
  selection,
  mode,
  tasks,
  dialog,
  queue,
  wantsWorktree,
  working,
});

export type SessionFields = FieldValues<ReturnType<typeof sessionFields>>;

export function readFields<F extends Fields>(store: Store, fields: F) {
  return Object.fromEntries(Object.entries(fields).map(([name, atom]) => [name, store.get(atom)])) as FieldValues<F>;
}

/** Tells `changed` of each field that changes, until the returned function is called. */
export function watchFields<F extends Fields>(store: Store, fields: F, changed: (change: FieldChange<FieldValues<F>>) => void) {
  const stops = Object.entries(fields).map(([name, atom]) =>
    store.sub(atom, () => changed({ name, value: store.get(atom) } as FieldChange<FieldValues<F>>)),
  );

  return () => {
    for (const stop of stops) stop();
  };
}
