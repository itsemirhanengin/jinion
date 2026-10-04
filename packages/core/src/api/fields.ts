import type { Atom, Store } from 'jotai/vanilla';
import { accountAtom, identityAtom, modelsAtom, seenLimitsAtom, skillsAtom } from '../state/agent.js';
import { worktreesAtom } from '../state/preferences.js';
import type { SessionAtoms } from '../state/session.js';
import type { AppFields, FieldChange, SessionFields } from './schemas.js';

/** The atoms a set of fields is read from, each of the type its field has on the wire. */
type FieldAtoms<V> = { [K in keyof V]-?: Atom<V[K]> };

/** Where the server reads `AppFields` from. */
export const appFields = {
  models: modelsAtom,
  account: accountAtom,
  identity: identityAtom,
  skills: skillsAtom,
  seenLimits: seenLimitsAtom,
  worktrees: worktreesAtom,
} satisfies FieldAtoms<AppFields>;

/** Where the server reads a session's `SessionFields` from. */
export const sessionFields = ({ selection, mode, tasks, dialog, queue, wantsWorktree, working }: SessionAtoms) =>
  ({ selection, mode, tasks, dialog, queue, wantsWorktree, working }) satisfies FieldAtoms<SessionFields>;

export function readFields<V>(store: Store, fields: FieldAtoms<V>) {
  return Object.fromEntries(Object.entries<Atom<unknown>>(fields).map(([name, atom]) => [name, store.get(atom)])) as V;
}

/** Tells `changed` of each field that changes, until the returned function is called. */
export function watchFields<V>(store: Store, fields: FieldAtoms<V>, changed: (change: FieldChange<V>) => void) {
  const stops = Object.entries<Atom<unknown>>(fields).map(([name, atom]) =>
    store.sub(atom, () => changed({ name, value: store.get(atom) } as FieldChange<V>)),
  );

  return () => {
    for (const stop of stops) stop();
  };
}
