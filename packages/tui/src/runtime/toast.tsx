import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface Toast {
  text?: string;
  show(text: string): void;
}

const TOAST_MS = 2500;

// The text and `show` go apart, so what only shows toasts doesn't draw again with each one.
const TextContext = createContext<string | undefined>(undefined);
const ShowContext = createContext<(text: string) => void>(() => {});

export const useToast = (): Toast => {
  const text = useContext(TextContext);
  const show = useContext(ShowContext);
  return useMemo(() => ({ text, show }), [text, show]);
};

export const useShowToast = () => useContext(ShowContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string>();
  const timer = useRef<NodeJS.Timeout>(undefined);
  const show = useCallback((next: string) => {
    clearTimeout(timer.current);
    setText(next);
    timer.current = setTimeout(() => setText(undefined), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ShowContext.Provider value={show}>
      <TextContext.Provider value={text}>{children}</TextContext.Provider>
    </ShowContext.Provider>
  );
}
