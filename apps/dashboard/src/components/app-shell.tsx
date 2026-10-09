'use client';

import { Suspense, ViewTransition } from 'react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import { House, Menu, MessageSquareText, Search, Ticket, Users, Workflow } from 'lucide-react';
import { touchTarget } from '@/components/page';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { admin } from '@/lib/admin';

type NavItem = {
  label: string;
  href: string;
  icon: typeof House;
};

const nav: NavItem[] = [
  { label: 'Overview', href: '/', icon: House },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Turns', href: '/turns', icon: Workflow },
  { label: 'Feedback', href: '/feedback', icon: MessageSquareText },
  { label: 'Invites', href: '/invites', icon: Ticket },
];

const link =
  'relative isolate flex items-center gap-2 rounded-md px-2 py-1.5 text-sm/5 text-neutral-600 hover:bg-neutral-950/5 hover:text-neutral-950 aria-[current=page]:text-neutral-950';

// A single highlight that glides from the old menu item to the new one as the page changes.
const highlight = (
  <ViewTransition name="nav-highlight">
    <span className="absolute inset-0 -z-10 rounded-md bg-neutral-950/6" aria-hidden="true" />
  </ViewTransition>
);

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="isolate flex h-dvh bg-white text-neutral-950 max-lg:flex-col">
      <aside className="w-64 shrink-0 border-r border-neutral-950/5 bg-neutral-50 max-lg:hidden">
        <SidebarContent />
      </aside>

      <div className="flex items-center gap-3 border-b border-neutral-950/5 px-4 py-2 lg:hidden">
        <Sheet>
          <SheetTrigger
            aria-label="Open the menu"
            className="relative grid size-8 place-items-center rounded-md text-neutral-600 hover:bg-neutral-950/5 hover:text-neutral-950"
          >
            <Menu className="size-4 shrink-0" />
            {touchTarget}
          </SheetTrigger>
          <SheetContent side="left" showCloseButton={false} className="w-72 bg-neutral-50 p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <p className="text-base font-semibold tracking-tight">Jinion</p>
      </div>

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <p className="px-2 pt-1 text-base font-semibold tracking-tight">Jinion</p>

      <button
        type="button"
        className="flex items-center gap-2 rounded-lg bg-white py-1.5 pr-1.5 pl-2 text-sm/5 text-neutral-500 ring-1 shadow-xs ring-neutral-950/10 hover:bg-neutral-50 hover:text-neutral-700"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded-md bg-neutral-950/5 px-1.5 font-sans text-xs/5 text-neutral-500">⌘K</kbd>
      </button>

      <nav className="-mt-3 flex-1">
        {/* The current URL is only known at request time on dynamic routes, so it must not block the static shell. */}
        <Suspense fallback={<NavList section={null} />}>
          <ActiveNavList />
        </Suspense>
      </nav>

      <div className="flex items-center gap-2 px-2 pb-1">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-200 text-xs/5 text-neutral-700">
          {admin.initials}
        </span>
        <p className="min-w-0 truncate text-sm/5">{admin.name}</p>
      </div>
    </div>
  );
}

function ActiveNavList() {
  const [first] = useSelectedLayoutSegments();

  return <NavList section={first ? `/${first}` : '/'} />;
}

function NavList({ section }: { section: string | null }) {
  return (
    <ul role="list" className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const current = section === item.href;

        return (
          <li key={item.href}>
            <Link href={item.href} aria-current={current ? 'page' : undefined} className={link}>
              {current && highlight}
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
