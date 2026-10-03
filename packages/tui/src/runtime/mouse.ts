import { createContext, useContext, useEffect, useRef } from 'react';
import type { MouseListener } from './input.js';

export const MouseContext = createContext<Set<MouseListener>>(new Set());

export function useMouse(handler: MouseListener, { isActive = true }: { isActive?: boolean } = {}) {
  const listeners = useContext(MouseContext);
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!isActive) return;
    const listener: MouseListener = (event) => latest.current(event);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listeners, isActive]);
}
