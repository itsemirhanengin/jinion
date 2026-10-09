import { ViewTransition } from 'react';

// Navigations tagged by their links slide in a direction; anything else (sidebar, browser back) gets a short rise.
const motion = {
  'nav-forward': 'nav-forward',
  'nav-back': 'nav-back',
  'nav-prev': 'nav-prev',
  'nav-next': 'nav-next',
  default: 'page',
};

/** Wraps a page's content so it animates in and out on navigation; the sidebar, in the layout, stays put. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={motion} exit={motion} default="none">
      {children}
    </ViewTransition>
  );
}
