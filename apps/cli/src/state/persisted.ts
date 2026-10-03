import { atom, type SetStateAction, type WritableAtom } from 'jotai';
import { atomWithLazy } from 'jotai/utils';

/** Loaded once per store, on first read, so each run (and each test's sandbox) reads its own files. */
export function persistedAtom<T>(load: () => T, save: (value: T) => void): WritableAtom<T, [SetStateAction<T>], void> {
  const stored = atomWithLazy(load);
  return atom(
    (get) => get(stored),
    (get, set, update: SetStateAction<T>) => {
      const value = typeof update === 'function' ? (update as (current: T) => T)(get(stored)) : update;
      set(stored, value);
      save(value);
    },
  );
}
