import type { Feature } from '@jinion/workbench';
import { BookOpen, Brain, CircleUserRound } from 'lucide-react';
import type { ComponentType } from 'react';
import { Memory } from '../panels/memory.js';
import { Profile } from '../panels/profile/profile.js';
import { Skills } from '../panels/skills.js';

const pages: Record<string, { title: string; Page: ComponentType }> = {
  skills: { title: 'Skills', Page: Skills },
  memory: { title: 'Memory', Page: Memory },
  profile: { title: 'Profile', Page: Profile },
};

/** Screens of their own, each opened from the activity bar as a tab. */
export function pagesFeature(): Feature[] {
  return [
    {
      id: 'skills',
      activity: { title: 'Skills', icon: <BookOpen />, page: { kind: 'page', id: 'skills' } },
      tabs: [
        {
          kind: 'page',
          Title: ({ id }) => pages[id]?.title,
          Content: ({ id }) => {
            const Page = pages[id]?.Page;

            return Page ? <Page /> : null;
          },
        },
      ],
    },
    { id: 'memory', activity: { title: 'Memory', icon: <Brain />, page: { kind: 'page', id: 'memory' } } },
    { id: 'profile', activity: { title: 'Profile', icon: <CircleUserRound />, foot: true, page: { kind: 'page', id: 'profile' } } },
  ];
}
