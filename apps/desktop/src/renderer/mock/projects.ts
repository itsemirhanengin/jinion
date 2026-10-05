export interface Project {
  id: string;
  name: string;
  path: string;
  branch: string;
  openedAt: number;
}

const minutes = (count: number) => Date.now() - count * 60_000;

export const projects: Project[] = [
  { id: 'acme-api', name: 'acme-api', path: '~/code/acme-api', branch: 'main', openedAt: minutes(2) },
  { id: 'acme-web', name: 'acme-web', path: '~/code/acme-web', branch: 'feat/checkout', openedAt: minutes(95) },
  { id: 'jinion', name: 'jinion', path: '~/projects/jinion', branch: 'feat/desktop-app', openedAt: minutes(60 * 26) },
  { id: 'notes-app', name: 'notes-app', path: '~/code/notes-app', branch: 'main', openedAt: minutes(60 * 24 * 9) },
];
