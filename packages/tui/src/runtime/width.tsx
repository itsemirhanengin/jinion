import { createContext, useContext, type ReactNode } from 'react';

export const WidthContext = createContext<number>(80);

export const useContentWidth = () => useContext(WidthContext);

export function Inset({ by, children }: { by: number; children: ReactNode }) {
  const width = useContentWidth();
  return <WidthContext.Provider value={Math.max(1, width - by)}>{children}</WidthContext.Provider>;
}
