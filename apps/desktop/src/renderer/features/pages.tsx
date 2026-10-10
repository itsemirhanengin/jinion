import type { Feature } from '@jinion/workbench';
import type { ComponentType } from 'react';
import { Memory } from '../panels/memory.js';
import { Profile } from '../panels/profile/profile.js';
import { Skills } from '../panels/skills.js';

const screens: Record<string, { title: string; Page: ComponentType }> = {
  skills: { title: 'Skills', Page: Skills },
  memory: { title: 'Memory', Page: Memory },
  profile: { title: 'Profile', Page: Profile },
};

/** Screens of their own, each a tab, opened from the title bar. */
export function pages(): Feature {
  return {
    id: 'pages',
    tabs: [
      {
        kind: 'page',
        Title: ({ id }) => screens[id]?.title,
        Content: ({ id }) => {
          const Page = screens[id]?.Page;

          return Page ? <Page /> : null;
        },
      },
    ],
  };
}
