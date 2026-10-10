export type ThreadState = 'working' | 'waiting' | 'done' | 'idle';

export interface Thread {
  id: string;
  title: string;
  news: string;
  ago: string;
  /** Days back from today, for the day groups. */
  days: number;
  state: ThreadState;
  added?: number;
  removed?: number;
  pinned?: boolean;
}

export const threads: Thread[] = [
  { id: '1', title: 'Apple notarization and DMG signing', news: 'Running the notarytool submit', ago: '4m', days: 0, state: 'working', added: 42, removed: 6 },
  { id: '2', title: 'Invite emails in Turkish', news: 'Should the subject line stay in English?', ago: '12m', days: 0, state: 'waiting' },
  { id: '3', title: "Jinion'un frontend yetkinliği", news: 'Selam jinion, bugün seninle frontend…', ago: '41m', days: 0, state: 'done', pinned: true },
  { id: '4', title: 'Dashboard sadeleştirmesi', news: 'Goals and the analytics panels are gone.', ago: '2h', days: 0, state: 'done', added: 120, removed: 388 },
  { id: '5', title: 'Desktop seçme ve çoklu proje', news: 'Projects switch from the title bar now.', ago: '1d', days: 1, state: 'done', added: 64, removed: 12 },
  { id: '6', title: 'Plan editörü sorunları', news: 'The diagram dialog keeps its size.', ago: '1d', days: 1, state: 'done' },
  { id: '7', title: 'Plan editörü tasarımı ve UX', news: 'Look A for the bar, chat card one row.', ago: '3d', days: 3, state: 'done', pinned: true },
  { id: '8', title: 'node-pty from dmg install', news: 'pty works in the packaged app.', ago: '4d', days: 4, state: 'done', added: 8, removed: 2 },
  { id: '9', title: "CLI'da kod renklendirmesi", news: 'Shiki tokens in the terminal, 16 colors.', ago: '4d', days: 4, state: 'done' },
  { id: '10', title: 'Autocomplete menüsü ve slash', news: 'The / list opens over the composer.', ago: '5d', days: 5, state: 'done' },
  { id: '11', title: 'Jinion profil sayfası', news: 'Heatmap in the primary color.', ago: '6d', days: 6, state: 'done' },
  { id: '12', title: 'Fumadocs ile docs tasarımı', news: 'Turkish under /tr, siz throughout.', ago: '2w', days: 15, state: 'done' },
  { id: '13', title: 'Worktrees and the tool groups', news: 'Worktrees branch from the remote default.', ago: '3w', days: 22, state: 'done' },
  { id: '14', title: 'Codex app-server adapter', news: 'Fixtures play a turn at a time.', ago: '1mo', days: 34, state: 'done' },
  { id: '15', title: 'Steering messages above the prompt', news: 'They wait until the agent reads them.', ago: '2mo', days: 61, state: 'done' },
];
