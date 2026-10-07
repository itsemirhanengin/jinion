import '@jinion/ui/theme.css';
import { classNames } from '@jinion/ui';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatPieces } from './pages/chat-pieces.js';
import { Leaf } from './pages/leaf.js';
import { Menus } from './pages/menus.js';
import { Primitives } from './pages/primitives.js';
import { Plan } from './pages/plan.js';
import { PlanRound } from './pages/plan-round.js';
import { Terminal } from './pages/terminal.js';

const pages = [
  { id: 'plan-round', title: 'Plan, round 2', Page: PlanRound },
  { id: 'plan', title: 'Plan', Page: Plan },
  { id: 'terminal', title: 'Terminal', Page: Terminal },
  { id: 'leaf', title: 'Leaf', Page: Leaf },
  { id: 'menus', title: 'Menus', Page: Menus },
  { id: 'chat', title: 'Conversation', Page: ChatPieces },
  { id: 'primitives', title: 'Primitives', Page: Primitives },
];

function Playground() {
  const [hash, setHash] = useState(location.hash.slice(1));

  useEffect(() => {
    const changed = () => setHash(location.hash.slice(1));

    addEventListener('hashchange', changed);

    return () => removeEventListener('hashchange', changed);
  }, []);

  const { Page } = pages.find((page) => page.id === hash) ?? pages[0]!;

  return (
    <div className="flex h-full bg-sidebar">
      <nav className="flex w-44 shrink-0 flex-col gap-px p-3">
        <h1 className="px-2.5 pt-1 pb-3 font-semibold">Jinion UI</h1>
        {pages.map((page) => (
          <a
            key={page.id}
            href={`#${page.id}`}
            className={classNames('rounded-lg px-2.5 py-1.5', page.Page === Page ? 'bg-hover text-ink' : 'text-muted hover:text-ink')}
          >
            {page.title}
          </a>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-auto p-4 pl-0">
        <Page />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
