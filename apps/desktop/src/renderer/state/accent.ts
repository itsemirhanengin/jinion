import { atom } from 'jotai';
import { appStore } from './app.js';
import { saveAccent, savedAccent } from './saved.js';

/** The accents in the order the picker shows them; their colors are in @jinion/ui's theme.css. */
export const ACCENTS = [
  { id: 'navy', name: 'Navy' },
  { id: 'ocean', name: 'Ocean' },
  { id: 'plum', name: 'Plum' },
  { id: 'clay', name: 'Clay' },
  { id: 'graphite', name: 'Graphite' },
];

/** The accent picked, in the app's store. */
export const accentAtom = atom(ACCENTS.find((accent) => accent.id === savedAccent())?.id ?? 'navy');

// The page's root carries the accent the theme's colors follow, and it is kept for the next launch.
const apply = () => {
  const accent = appStore.get(accentAtom);

  document.documentElement.dataset.accent = accent;
  saveAccent(accent);
};

apply();
appStore.sub(accentAtom, apply);
