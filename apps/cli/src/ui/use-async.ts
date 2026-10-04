import { useEffect, useState } from 'react';
import { errorMessage } from '@jinion/core/lib/errors';

export type Async<T> = { state: 'pending' } | { state: 'done'; value: T } | { state: 'failed'; error: string };

const PENDING = { state: 'pending' } as const;

/** An answer that comes after the next load is dropped; a load that returns nothing stays pending. */
export function useAsync<T>(load: () => Promise<T> | undefined, deps: unknown[]): Async<T> {
  const [result, setResult] = useState<Async<T>>(PENDING);

  useEffect(() => {
    let current = true;

    setResult(PENDING);

    load()?.then(
      (value) => current && setResult({ state: 'done', value }),
      (error: unknown) => current && setResult({ state: 'failed', error: errorMessage(error) }),
    );

    return () => {
      current = false;
    };
  }, deps);

  return result;
}
