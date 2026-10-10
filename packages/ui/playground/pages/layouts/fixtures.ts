export type State = 'working' | 'waiting' | undefined;

export interface Thread {
  title: string;
  ago: string;
  state?: State;
  snippet: string;
  added?: number;
  removed?: number;
}

export const projects: { name: string; branch: string; state?: State; threads: number }[] = [
  { name: 'coding-agent', branch: 'feat/dashboard', state: 'working', threads: 5 },
  { name: 'bugece-web', branch: 'main', state: 'waiting', threads: 2 },
  { name: 'sit-dashboard', branch: 'main', threads: 7 },
];

export const threads: Thread[] = [
  { title: 'Search on the users table', ago: 'now', state: 'working', snippet: 'Running the typecheck', added: 48, removed: 3 },
  { title: 'Invite emails in Turkish', ago: '4m', state: 'waiting', snippet: 'Should the subject line stay in English?' },
  { title: 'Explain the turns chart', ago: '1h', snippet: 'Turns are counted once per prompt, not per tool call.' },
  { title: 'Move the tokens to CSS variables', ago: 'Yesterday', snippet: 'Every color now reads from theme.css.', added: 120, removed: 88 },
  { title: 'Fix the flaky login test', ago: '2d', snippet: 'The test waited on a timer; it waits on the response now.', added: 6, removed: 2 },
];

export const changes = [
  { name: 'page.tsx', folder: 'apps/dashboard/src/app/users', added: 38, removed: 3 },
  { name: 'search-box.tsx', folder: 'apps/dashboard/src/app/users', added: 10, removed: 0, created: true },
];

export type GitStatus = 'M' | 'A';

export const tree: { name: string; depth: number; folder?: boolean; open?: boolean; status?: GitStatus; active?: boolean }[] = [
  { name: 'apps', depth: 0, folder: true, open: true },
  { name: 'dashboard', depth: 1, folder: true, open: true },
  { name: 'src/app/users', depth: 2, folder: true, open: true },
  { name: 'page.tsx', depth: 3, status: 'M', active: true },
  { name: 'search-box.tsx', depth: 3, status: 'A' },
  { name: 'users-table.tsx', depth: 3 },
  { name: 'src/lib/data', depth: 2, folder: true },
  { name: 'package.json', depth: 2 },
  { name: 'desktop', depth: 1, folder: true },
  { name: 'website', depth: 1, folder: true },
  { name: 'packages', depth: 0, folder: true },
  { name: 'AGENTS.md', depth: 0 },
  { name: 'package.json', depth: 0 },
  { name: 'README.md', depth: 0, status: 'M' },
];

export const gitChanges: { name: string; folder: string; status: GitStatus; staged?: boolean; byHand?: boolean }[] = [
  { name: 'page.tsx', folder: 'apps/dashboard/src/app/users', status: 'M', staged: true },
  { name: 'search-box.tsx', folder: 'apps/dashboard/src/app/users', status: 'A', staged: true },
  { name: 'README.md', folder: '', status: 'M', byHand: true },
];

export const pageSource = `import { listUsers } from '@/lib/data/users';
import { SearchBox } from './search-box';
import { UsersTable } from './users-table';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function UsersPage({ searchParams }: Props) {
  const query = (await searchParams).q?.toLowerCase() ?? '';
  const users = (await listUsers()).filter((user) =>
    \`\${user.name} \${user.email}\`.toLowerCase().includes(query),
  );

  return (
    <main className="flex flex-col gap-4 p-8">
      <header>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-muted">{users.length} of 128</p>
      </header>
      <SearchBox defaultValue={query} />
      <UsersTable users={users} />
    </main>
  );
}`;

export const searchBoxSource = `'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function SearchBox({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <input
      type="search"
      defaultValue={defaultValue}
      placeholder="Search by name or email"
      onChange={(event) => {
        const next = new URLSearchParams(params);

        next.set('q', event.target.value);
        router.replace(\`?\${next}\`);
      }}
    />
  );
}`;

export const diff = [
  { number: 12, sign: ' ', text: 'export default async function UsersPage({ searchParams }: Props) {' },
  { number: 13, sign: '-', text: '  const users = await listUsers();' },
  { number: 13, sign: '+', text: "  const query = (await searchParams).q?.toLowerCase() ?? '';" },
  { number: 14, sign: '+', text: '  const users = (await listUsers()).filter((user) =>' },
  { number: 15, sign: '+', text: '    `${user.name} ${user.email}`.toLowerCase().includes(query),' },
  { number: 16, sign: '+', text: '  );' },
  { number: 17, sign: ' ', text: '' },
  { number: 18, sign: ' ', text: '  return <UsersTable users={users} />;' },
];

export const people = [
  { name: 'Ayşe Demir', email: 'ayse@bugece.co', turns: 412, seen: '2m ago' },
  { name: 'Ayhan Kaya', email: 'ayhan.kaya@gmail.com', turns: 158, seen: '1h ago' },
  { name: 'Kayra Uslu', email: 'kayra@sit.app', turns: 97, seen: 'Yesterday' },
];

export const terminal: { text: string; tone?: 'faint' | 'added' | 'accent' }[] = [
  { text: '~/projects/coding-agent $ pnpm dev:dashboard', tone: 'faint' },
  { text: '   ▲ Next.js 16.1.0 (Turbopack)' },
  { text: '   - Local:  http://localhost:3000', tone: 'accent' },
  { text: ' ✓ Ready in 812ms', tone: 'added' },
  { text: ' GET /users?q=ay 200 in 64ms', tone: 'faint' },
];
