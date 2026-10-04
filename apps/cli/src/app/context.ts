import { createContext, useContext } from 'react';
import type { Jinion } from '@jinion/core/controllers/jinion';

export const JinionContext = createContext<Jinion | undefined>(undefined);

/** Stable for the life of the app, so reading it never redraws; state comes from atoms. */
export function useJinion() {
  const jinion = useContext(JinionContext);
  if (!jinion) throw new Error('useJinion() must be called inside <App>.');

  return jinion;
}
