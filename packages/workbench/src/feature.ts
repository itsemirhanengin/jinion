import type { ComponentType, ReactNode } from 'react';
import type { Place, TabRef } from './layout.js';
import type { Workbench } from './workbench.js';

/** What a feature brings to the window; the workbench draws it and knows nothing else of it. */
export interface Feature {
  id: string;
  activity?: Activity;
  tabs?: TabKind[];
  views?: View[];
  status?: StatusItem[];
  commands?: Command[];
}

/** An item of the activity bar: it opens its sidebar, or its page as a tab when it has no sidebar. */
export interface Activity {
  title: string;
  icon: ReactNode;
  /** At the bar's foot, as settings and the account are. */
  foot?: boolean;
  Badge?: ComponentType;
  Sidebar?: ComponentType;
  /** Buttons at the end of the sidebar's header, such as New thread. */
  Actions?: ComponentType;
  page?: TabRef;
}

export interface TabKind {
  kind: string;
  Title: ComponentType<{ id: string }>;
  /** Drawn before the title: a file's icon, a thread's state. */
  Mark?: ComponentType<{ id: string }>;
  Content: ComponentType<{ id: string }>;
  /** When the user closes one, such as a thread's tab closing its session. */
  onClose?: (id: string) => void;
}

export interface View {
  id: string;
  title: string;
  place: Place;
  Content: ComponentType;
  Badge?: ComponentType;
}

export interface StatusItem {
  id: string;
  side: 'left' | 'right';
  Item: ComponentType;
}

export interface Command {
  id: string;
  title: string;
  /** As `mod+shift+t`, where mod is ⌘ on a Mac and Ctrl elsewhere. */
  keys?: string;
  /** Its keys do nothing, and go on to the page, unless this holds: Esc stops a turn only while one runs. */
  when?: () => boolean;
  run: (workbench: Workbench) => void;
}
